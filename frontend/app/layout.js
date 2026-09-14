import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "RCSC Quiz Platform",
  description: "Advanced Cybersecurity Club Competition & Quiz Platform",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#050811] text-slate-200 cyber-grid scanlines">
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
        
        <footer className="border-t border-cyan-500/20 py-4 px-6 text-center text-xs font-mono text-slate-400 bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto gap-2">
            <div>
              &gt; CYBER DEFENSE COMPETITION SYSTEM // AUTHORITATIVE ENGINE ACTIVE
            </div>
            <div className="text-cyan-400">
              SYS STATUS: [ONLINE] // PROTOCOL: WS-AUTHORITATIVE
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
