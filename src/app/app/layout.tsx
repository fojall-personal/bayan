import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Nav } from '@/components/layout/Nav';

export const metadata: Metadata = {
  title: 'Language Builder — Arabic Comprehension & Quran Learning',
  description: 'Learn Classical Arabic, master Quran grammar, and track your memorization',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Language Builder',
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
        <meta name="theme-color" content="#0c0a09" />
      </head>
      <body className="min-h-screen bg-gray-950 text-gray-50">
        <Nav />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 pt-24">
          {children}
        </main>
      </body>
    </html>
  );
}
