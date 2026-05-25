import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from 'next/link';
import { Film, SquarePlay, FolderGit2 } from 'lucide-react';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CineForge - Your AI Edit Director for Cinematic Short-Form Videos",
  description: "Upload your media, choose a CineForge mode, activate Max Quality Mode, and generate a cinematic edit blueprint with cuts, speed ramps, and VFX direction.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-space-black text-gray-200">
        {/* Global Navigation Header */}
        <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-space-black/85 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group cursor-pointer">
              <div className="p-1.5 rounded-lg bg-gradient-to-tr from-brand-cyan to-brand-violet text-space-black group-hover:shadow-[0_0_15px_rgba(0,243,255,0.4)] transition-all">
                <Film className="w-5 h-5" />
              </div>
              <span className="font-bold tracking-wider text-base md:text-lg text-white font-mono">
                CINE<span className="text-brand-cyan text-glow-cyan">FORGE</span>
              </span>
            </Link>

            {/* Navigation links */}
            <nav className="flex items-center gap-1.5 sm:gap-4 md:gap-6">
              <Link
                href="/studio"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold text-gray-300 hover:text-brand-cyan hover:bg-white/5 transition-all cursor-pointer"
              >
                <SquarePlay className="w-4 h-4 shrink-0" />
                <span>Studio</span>
              </Link>
              <Link
                href="/projects"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold text-gray-300 hover:text-brand-cyan hover:bg-white/5 transition-all cursor-pointer"
              >
                <FolderGit2 className="w-4 h-4 shrink-0" />
                <span>Projects</span>
              </Link>
              
              {/* Enter Studio CTA button */}
              <Link
                href="/studio"
                className="hidden sm:inline-flex px-4 py-1.5 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-violet hover:from-brand-cyan hover:to-brand-magenta text-space-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_10px_rgba(0,243,255,0.1)] cursor-pointer"
              >
                Enter Studio
              </Link>
            </nav>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
