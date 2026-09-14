"use client";

import React, { useState, useEffect } from "react";

export default function TerminalText({
  lines = [],
  speed = 30,
  className = "",
  showCursor = true,
}) {
  const [displayedLines, setDisplayedLines] = useState([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);

  useEffect(() => {
    if (lines.length === 0) return;

    if (currentLineIndex < lines.length) {
      const currentFullLine = lines[currentLineIndex];
      if (currentCharIndex < currentFullLine.length) {
        const timeout = setTimeout(() => {
          setDisplayedLines((prev) => {
            const next = [...prev];
            next[currentLineIndex] = currentFullLine.slice(0, currentCharIndex + 1);
            return next;
          });
          setCurrentCharIndex((prev) => prev + 1);
        }, speed);
        return () => clearTimeout(timeout);
      } else {
        // Move to next line
        const lineTimeout = setTimeout(() => {
          setCurrentLineIndex((prev) => prev + 1);
          setCurrentCharIndex(0);
        }, speed * 2);
        return () => clearTimeout(lineTimeout);
      }
    }
  }, [lines, currentLineIndex, currentCharIndex, speed]);

  return (
    <div className={`font-mono text-sm space-y-1 text-cyan-400 ${className}`}>
      {displayedLines.map((line, idx) => (
        <div key={idx} className="flex items-start">
          <span className="text-cyan-600 select-none mr-2">&gt;</span>
          <span className="break-all">{line}</span>
        </div>
      ))}
      {showCursor && (
        <span className="inline-block w-2.5 h-4 bg-cyan-400 animate-cursor ml-1 align-middle" />
      )}
    </div>
  );
}
