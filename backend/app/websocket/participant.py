import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.manager import manager
from app.services.session_service import session_service

logger = logging.getLogger("cyber_quiz.ws_participant")
router = APIRouter()

@router.websocket("/ws/participant/{session_id}/{participant_id}")
async def participant_websocket_endpoint(websocket: WebSocket, session_id: str, participant_id: str):
    username = websocket.query_params.get("username", "Participant")
    
    try:
        session = session_service.get_session_by_id(session_id)
    except Exception:
        await websocket.close(code=4004, reason="Session not found")
        return
        
    await manager.connect_participant(session_id, participant_id, username, websocket)
    
    p_state = {"current_index": 0}
    
    try:
        is_running = (session.get("status") == "running")
        is_ended = (session.get("status") == "ended")
        
        if is_ended:
            await websocket.send_text(json.dumps({
                "event": "quiz_ended",
                "data": {"session_id": session_id, "status": "ended"}
            }))
        elif is_running:
            # If late joiner or reconnecting, send running status with total_time_limit and current question
            q_data = session_service.get_participant_question(participant_id, p_state["current_index"])
            await websocket.send_text(json.dumps({
                "event": "quiz_started",
                "data": {
                    "session_id": session_id,
                    "status": "running",
                    "started_at": session.get("started_at"),
                    "total_time_limit": session.get("total_time_limit"),
                    "question": q_data
                }
            }))
        else:
            count = manager.get_connected_participants_count(session_id)
            await websocket.send_text(json.dumps({
                "event": "waiting_state",
                "data": {
                    "session_id": session_id,
                    "status": "waiting",
                    "room_code": session.get("room_code", ""),
                    "quiz_title": session.get("quiz_title", "Cyber Quiz"),
                    "participant_count": count
                }
            }))
            
        while True:
            raw_data = await websocket.receive_text()
            try:
                msg = json.loads(raw_data)
            except Exception:
                continue
                
            action = msg.get("action")
            data = msg.get("data", {})
            
            if action == "get_question_by_index":
                idx = data.get("index", 0)
                p_state["current_index"] = idx
                q_data = session_service.get_participant_question(participant_id, idx)
                if q_data:
                    await websocket.send_text(json.dumps({
                        "event": "question_started",
                        "data": q_data
                    }))
                else:
                    await websocket.send_text(json.dumps({
                        "event": "question_not_found",
                        "data": {"index": idx}
                    }))

            elif action == "get_current_question":
                q_data = session_service.get_participant_question(participant_id, p_state["current_index"])
                if q_data:
                    await websocket.send_text(json.dumps({
                        "event": "question_started",
                        "data": q_data
                    }))
                    
            elif action == "submit_answer":
                question_id = data.get("question_id")
                selected_option_id = data.get("selected_option_id")
                
                try:
                    result = session_service.submit_answer(participant_id, question_id, selected_option_id)
                    
                    # Extract telemetry for admin live ticker
                    telemetry = result.pop("_telemetry", None)
                    
                    # Send saved confirmation to participant WITHOUT revealing correctness!
                    await websocket.send_text(json.dumps({
                        "event": "answer_result",
                        "data": result
                    }))
                    
                    # Notify admins of the live answer telemetry (avoids flooding 200 participants with 40KB leaderboard payloads)
                    if telemetry:
                        await manager.broadcast_to_admins(session_id, "answer_received", telemetry)
                except Exception as e:
                    await websocket.send_text(json.dumps({
                        "event": "error",
                        "data": {"message": str(e)}
                    }))

            elif action == "ping":
                await websocket.send_text(json.dumps({"event": "pong"}))
                
            elif action == "pong":
                pass
                    
            elif action == "next_question":
                p_state["current_index"] += 1
                q_data = session_service.get_participant_question(participant_id, p_state["current_index"])
                if q_data:
                    await websocket.send_text(json.dumps({
                        "event": "question_started",
                        "data": q_data
                    }))
                else:
                    # Last question reached; participant can stay on last question
                    p_state["current_index"] -= 1
                    
            elif action == "prev_question":
                if p_state["current_index"] > 0:
                    p_state["current_index"] -= 1
                    q_data = session_service.get_participant_question(participant_id, p_state["current_index"])
                    if q_data:
                        await websocket.send_text(json.dumps({
                            "event": "question_started",
                            "data": q_data
                        }))
                    
            elif action == "ping":
                await websocket.send_text(json.dumps({"event": "pong"}))
                
    except WebSocketDisconnect:
        await manager.disconnect_participant(session_id, participant_id)
    except Exception as e:
        logger.error(f"Participant WS error: {e}")
        await manager.disconnect_participant(session_id, participant_id)
