'use client';

import Link from 'next/link';
import { useState } from 'react';

/* ── Bayan logo: wordmark with star dot on the B ── */
function BayanLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 36"
      width="140"
      height="36"
      className={className}
      aria-label="Bayan"
      role="img"
    >
      {/* Letter B — geometric, with star replacing the dot */}
      <g fill="#f5f5f5">
        {/* Vertical stem of B */}
        <rect x="2" y="2" width="6" height="32" rx="1.5" />
        {/* Top bowl */}
        <path d="M8 4 H24 C30 4, 32 8, 32 14 C32 19, 29 22, 24 22 H8" fill="none" stroke="#f5f5f5" strokeWidth="6" strokeLinecap="round" />
        {/* Bottom bowl */}
        <path d="M8 24 H26 C32 24, 34 28, 34 32 C34 36, 30 38, 26 38 H8" fill="none" stroke="#f5f5f5" strokeWidth="6" strokeLinecap="round" />
      </g>
      {/* Star dot replacing the dot of B */}
      <circle cx="5" cy="8" r="4" fill="#22c55e" />
      <circle cx="5" cy="8" r="1.8" fill="#0a0a0a" opacity="0.5" />
      {/* Accent line */}
      <line x1="40" y1="34" x2="80" y2="34" stroke="#22c55e" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
      {/* Wordmark: "ayan" */}
      <text x="44" y="27" fontFamily="'Reem Kufi', serif" fontSize="22" fontWeight="700" fill="#f5f5f5" letterSpacing="-0.5">ayan</text>
    </svg>
  );
}

export function Nav() {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { href: '/assessment', label: 'Assessment' },
    { href: '/learning', label: 'Learning' },
    { href: '/memorization', label: 'Memorization' },
    { href: '/progress', label: 'Progress' },
  ];

  return (
    <nav className="bg-gray-950/80 backdrop-blur border-b border-gray-800/60 fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" aria-label="Bayan home">
              <BayanLogo className="h-9 w-auto" />
            </Link>
          </div>
          
          {/* Desktop navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
            >
              <svg
                className="h-6 w-6"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}