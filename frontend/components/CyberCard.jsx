"use client";

import React from "react";

export default function CyberCard({
  children,
  title,
  subtitle,
  badge,
  glowColor = "cyan", // cyan, green, purple, red
  className = "",
  headerRight,
}) {
  const borderColors = {
    cyan: "border-cyan-500/30 shadow-[0_0_15px_rgba(0,240,255,0.07)]",
    green: "border-emerald-500/30 shadow-[0_0_15px_rgba(0,255,102,0.07)]",
    purple: "border-purple-500/30 shadow-[0_0_15px_rgba(157,0,255,0.07)]",
    red: "border-rose-500/30 shadow-[0_0_15px_rgba(255,0,85,0.07)]",
  }[glowColor];

  const cornerColors = {
    cyan: "border-cyan-400",
    green: "border-emerald-400",
    purple: "border-purple-400",
    red: "border-rose-400",
  }[glowColor];

  return (
    <div className={`relative glass-panel rounded-none border ${borderColors} ${className}`}>
      {/* Decorative Cyber Corner Brackets */}
      <div className={`absolute -top-[1px] -left-[1px] w-3 h-3 border-t-2 border-l-2 ${cornerColors}`} />
      <div className={`absolute -top-[1px] -right-[1px] w-3 h-3 border-t-2 border-r-2 ${cornerColors}`} />
      <div className={`absolute -bottom-[1px] -left-[1px] w-3 h-3 border-b-2 border-l-2 ${cornerColors}`} />
      <div className={`absolute -bottom-[1px] -right-[1px] w-3 h-3 border-b-2 border-r-2 ${cornerColors}`} />

      {/* Header bar if provided */}
      {(title || subtitle || badge || headerRight) && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-500/20 bg-cyan-950/20">
          <div>
            <div className="flex items-center gap-2">
              {badge && (
                <span className="px-1.5 py-0.5 text-[10px] uppercase font-mono tracking-widest bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {badge}
                </span>
              )}
              {title && (
                <h3 className="font-mono text-sm tracking-wider uppercase text-cyan-300 font-semibold">
                  {title}
                </h3>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-400 font-mono mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}

      {/* Content Area */}
      <div className="p-5">{children}</div>
    </div>
  );
}
