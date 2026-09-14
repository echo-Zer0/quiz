"use client";

import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export default function CountdownTimer({
  timeLimit = 600,
  serverStartedAt,
  onExpire,
  label = "GLOBAL QUIZ TIMER",
}) {
  const [timeLeft, setTimeLeft] = useState(timeLimit);

  useEffect(() => {
    setTimeLeft(timeLimit);

    const startTime = serverStartedAt ? new Date(serverStartedAt).getTime() : Date.now();
    const endTime = startTime + timeLimit * 1000;

    const interval = setInterval(() => {
      const now = Date.now();
      const remainingMs = endTime - now;
      const remainingSec = Math.max(0, remainingMs / 1000);

      setTimeLeft(remainingSec);

      if (remainingSec <= 0) {
        clearInterval(interval);
        if (onExpire) onExpire();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [timeLimit, serverStartedAt, onExpire]);

  const percentage = Math.max(0, Math.min(100, (timeLeft / timeLimit) * 100));
  const isLow = timeLeft <= 30.0;
  const isCritical = timeLeft <= 10.0;

  // Formatting MM:SS or SS.ms
  const mins = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const secs = Math.floor(timeLeft % 60).toString().padStart(2, "0");
  const millis = Math.floor((timeLeft % 1) * 10).toString();

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="text-[11px] font-mono tracking-widest uppercase text-slate-400 mb-1 flex items-center gap-1.5">
        <Clock className={`w-3.5 h-3.5 ${isLow ? "text-rose-400 animate-spin" : "text-cyan-400"}`} />
        <span>{label}</span>
      </div>

      <div className="relative flex items-center justify-center">
        <div
          className={`font-mono text-3xl sm:text-4xl md:text-5xl font-black tracking-widest px-8 py-2 border transition-all ${
            isCritical
              ? "text-rose-400 border-rose-500 bg-rose-950/60 glow-red animate-bounce"
              : isLow
              ? "text-amber-400 border-amber-500 bg-amber-950/40 glow-yellow animate-pulse"
              : "text-cyan-400 border-cyan-500/50 bg-cyan-950/30 glow-cyan"
          }`}
        >
          {mins}:{secs}
          {isLow && <span className="text-xl sm:text-2xl opacity-75">.{millis}</span>}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-[280px] h-1.5 bg-slate-900 border border-slate-800 mt-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-100 ${
            isCritical
              ? "bg-rose-500 shadow-[0_0_12px_#f43f5e]"
              : isLow
              ? "bg-amber-400 shadow-[0_0_12px_#f59e0b]"
              : "bg-cyan-400 shadow-[0_0_12px_#00f0ff]"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
