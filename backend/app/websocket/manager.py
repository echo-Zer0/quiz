import json
import logging
import asyncio
from typing import Dict, Set, Optional, Any, List
from fastapi import WebSocket

logger = logging.getLogger("cyber_quiz.websocket")

class ConnectionManager:
    def __init__(self):
        # session_id -> Set[WebSocket]
        self.admin_connections: Dict[str, Set[WebSocket]] = {}
        
        # session_id -> Dict[participant_id, WebSocket]
        self.participant_connections: Dict[str, Dict[str, WebSocket]] = {}
        
        # session_id -> Dict[participant_id, username]
        self.participant_usernames: Dict[str, Dict[str, str]] = {}
        
        # session_id -> in-memory session metadata (e.g. current_question_index, total_time_limit, started_at)
        self.session_states: Dict[str, Dict[str, Any]] = {}
        
        # Background keep-alive heartbeat task
        self._heartbeat_task: Optional[asyncio.Task] = None

    def start_heartbeat(self):
        """Ensure the background ping task is active for proxy keepalive."""
        if self._heartbeat_task is None or self._heartbeat_task.done():
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    async def _heartbeat_loop(self):
        """Send periodic ping every 25 seconds to prevent Cloudflare/HuggingFace from dropping idle WebSockets."""
        while True:
            try:
                await asyncio.sleep(25)
                ping_payload = json.dumps({"event": "ping"})
                tasks = []
                
                # Ping all connected admins
                for s_id, admins in list(self.admin_connections.items()):
                    for ws in list(admins):
                        tasks.append(self._safe_send_admin(s_id, ws, ping_payload))
                        
                # Ping all connected participants
                for s_id, participants in list(self.participant_connections.items()):
                    for pid, ws in list(participants.items()):
                        tasks.append(self._safe_send_participant(s_id, pid, ws, ping_payload))
                        
                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Heartbeat loop error: {e}")

    def set_session_state(self, session_id: str, key: str, value: Any):
        if session_id not in self.session_states:
            self.session_states[session_id] = {}
        self.session_states[session_id][key] = value

    def get_session_state(self, session_id: str) -> Dict[str, Any]:
        return self.session_states.get(session_id, {})

    async def connect_admin(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self.admin_connections:
            self.admin_connections[session_id] = set()
        self.admin_connections[session_id].add(websocket)
        self.start_heartbeat()
        logger.info(f"Admin connected to session {session_id}")

    def disconnect_admin(self, session_id: str, websocket: WebSocket):
        if session_id in self.admin_connections:
            self.admin_connections[session_id].discard(websocket)
            if not self.admin_connections[session_id]:
                del self.admin_connections[session_id]
        logger.info(f"Admin disconnected from session {session_id}")

    async def connect_participant(self, session_id: str, participant_id: str, username: str, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self.participant_connections:
            self.participant_connections[session_id] = {}
            self.participant_usernames[session_id] = {}
        
        # Save or update connection
        self.participant_connections[session_id][participant_id] = websocket
        self.participant_usernames[session_id][participant_id] = username
        self.start_heartbeat()
        
        count = len(self.participant_connections[session_id])
        
        # 1. Notify admins with detailed roster
        participants_list = [
            {"participant_id": pid, "username": uname}
            for pid, uname in self.participant_usernames[session_id].items()
        ]
        await self.broadcast_to_admins(session_id, "participant_joined", {
            "participant_id": participant_id,
            "username": username,
            "participant_count": count,
            "participants": participants_list
        })
        
        # 2. Notify participants with lightweight payload (avoids O(N^2) burst data transfer)
        await self.broadcast_to_participants(session_id, "participant_joined", {
            "participant_id": participant_id,
            "username": username,
            "participant_count": count
        })
        logger.info(f"Participant {username} ({participant_id}) connected to session {session_id}")

    async def disconnect_participant(self, session_id: str, participant_id: str):
        username = "Unknown"
        if session_id in self.participant_connections:
            if participant_id in self.participant_connections[session_id]:
                del self.participant_connections[session_id][participant_id]
            if participant_id in self.participant_usernames[session_id]:
                username = self.participant_usernames[session_id].pop(participant_id, "Unknown")
            
            count = len(self.participant_connections[session_id])
            await self.broadcast_to_session(session_id, "participant_left", {
                "participant_id": participant_id,
                "username": username,
                "participant_count": count
            })
            
            if not self.participant_connections[session_id]:
                del self.participant_connections[session_id]
                del self.participant_usernames[session_id]
        logger.info(f"Participant {username} ({participant_id}) disconnected from session {session_id}")

    def get_connected_participants_count(self, session_id: str) -> int:
        return len(self.participant_connections.get(session_id, {}))

    def get_connected_participants_list(self, session_id: str) -> List[Dict[str, str]]:
        return [
            {"participant_id": pid, "username": uname}
            for pid, uname in self.participant_usernames.get(session_id, {}).items()
        ]

    async def _safe_send_admin(self, session_id: str, ws: WebSocket, payload: str):
        try:
            await ws.send_text(payload)
        except Exception:
            if session_id in self.admin_connections:
                self.admin_connections[session_id].discard(ws)

    async def _safe_send_participant(self, session_id: str, participant_id: str, ws: WebSocket, payload: str):
        try:
            await ws.send_text(payload)
        except Exception:
            if session_id in self.participant_connections:
                self.participant_connections[session_id].pop(participant_id, None)
            if session_id in self.participant_usernames:
                self.participant_usernames[session_id].pop(participant_id, None)

    async def send_to_participant(self, session_id: str, participant_id: str, event: str, data: Any):
        if session_id in self.participant_connections:
            ws = self.participant_connections[session_id].get(participant_id)
            if ws:
                try:
                    await ws.send_text(json.dumps({"event": event, "data": data}))
                except Exception as e:
                    logger.warning(f"Error sending to participant {participant_id}: {e}")

    async def broadcast_to_admins(self, session_id: str, event: str, data: Any):
        if session_id in self.admin_connections:
            payload = json.dumps({"event": event, "data": data})
            tasks = [
                self._safe_send_admin(session_id, ws, payload)
                for ws in list(self.admin_connections[session_id])
            ]
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_to_participants(self, session_id: str, event: str, data: Any):
        if session_id in self.participant_connections:
            payload = json.dumps({"event": event, "data": data})
            tasks = [
                self._safe_send_participant(session_id, pid, ws, payload)
                for pid, ws in list(self.participant_connections[session_id].items())
            ]
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_to_session(self, session_id: str, event: str, data: Any):
        """Concurrent non-blocking broadcast to all participants and admins via asyncio.gather."""
        payload = json.dumps({"event": event, "data": data})
        tasks = []
        if session_id in self.admin_connections:
            for ws in list(self.admin_connections[session_id]):
                tasks.append(self._safe_send_admin(session_id, ws, payload))
        if session_id in self.participant_connections:
            for pid, ws in list(self.participant_connections[session_id].items()):
                tasks.append(self._safe_send_participant(session_id, pid, ws, payload))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

manager = ConnectionManager()
