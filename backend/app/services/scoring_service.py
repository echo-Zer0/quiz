import math

class ScoringEngine:
    """Configurable scoring engine for cybersecurity quizzes."""
    
    BASE_MAX_SCORE = 100
    GRACE_PERIOD_MS = 300  # Network grace period in milliseconds
    
    @classmethod
    def calculate_score(cls, is_correct: bool, response_time_ms: int, time_limit_sec: int) -> int:
        """
        Calculate score based on speed and correctness.
        Formula:
          If incorrect or timed out: 0 points.
          If answered within grace period (e.g. <= 300ms): 100 points.
          Otherwise: max(10, round(100 * (1 - (response_time_ms / (time_limit_sec * 1000)))))
        Ensures correct answers always earn at least a minimal bonus if answered within time.
        """
        if not is_correct:
            return 0
            
        time_limit_ms = time_limit_sec * 1000
        
        # Check timeout with 1.5s tolerance for network latency
        if response_time_ms > (time_limit_ms + 1500):
            return 0
            
        if response_time_ms <= cls.GRACE_PERIOD_MS:
            return cls.BASE_MAX_SCORE
            
        # Calculate time ratio
        time_ratio = min(1.0, max(0.0, response_time_ms / time_limit_ms))
        calculated = cls.BASE_MAX_SCORE * (1.0 - time_ratio)
        score = max(10, round(calculated))
        return min(cls.BASE_MAX_SCORE, score)

scoring_engine = ScoringEngine()
