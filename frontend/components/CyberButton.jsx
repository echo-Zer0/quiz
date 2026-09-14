"use client";

import React from "react";
import { Loader2 } from "lucide-react";

export default function CyberButton({
  children,
  onClick,
  variant = "cyan", // cyan, green, red, purple, outline
  size = "md", // sm, md, lg
  loading = false,
  disabled = false,
  className = "",
  type = "button",
  icon: Icon = null,
}) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs font-mono tracking-wider",
    md: "px-5 py-2.5 text-sm font-mono tracking-widest font-semibold",
    lg: "px-8 py-3.5 text-base font-mono tracking-widest font-bold",
  }[size];

  const variantClasses = {
    cyan: "bg-cyan-950/40 text-cyan-400 border border-cyan-400/60 hover:bg-cyan-400 hover:text-black hover:shadow-[0_0_20px_rgba(0,240,255,0.6)] active:scale-[0.98]",
    green: "bg-emerald-950/40 text-emerald-400 border border-emerald-400/60 hover:bg-emerald-400 hover:text-black hover:shadow-[0_0_20px_rgba(0,255,102,0.6)] active:scale-[0.98]",
    red: "bg-rose-950/40 text-rose-400 border border-rose-400/60 hover:bg-rose-400 hover:text-black hover:shadow-[0_0_20px_rgba(255,0,85,0.6)] active:scale-[0.98]",
    purple: "bg-purple-950/40 text-purple-400 border border-purple-400/60 hover:bg-purple-400 hover:text-black hover:shadow-[0_0_20px_rgba(157,0,255,0.6)] active:scale-[0.98]",
    outline: "bg-black/50 text-slate-300 border border-slate-700 hover:border-cyan-500 hover:text-cyan-400 active:scale-[0.98]",
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`relative inline-flex items-center justify-center transition-all duration-200 uppercase cyber-clip ${sizeClasses} ${variantClasses} ${
        disabled || loading ? "opacity-50 cursor-not-allowed hover:bg-transparent" : "cursor-pointer"
      } ${className}`}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>INITIALIZING...</span>
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4" />}
          <span>{children}</span>
        </span>
      )}
    </button>
  );
}
