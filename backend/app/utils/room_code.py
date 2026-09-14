import secrets
import string

# Safe alphanumeric character set without ambiguous characters (no 0, O, 1, I, L)
SAFE_ROOM_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

def generate_room_code(length: int = 6) -> str:
    """Generate a secure, unambiguous 6-character room code."""
    return "".join(secrets.choice(SAFE_ROOM_CHARS) for _ in range(length))

def clean_room_code(code: str) -> str:
    """Normalize and clean user-entered room codes."""
    if not code:
        return ""
    # Strip whitespace, convert to uppercase, remove dashes or spaces
    cleaned = code.strip().upper().replace("-", "").replace(" ", "")
    return cleaned

def get_lan_ip() -> str:
    """Detect local LAN IP address for mobile QR code joining."""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


