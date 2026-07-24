import type { Metadata } from 'next';

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
        <nav className="border-b border-gray-800 px-4 py-3 lg:px-6 lg:py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <a href="/" className="text-lg font-bold text-primary-500 lg:text-xl">
              Language Builder
            </a>
            {/* Mobile: hamburger, Desktop: link row */}
            <div className="hidden lg:flex gap-4">
              <a href="/assessment" className="text-sm text-gray-300 hover:text-gray-50 transition-colors">
                Assessment
              </a>
              <a href="/learning" className="text-sm text-gray-300 hover:text-gray-50 transition-colors">
                Learning
              </a>
              <a href="/memorization" className="text-sm text-gray-300 hover:text-gray-50 transition-colors">
                Memorization
              </a>
              <a href="/progress" className="text-sm text-gray-300 hover:text-gray-50 transition-colors">
                Progress
              </a>
            </div>
            <button className="lg:hidden text-gray-300" aria-label="Menu">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </nav>
        <main className="max-w-4xl mx-auto px-4 py-6 lg:px-6 lg:py-8">{children}</main>
      </body>
    </html>
  );
}
