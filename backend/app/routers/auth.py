from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.auth import CreatorRegisterRequest, CreatorLoginRequest, TokenResponse, CreatorResponse
from app.services.auth_service import auth_service
from app.utils.security import get_current_creator

router = APIRouter(prefix="/api/auth", tags=["Auth"])

@router.post("/register", response_model=CreatorResponse, status_code=status.HTTP_201_CREATED)
def register(req: CreatorRegisterRequest):
    try:
        creator = auth_service.register_creator(req)
        return creator
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Registration failed: {str(e)}")

@router.post("/login", response_model=TokenResponse)
def login(req: CreatorLoginRequest):
    try:
        token_data = auth_service.authenticate_creator(req)
        return token_data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Login failed")

@router.get("/me")
def get_me(current_creator: dict = Depends(get_current_creator)):
    return current_creator
