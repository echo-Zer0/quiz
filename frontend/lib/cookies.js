// Browser Cookie Management Utility for Cyber Quiz Platform

/**
 * Set a cookie with specified name, value, and lifespan in days
 */
export function setCookie(name, value, days = 7) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
}

/**
 * Get cookie value by name
 */
export function getCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
  return match ? decodeURIComponent(match[3]) : null;
}

/**
 * Delete a cookie by setting its expiration to the past
 */
export function deleteCookie(name) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

/**
 * Get or generate a persistent UUID identifying this browser client
 */
export function getBrowserId() {
  if (typeof window === "undefined") return "";
  let bId = getCookie("cyber_browser_id");
  if (!bId) {
    bId = "browser_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);
    setCookie("cyber_browser_id", bId, 365);
  }
  return bId;
}

/**
 * Save participant credentials for a specific session into a persistent cookie
 */
export function saveParticipantCookie(sessionId, data) {
  if (!sessionId || !data) return;
  const payload = JSON.stringify({
    participant_id: data.participant_id,
    username: data.username,
    session_id: sessionId,
    room_code: data.room_code || "",
    quiz_title: data.quiz_title || "",
    joined_at: data.joined_at || new Date().toISOString(),
  });
  setCookie(`cyber_p_${sessionId}`, payload, 3); // 3 days validity
  setCookie("cyber_last_session_id", sessionId, 3);
  if (data.room_code) {
    setCookie(`cyber_room_${data.room_code.toUpperCase()}`, sessionId, 3);
  }
}

/**
 * Retrieve participant credentials for a specific session
 */
export function getParticipantCookie(sessionId) {
  if (!sessionId) return null;
  const raw = getCookie(`cyber_p_${sessionId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Look up participant credentials using a room code
 */
export function getParticipantCookieByRoom(roomCode) {
  if (!roomCode) return null;
  const sessionId = getCookie(`cyber_room_${roomCode.toUpperCase()}`);
  if (sessionId) {
    return getParticipantCookie(sessionId);
  }
  return null;
}

/**
 * Clear participant credentials for a specific session
 */
export function clearParticipantCookie(sessionId) {
  if (!sessionId) return;
  deleteCookie(`cyber_p_${sessionId}`);
}
