from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from app.schemas.quiz import QuizCreate, QuizUpdate, QuizSummaryResponse, QuizDetailResponse
from app.services.quiz_service import quiz_service
from app.utils.security import get_current_creator

router = APIRouter(prefix="/api/quizzes", tags=["Quizzes"])

@router.post("", status_code=status.HTTP_201_CREATED)
def create_quiz(req: QuizCreate, current_creator: dict = Depends(get_current_creator)):
    try:
        quiz = quiz_service.create_quiz(current_creator["id"], req)
        return quiz
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("", response_model=List[QuizSummaryResponse])
def list_quizzes(current_creator: dict = Depends(get_current_creator)):
    try:
        return quiz_service.list_quizzes(current_creator["id"])
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/{quiz_id}", response_model=QuizDetailResponse)
def get_quiz(quiz_id: str, current_creator: dict = Depends(get_current_creator)):
    try:
        return quiz_service.get_quiz_detail(current_creator["id"], quiz_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.put("/{quiz_id}")
def update_quiz(quiz_id: str, req: QuizUpdate, current_creator: dict = Depends(get_current_creator)):
    try:
        return quiz_service.update_quiz(current_creator["id"], quiz_id, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(quiz_id: str, current_creator: dict = Depends(get_current_creator)):
    try:
        quiz_service.delete_quiz(current_creator["id"], quiz_id)
        return None
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/{quiz_id}/publish")
def publish_quiz(quiz_id: str, current_creator: dict = Depends(get_current_creator)):
    try:
        result = quiz_service.publish_quiz(current_creator["id"], quiz_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
