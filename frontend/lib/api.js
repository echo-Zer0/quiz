// Client API Helper for Cyber Quiz Platform

export function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    // If NEXT_PUBLIC_API_URL is configured, check if we should adapt to current host for LAN
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return envUrl;
    }
    // Automatically match hostname so mobile phones on LAN work without editing configs
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:8000`;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

export function getWsBaseUrl() {
  if (typeof window !== "undefined") {
    const envWs = process.env.NEXT_PUBLIC_WS_URL;
    if (envWs && !envWs.includes("localhost") && !envWs.includes("127.0.0.1")) {
      return envWs;
    }
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostname = window.location.hostname;
    return `${wsProto}//${hostname}:8000`;
  }
  return process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
}

export async function fetchApi(endpoint, options = {}) {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Attach creator JWT token if available
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("cyber_creator_token");
    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.detail || data?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}
