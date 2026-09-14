"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

export default function AntiCheatOverlay({ active = true }) {
  const [warning, setWarning] = useState("");

  const triggerWarning = (msg) => {
    setWarning(msg);
    setTimeout(() => setWarning(""), 3500);
  };

  useEffect(() => {
    if (!active) return;

    // 1. Prevent Right Click context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
      triggerWarning("SECURITY PROTOCOL: CONTEXT MENU RESTRICTED");
    };

    // 2. Prevent Copy/Cut/Paste/Inspect/Select-all keyboard shortcuts
    const handleKeyDown = (e) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const key = e.key ? e.key.toLowerCase() : "";

      // Block F12 (DevTools)
      if (e.key === "F12") {
        e.preventDefault();
        triggerWarning("SECURITY ALERT: DEVELOPER TOOLS BLOCKED");
        return;
      }

      // Block Ctrl+Shift+I / J / C (Inspect)
      if (isCtrlOrMeta && e.shiftKey && ["i", "j", "c"].includes(key)) {
        e.preventDefault();
        triggerWarning("SECURITY ALERT: INSPECTOR SHORTCUT BLOCKED");
        return;
      }

      // Block Ctrl+C (copy), Ctrl+X (cut), Ctrl+A (select all), Ctrl+U (source), Ctrl+S (save), Ctrl+P (print)
      if (isCtrlOrMeta && ["c", "x", "a", "u", "s", "p", "v"].includes(key)) {
        e.preventDefault();
        triggerWarning(`SECURITY PROTOCOL: SHORTCUT [CTRL+${key.toUpperCase()}] BLOCKED`);
        return;
      }
    };

    // 3. Prevent Copy event and clear clipboard buffer
    const handleCopy = (e) => {
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData("text/plain", "");
      }
      triggerWarning("SECURITY PROTOCOL: TEXT COPY OPERATION BLOCKED");
    };

    // 4. Prevent Cut event
    const handleCut = (e) => {
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData("text/plain", "");
      }
      triggerWarning("SECURITY PROTOCOL: CLIPBOARD CUT RESTRICTED");
    };

    // 5. Prevent Mouse Text Selection
    const handleSelectStart = (e) => {
      e.preventDefault();
    };

    // 6. Prevent Dragging Text
    const handleDragStart = (e) => {
      e.preventDefault();
    };

    // 7. Tab visibility change (screen switch deterrent)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerWarning("ANOMALY DETECTED: WINDOW FOCUS LOST");
      }
    };

    window.addEventListener("contextmenu", handleContextMenu, { capture: true });
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("copy", handleCopy, { capture: true });
    window.addEventListener("cut", handleCut, { capture: true });
    document.addEventListener("selectstart", handleSelectStart, { capture: true });
    document.addEventListener("dragstart", handleDragStart, { capture: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu, { capture: true });
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("copy", handleCopy, { capture: true });
      window.removeEventListener("cut", handleCut, { capture: true });
      document.removeEventListener("selectstart", handleSelectStart, { capture: true });
      document.removeEventListener("dragstart", handleDragStart, { capture: true });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [active]);

  if (!warning) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
      <div className="px-5 py-2.5 bg-rose-950/90 border border-rose-500 text-rose-300 font-mono text-xs tracking-wider uppercase flex items-center gap-2 shadow-[0_0_20px_rgba(255,0,85,0.7)] backdrop-blur-md">
        <ShieldAlert className="w-4 h-4 text-rose-400 glow-red" />
        <span>{warning}</span>
      </div>
    </div>
  );
}
