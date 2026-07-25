import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Nav } from '@/components/layout/Nav';

export const metadata: Metadata = {
  title: 'Bayan — Classical Arabic & Quran Learning',
  description: 'Learn Classical Arabic, master Quran grammar, and track your memorization',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bayan',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#071411" />
      </head>
      <body className="min-h-screen bg-ground-950 font-body text-ground-50 antialiased">
        <Nav />
        <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
