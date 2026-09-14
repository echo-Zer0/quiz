from pydantic import BaseModel, Field, field_validator
from typing import List, Optional

class OptionBase(BaseModel):
    option_text: str = Field(..., min_length=1, max_length=300)
    option_order: int = Field(default=1)

class OptionCreate(OptionBase):
    is_correct: bool = Field(default=False)

class OptionParticipantResponse(BaseModel):
    id: str
    option_text: str
    option_order: int

class OptionAdminResponse(OptionBase):
    id: str
    is_correct: bool

class QuestionCreate(BaseModel):
    question_text: str = Field(..., min_length=3, max_length=1000)
    time_limit: int = Field(default=20, ge=3, le=300, description="Time limit in seconds")
    question_order: int = Field(default=1)
    options: List[OptionCreate] = Field(..., min_length=3, description="Minimum 3 dynamic options required")

    @field_validator("options")
    @classmethod
    def validate_options(cls, options: List[OptionCreate]) -> List[OptionCreate]:
        if len(options) < 3:
            raise ValueError("Every question must have at least 3 options")
        correct_count = sum(1 for opt in options if opt.is_correct)
        if correct_count != 1:
            raise ValueError("Exactly one option must be marked as correct")
        return options

class QuestionParticipantResponse(BaseModel):
    id: str
    question_text: str
    time_limit: int
    question_order: int
    total_questions: int
    options: List[OptionParticipantResponse]

class QuestionAdminResponse(BaseModel):
    id: str
    question_text: str
    time_limit: int
    question_order: int
    options: List[OptionAdminResponse]

class QuizCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = Field(default="", max_length=1000)
    questions: List[QuestionCreate] = Field(default_factory=list)

class QuizUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    questions: Optional[List[QuestionCreate]] = None

class QuizSummaryResponse(BaseModel):
    id: str
    creator_id: str
    title: str
    description: Optional[str] = ""
    status: str
    question_count: int
    created_at: str
    updated_at: str
    published_at: Optional[str] = None

class QuizDetailResponse(BaseModel):
    id: str
    creator_id: str
    title: str
    description: Optional[str] = ""
    status: str
    created_at: str
    updated_at: str
    published_at: Optional[str] = None
    questions: List[QuestionAdminResponse]
