from fastapi import APIRouter, HTTPException, status, Depends
from app.services.session_service import session_service
from app.utils.security import get_current_creator

router = APIRouter(prefix="/api/results", tags=["Results"])

@router.get("/admin/{session_id}")
def get_admin_session_results(session_id: str, current_creator: dict = Depends(get_current_creator)):
    try:
        return session_service.get_session_admin_results(session_id, current_creator["id"])
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
