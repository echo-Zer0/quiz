"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, ExternalLink, QrCode } from "lucide-react";
import CyberButton from "./CyberButton";

export default function QRCodeDisplay({
  url,
  roomCode,
  size = 220,
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyLink = () => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 border border-cyan-500/40 bg-cyan-950/20 backdrop-blur-md">
      <div className="flex items-center gap-2 mb-4 text-cyan-400 font-mono text-sm tracking-widest uppercase">
        <QrCode className="w-5 h-5 text-cyan-400 animate-pulse" />
        <span>ROOM ACCESS TERMINAL</span>
      </div>

      {/* Large QR Display with High Contrast Border */}
      <div className="p-4 bg-white rounded-none shadow-[0_0_30px_rgba(0,240,255,0.4)] border-2 border-cyan-400">
        <QRCodeSVG
          value={url || `http://localhost:3000/join/${roomCode}`}
          size={size}
          level="H"
          includeMargin={true}
        />
      </div>

      {/* Room Code Badge */}
      <div className="mt-5 text-center">
        <div className="text-xs font-mono text-slate-400 uppercase tracking-widest">
          ROOM CODE
        </div>
        <div className="text-3xl md:text-4xl font-mono font-black text-cyan-300 glow-cyan tracking-[0.3em] my-1">
          {roomCode}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-4 w-full">
        <CyberButton
          size="sm"
          variant="outline"
          onClick={handleCopyCode}
          icon={copiedCode ? Check : Copy}
        >
          {copiedCode ? "CODE COPIED!" : "COPY ROOM CODE"}
        </CyberButton>

        <CyberButton
          size="sm"
          variant="cyan"
          onClick={handleCopyLink}
          icon={copiedLink ? Check : ExternalLink}
        >
          {copiedLink ? "LINK COPIED!" : "COPY JOIN LINK"}
        </CyberButton>
      </div>

      <p className="text-[11px] font-mono text-slate-400 mt-4 text-center max-w-xs">
        &gt; Participants can scan the QR code with any mobile camera or enter the room code manually at the landing page.
      </p>
    </div>
  );
}
