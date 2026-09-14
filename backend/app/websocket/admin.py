import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.manager import manager
from app.services.session_service import session_service
from app.utils.security import decode_access_token

logger = logging.getLogger("cyber_quiz.ws_admin")
router = APIRouter()

@router.websocket("/ws/admin/{session_id}")
async def admin_websocket_endpoint(websocket: WebSocket, session_id: str):
    token = websocket.query_params.get("token")
    if token:
        payload = decode_access_token(token)
        if not payload:
            await websocket.close(code=4001, reason="Unauthorized token")
            return
            
    await manager.connect_admin(session_id, websocket)
    
    try:
        session = session_service.get_session_by_id(session_id)
        participants = manager.get_connected_participants_list(session_id)
        leaderboard = session_service.get_leaderboard(session_id)
        
        await websocket.send_text(json.dumps({
            "event": "admin_sync",
            "data": {
                "session": session,
                "connected_participants": participants,
                "participant_count": len(participants),
                "leaderboard": leaderboard
            }
        }))
        
        while True:
            raw_data = await websocket.receive_text()
            try:
                msg = json.loads(raw_data)
            except Exception:
                continue
                
            action = msg.get("action")
            payload = msg.get("data", {})
            
            if action == "start_quiz":
                creator_id = payload.get("creator_id", "")
                total_time = payload.get("total_time_limit")
                started_session = session_service.start_session(session_id, creator_id, total_time)
                await manager.broadcast_to_session(session_id, "quiz_started", {
                    "session_id": session_id,
                    "status": "running",
                    "started_at": started_session.get("started_at"),
                    "total_time_limit": started_session.get("total_time_limit")
                })
                
            elif action == "next_question":
                await manager.broadcast_to_session(session_id, "admin_advance_question", {
                    "session_id": session_id,
                    "target": "next"
                })
                logger.info(f"Admin triggered next question advance for session {session_id}")
                
            elif action == "end_quiz":
                creator_id = payload.get("creator_id", "")
                ended_session = session_service.end_session(session_id, creator_id)
                final_lb = session_service.get_leaderboard(session_id)
                await manager.broadcast_to_session(session_id, "quiz_ended", {
                    "session_id": session_id,
                    "status": "ended",
                    "leaderboard": final_lb
                })
                
            elif action == "request_leaderboard":
                lb = session_service.get_leaderboard(session_id)
                await websocket.send_text(json.dumps({
                    "event": "leaderboard_updated",
                    "data": {"leaderboard": lb}
                }))
                
            elif action == "ping":
                await websocket.send_text(json.dumps({"event": "pong"}))
                
    except WebSocketDisconnect:
        manager.disconnect_admin(session_id, websocket)
    except Exception as e:
        logger.error(f"Admin WS error: {e}")
        manager.disconnect_admin(session_id, websocket)
