import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Language Builder — Arabic Comprehension & Quran Learning',
  description: 'Learn Classical Arabic, master Quran grammar, and track your memorization',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <body className="min-h-screen bg-gray-950 text-gray-50">
        <nav className="border-b border-gray-800 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <a href="/" className="text-xl font-bold text-primary-500">
              Language Builder
            </a>
            <div className="flex gap-4">
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
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
