from pydantic import BaseModel, Field, field_validator
from typing import Optional

class CreatorRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Unique creator username")
    password: str = Field(..., min_length=6, max_length=100, description="Creator account password")

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if not v.isalnum() and not "_" in v and not "-" in v:
            raise ValueError("Username may only contain letters, numbers, hyphens, and underscores")
        return v

class CreatorLoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    creator_id: str
    username: str

class CreatorResponse(BaseModel):
    id: str
    username: str
    created_at: str

