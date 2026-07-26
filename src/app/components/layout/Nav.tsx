'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Bayan wordmark: a gold eight-point star followed by the name set in the
 * display face.
 *
 * Two earlier attempts to make this an SVG were both wrong. The first set
 * viewBox="0 0 140 36" while the lower bowl of the B drew to y=38 with a 6px
 * stroke, so the letter was clipped, and put fontFamily="Reem Kufi" on an SVG
 * <text> that fell back to a generic serif because Reem Kufi was never
 * imported. The second hand-drew the letterforms as paths, which rendered as
 * "B AYAN" — mismatched shapes with a gap.
 *
 * Real text in the display face is the right answer: correct letterforms,
 * kerning handled by the font, and a graceful fall back down the stack rather
 * than to bad geometry.
 */
function BayanLogo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
        <path
          d="M12 0 L14.2 6.4 L20.5 3.5 L17.6 9.8 L24 12 L17.6 14.2 L20.5 20.5 L14.2 17.6 L12 24 L9.8 17.6 L3.5 20.5 L6.4 14.2 L0 12 L6.4 9.8 L3.5 3.5 L9.8 6.4 Z"
          fill="#c9a227"
        />
      </svg>
      <span className="font-display text-[1.375rem] font-semibold leading-none tracking-tight text-ground-50">
        Bayan
      </span>
    </span>
  );
}

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/learning', label: 'Learn' },
  { href: '/memorization', label: 'Memorize' },
  { href: '/tajweed', label: 'Tajweed' },
  { href: '/grammar', label: 'Grammar' },
  { href: '/tutor', label: 'Tutor' },
  { href: '/progress', label: 'Progress' },
  // /advanced existed but was absent from every nav and every in-page link, so
  // the only way to reach it was to type the URL.
  { href: '/advanced', label: 'Advanced' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // The mobile menu had aria-expanded but nothing else: Escape did not close it,
  // focus never entered it, and Tab walked straight past into the page behind
  // (audit BUG-014).
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>('a[href], button');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.querySelector<HTMLElement>('a[href]')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Close on navigation, or the panel stays open over the new page.
  useEffect(() => setOpen(false), [pathname]);

  // Was missing entirely: /tajweed, /grammar, /tutor and /advanced were
  // unreachable by clicking, and no link showed which page you were on.
  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-ground-800/80 bg-ground-950/85 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" aria-label="Bayan home" className="shrink-0">
            <BayanLogo />
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-gold-500/12 text-gold-400'
                    : 'text-ground-300 hover:bg-ground-800 hover:text-ground-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <button
            ref={toggleRef}
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            // 44x44 minimum: this measured 36x36, and it is the only way to
            // navigate on a phone. WCAG 2.5.5 and both platform HIGs put the
            // floor at 44.
            className="grid min-h-11 min-w-11 place-items-center rounded-md text-ground-300 transition-colors hover:bg-ground-800 hover:text-ground-50 md:hidden"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 7h16M4 12h16M4 17h16'}
              />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div
          id="mobile-nav"
          ref={panelRef}
          className="border-t border-ground-800 bg-ground-950 md:hidden"
        >
          <div className="space-y-1 px-3 py-3">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={`block rounded-md px-3 py-2.5 text-base font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-gold-500/12 text-gold-400'
                    : 'text-ground-300 hover:bg-ground-800 hover:text-ground-50'
                }`}
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
