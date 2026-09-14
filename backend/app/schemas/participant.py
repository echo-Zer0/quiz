from pydantic import BaseModel, Field
from typing import Optional, List

class SubmitAnswerRequest(BaseModel):
    question_id: str
    selected_option_id: str

class AnswerResult(BaseModel):
    question_id: str
    selected_option_id: str
    status: str = "saved"
    is_correct: Optional[bool] = None
    points: Optional[int] = None
    response_time_ms: Optional[int] = None
    correct_option_id: Optional[str] = None

class LeaderboardEntry(BaseModel):
    rank: int
    participant_id: str
    username: str
    score: int
    correct_count: int
    wrong_count: int
    unanswered_count: int

class AnswerHistoryItem(BaseModel):
    question_id: str
    question_text: str
    selected_option_id: Optional[str] = None
    selected_option_text: Optional[str] = None
    correct_option_id: str
    correct_option_text: str
    is_correct: bool
    points: int
    response_time_ms: int
    time_limit: int

class ParticipantResultSummary(BaseModel):
    participant_id: str
    username: str
    session_id: str
    quiz_title: str
    status: Optional[str] = "ended"
    is_frozen: bool = False
    message: Optional[str] = None
    total_score: Optional[int] = 0
    rank: Optional[int] = 1
    total_participants: Optional[int] = 1
    correct_count: Optional[int] = 0
    wrong_count: Optional[int] = 0
    unanswered_count: Optional[int] = 0
    accuracy_percentage: Optional[float] = 0.0
    avg_response_time_ms: Optional[int] = 0
    fastest_response_time_ms: Optional[int] = 0
    total_questions: Optional[int] = 0
    answer_history: List[AnswerHistoryItem] = []
