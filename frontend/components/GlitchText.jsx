"use client";

import React from "react";

export default function GlitchText({ text, as: Component = "h1", className = "" }) {
  return (
    <Component className={`relative font-black tracking-widest uppercase select-none ${className}`}>
      <span className="relative z-10 text-cyan-400 glow-cyan">{text}</span>
    </Component>
  );
}
