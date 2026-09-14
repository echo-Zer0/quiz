"use client";

import React from "react";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export default function OptionButton({
  index = 0,
  optionText,
  selected = false,
  disabled = false,
  onClick,
}) {
  const letter = OPTION_LETTERS[index] || `${index + 1}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative w-full text-left transition-all duration-150 border p-4 font-mono cyber-clip ${
        selected
          ? "bg-cyan-500/30 border-cyan-400 text-white shadow-[0_0_20px_rgba(0,240,255,0.4)]"
          : disabled
          ? "bg-slate-950/40 border-slate-800 text-slate-500 opacity-60 cursor-not-allowed"
          : "bg-slate-950/60 border-cyan-500/30 text-slate-200 hover:border-cyan-400 hover:bg-cyan-950/40 hover:text-white cursor-pointer"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Letter Badge */}
        <span
          className={`flex items-center justify-center w-8 h-8 font-bold border transition-colors ${
            selected
              ? "bg-cyan-400 text-black border-cyan-300"
              : "bg-cyan-950/60 text-cyan-400 border-cyan-500/40 group-hover:bg-cyan-400 group-hover:text-black"
          }`}
        >
          {letter}
        </span>

        {/* Option Content */}
        <span className="text-sm md:text-base font-semibold leading-relaxed flex-1">
          {optionText}
        </span>
      </div>
    </button>
  );
}
