import type { Metadata } from 'next';
import { Amiri, IBM_Plex_Mono, IBM_Plex_Sans, Reem_Kufi } from 'next/font/google';
import '@/styles/globals.css';
import { Nav } from '@/components/layout/Nav';

/**
 * Fonts are self-hosted by next/font, downloaded at build time and emitted as
 * static assets alongside the export.
 *
 * This replaces an @import of fonts.googleapis.com in globals.css, which had two
 * problems. It sat below @tailwind, so in the built CSS it followed 392 style
 * rules — and an @import after a style rule is invalid per spec and silently
 * dropped, meaning no webfont loaded in production at all. And even correctly
 * ordered it costs a render-blocking round trip to a third party. Self-hosting
 * makes that entire class of bug impossible: there is no import to misorder and
 * no external request to fail.
 */
const arabic = Amiri({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-arabic',
});

const display = Reem_Kufi({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-display',
});

const body = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-body',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Bayan — Classical Arabic & Quran',
  description:
    'Learn Classical Arabic, understand Quranic grammar, and memorise with meaning alongside recall',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bayan',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${arabic.variable} ${display.variable} ${body.variable} ${mono.variable}`}
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#071411" />
      </head>
      <body className="min-h-screen bg-ground-950 font-body text-ground-50 antialiased">
        <Nav />
        <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
