from fastapi import APIRouter, HTTPException, status, Depends
from typing import Optional
from app.schemas.session import JoinRoomRequest, JoinRoomResponse, SessionStatusResponse, StartSessionRequest
from app.services.session_service import session_service
from app.utils.room_code import get_lan_ip
from app.utils.security import get_current_creator
from app.websocket.manager import manager

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])

@router.get("/code/{room_code}", response_model=SessionStatusResponse)
def get_session_by_code(room_code: str):
    try:
        session = session_service.get_session_by_code(room_code)
        active_count = manager.get_connected_participants_count(session["id"])
        return SessionStatusResponse(
            id=session["id"],
            session_id=session["id"],
            quiz_id=session["quiz_id"],
            quiz_title=session.get("quiz_title", "Cyber Quiz"),
            room_code=session["room_code"],
            status=session["status"],
            participant_count=max(active_count, session.get("participant_count", 0)),
            current_question_index=session.get("current_question_index", 0),
            total_questions=session.get("total_questions", 0),
            total_time_limit=session.get("total_time_limit"),
            started_at=session.get("started_at"),
            ended_at=session.get("ended_at"),
            lan_ip=get_lan_ip()
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/id/{session_id}", response_model=SessionStatusResponse)
def get_session_by_id(session_id: str):
    try:
        session = session_service.get_session_by_id(session_id)
        active_count = manager.get_connected_participants_count(session["id"])
        return SessionStatusResponse(
            id=session["id"],
            session_id=session["id"],
            quiz_id=session["quiz_id"],
            quiz_title=session.get("quiz_title", "Cyber Quiz"),
            room_code=session["room_code"],
            status=session["status"],
            participant_count=max(active_count, session.get("participant_count", 0)),
            current_question_index=session.get("current_question_index", 0),
            total_questions=session.get("total_questions", 0),
            total_time_limit=session.get("total_time_limit"),
            started_at=session.get("started_at"),
            ended_at=session.get("ended_at"),
            lan_ip=get_lan_ip()
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/join/{room_code}", response_model=JoinRoomResponse)
def join_room(room_code: str, req: JoinRoomRequest):
    try:
        result = session_service.join_session(room_code, req.username, req.participant_id, req.browser_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        import logging
        logging.getLogger("cyber_quiz.sessions").error(f"Join error: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/{session_id}/start")
async def start_session(session_id: str, req: Optional[StartSessionRequest] = None, current_creator: dict = Depends(get_current_creator)):
    try:
        time_limit = req.total_time_limit if req else None
        session = session_service.start_session(session_id, current_creator["id"], time_limit)
        await manager.broadcast_to_session(session_id, "quiz_started", {
            "session_id": session_id,
            "status": "running",
            "started_at": session.get("started_at"),
            "total_time_limit": session.get("total_time_limit")
        })
        return session
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/{session_id}/end")
async def end_session(session_id: str, current_creator: dict = Depends(get_current_creator)):
    try:
        session = session_service.end_session(session_id, current_creator["id"])
        final_lb = session_service.get_leaderboard(session_id)
        await manager.broadcast_to_session(session_id, "quiz_ended", {
            "session_id": session_id,
            "status": "ended",
            "leaderboard": final_lb
        })
        return session
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/{session_id}/leaderboard")
def get_leaderboard(session_id: str):
    try:
        return session_service.get_leaderboard(session_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/{session_id}/questions-overview/{participant_id}")
def get_questions_overview(session_id: str, participant_id: str):
    try:
        return session_service.get_participant_questions_overview(participant_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
