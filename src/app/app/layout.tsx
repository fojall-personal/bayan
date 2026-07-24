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
        <style>{`
          :root {
            --color-primary-500: #22c55e;
            --color-primary-600: #16a34a;
            --color-gray-50: #f9fafb;
            --color-gray-300: #d1d5db;
            --color-gray-400: #9ca3af;
            --color-gray-500: #6b7280;
            --color-gray-700: #374151;
            --color-gray-800: #1f2937;
            --color-gray-900: #111827;
            --color-gray-950: #0c0a09;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--color-gray-950); color: var(--color-gray-50); }
          nav { border-bottom: 1px solid var(--color-gray-800); background: rgba(17, 24, 39, 0.5); backdrop-filter: blur(8px); }
          .nav-container { max-width: 7xl; margin: 0 auto; padding: 0 1rem; }
          .nav-content { display: flex; align-items: center; justify-content: space-between; height: 4rem; }
          .nav-title { font-size: 1.25rem; font-weight: bold; color: var(--color-primary-500); }
          .nav-links { display: none; }
          .nav-link { color: var(--color-gray-300); text-decoration: none; padding: 0.5rem 0.75rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; transition: color 0.2s; }
          .nav-link:hover { color: var(--color-primary-400); }
          @media (min-width: 768px) { .nav-links { display: flex; gap: 1rem; } }
          .mobile-menu-btn { color: var(--color-gray-300); background: none; border: none; cursor: pointer; }
          main { max-width: 7xl; margin: 0 auto; padding: 1.5rem; }
          @media (min-width: 1024px) { main { padding: 2rem 2rem; } }
        `}</style>
      </head>
      <body>
        <nav>
          <div className="nav-container">
            <div className="nav-content">
              <div>
                <a href="/" className="nav-title">Language Builder</a>
              </div>
              <div className="nav-links">
                <a href="/assessment" className="nav-link">Assessment</a>
                <a href="/learning" className="nav-link">Learning</a>
                <a href="/memorization" className="nav-link">Memorization</a>
                <a href="/progress" className="nav-link">Progress</a>
                <a href="/tajweed" className="nav-link">Tajweed</a>
                <a href="/grammar" className="nav-link">Grammar</a>
                <a href="/tutor" className="nav-link">AI Tutor</a>
              </div>
              <button className="mobile-menu-btn" aria-label="Toggle menu">
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
