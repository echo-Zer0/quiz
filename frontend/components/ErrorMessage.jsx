"use client";

import React from "react";
import { ShieldAlert, RefreshCw } from "lucide-react";
import CyberButton from "./CyberButton";

export default function ErrorMessage({
  message,
  onRetry,
}) {
  return (
    <div className="p-4 border border-rose-500/60 bg-rose-950/30 text-rose-300 font-mono text-sm flex items-start gap-3 my-4 backdrop-blur-sm">
      <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 glow-red" />
      <div className="flex-1">
        <div className="font-bold uppercase tracking-wider text-rose-400 mb-0.5">
          SECURITY ALERT / SYSTEM ERROR
        </div>
        <div>&gt; {message || "An unexpected error occurred."}</div>
      </div>
      {onRetry && (
        <CyberButton size="sm" variant="red" onClick={onRetry} icon={RefreshCw}>
          RETRY
        </CyberButton>
      )}
    </div>
  );
}
