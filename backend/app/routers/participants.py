from fastapi import APIRouter, HTTPException, status
from app.schemas.participant import SubmitAnswerRequest, AnswerResult, ParticipantResultSummary
from app.services.session_service import session_service
from app.websocket.manager import manager

router = APIRouter(prefix="/api/participants", tags=["Participants"])

@router.get("/{participant_id}/question/{question_index}")
def get_participant_question(participant_id: str, question_index: int):
    try:
        q_data = session_service.get_participant_question(participant_id, question_index)
        if not q_data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
        return q_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/{participant_id}/answer", response_model=AnswerResult)
async def submit_answer(participant_id: str, req: SubmitAnswerRequest):
    try:
        res = session_service.submit_answer(participant_id, req.question_id, req.selected_option_id)
        
        telemetry = res.pop("_telemetry", None)
        if telemetry:
            session_id = telemetry.get("session_id")
            if session_id:
                await manager.broadcast_to_admins(session_id, "answer_received", telemetry)
            
        return res
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/{participant_id}/result", response_model=ParticipantResultSummary)
def get_participant_result(participant_id: str):
    try:
        return session_service.get_participant_result_summary(participant_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
