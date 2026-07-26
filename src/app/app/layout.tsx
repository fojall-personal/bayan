import type { Metadata } from 'next';
import {
  Amiri,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Noto_Naskh_Arabic,
  Reem_Kufi,
} from 'next/font/google';
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

/**
 * Arabic for INSTRUCTIONAL text — questions, tutor replies, vocabulary.
 *
 * Amiri stays the face for Quranic ayat, where it is the reference for Uthmani
 * script and handles stacked diacritics cleanly. But it has a small apparent
 * size on the em: at a given font-size it renders visibly smaller and tighter
 * than most faces, which reads as cramped in running UI text. That is what
 * "squished" was — not leading, which is already 2.1.
 *
 * Noto Naskh Arabic is considerably larger on the same em and is designed to stay
 * legible under full vocalisation, so it carries the teaching text while Amiri
 * carries the scripture.
 */
const naskh = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-naskh',
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
  // Generated from design/app-icon.svg by scripts/gen-icons.mjs. iOS picks the
  // closest size and applies its own squircle mask, which is why the source is
  // full-bleed with square corners.
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
      { url: '/apple-touch-icon-167.png', sizes: '167x167' },
      { url: '/apple-touch-icon-152.png', sizes: '152x152' },
      { url: '/apple-touch-icon-120.png', sizes: '120x120' },
    ],
  },
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
      className={`${arabic.variable} ${naskh.variable} ${display.variable} ${body.variable} ${mono.variable}`}
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
