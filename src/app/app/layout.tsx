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
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #0c0a09;
            color: #f9fafb;
            line-height: 1.6;
          }
          nav {
            background: rgba(17, 24, 39, 0.8);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid #1f2937;
            position: sticky;
            top: 0;
            z-index: 50;
          }
          .nav-container {
            max-width: 80rem;
            margin: 0 auto;
            padding: 0 1rem;
          }
          .nav-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 4rem;
          }
          .nav-title {
            font-size: 1.25rem;
            font-weight: 700;
            color: #22c55e;
            text-decoration: none;
            transition: color 0.2s;
          }
          .nav-title:hover {
            color: #4ade80;
          }
          .nav-links {
            display: none;
            gap: 0.25rem;
          }
          .nav-link {
            color: #d1d5db;
            text-decoration: none;
            padding: 0.5rem 0.75rem;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            font-weight: 500;
            transition: all 0.2s;
          }
          .nav-link:hover {
            color: #4ade80;
            background: rgba(34, 197, 94, 0.1);
          }
          @media (min-width: 768px) {
            .nav-links {
              display: flex;
              gap: 0.25rem;
            }
          }
          .mobile-menu-btn {
            color: #d1d5db;
            background: none;
            border: none;
            cursor: pointer;
            padding: 0.5rem;
          }
          main {
            max-width: 80rem;
            margin: 0 auto;
            padding: 1.5rem;
          }
          @media (min-width: 1024px) {
            main {
              padding: 2rem;
            }
          }
          .goal-container {
            min-height: 60vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .goal-card {
            background: #1f2937;
            border-radius: 0.75rem;
            padding: 2rem;
            max-width: 28rem;
            width: 100%;
          }
          .goal-title {
            font-size: 1.875rem;
            font-weight: 700;
            margin-bottom: 1.5rem;
            color: #f9fafb;
          }
          .goal-options {
            display: grid;
            gap: 0.75rem;
            margin-bottom: 1.5rem;
          }
          .goal-option {
            background: #374151;
            border: 2px solid #4b5563;
            border-radius: 0.5rem;
            padding: 1rem;
            cursor: pointer;
            transition: all 0.2s;
          }
          .goal-option:hover {
            background: #4b5563;
            border-color: #22c55e;
          }
          .goal-option:active {
            background: #6b7280;
          }
          .btn {
            background: #22c55e;
            color: #0c0a09;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            font-weight: 600;
            font-size: 1rem;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
          }
          .btn:hover {
            background: #4ade80;
          }
          .btn:active {
            background: #16a34a;
          }
          .loading-text {
            color: #9ca3af;
            text-align: center;
          }
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
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
