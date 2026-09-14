from pydantic import BaseModel, Field, field_validator
from typing import Optional, List

class JoinRoomRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=30)
    participant_id: Optional[str] = None
    browser_id: Optional[str] = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("Username must be at least 2 characters")
        return cleaned

class JoinRoomResponse(BaseModel):
    id: Optional[str] = None
    participant_id: str
    session_id: str
    room_code: str
    username: str
    quiz_title: str
    status: str
    resumed: Optional[bool] = False

class StartSessionRequest(BaseModel):
    total_time_limit: Optional[int] = Field(default=None, description="Total quiz duration in seconds")

class SessionStatusResponse(BaseModel):
    id: Optional[str] = None
    session_id: str
    quiz_id: str
    quiz_title: str
    room_code: str
    status: str
    participant_count: int
    current_question_index: int
    total_questions: int
    total_time_limit: Optional[int] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    lan_ip: Optional[str] = None
