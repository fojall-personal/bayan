'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { icon: '🏠', label: 'Dashboard', href: '/' },
  { icon: '📊', label: 'Assessment', href: '/assessment' },
  { icon: '📖', label: 'Learning', href: '/learning' },
  { icon: '🕌', label: 'Memorization', href: '/memorization' },
  { icon: '✍️', label: 'Grammar', href: '/grammar' },
  { icon: '🎯', label: 'Tajweed', href: '/tajweed' },
  { icon: '🤖', label: 'AI Tutor', href: '/tutor' },
  { icon: '📈', label: 'Progress', href: '/progress' },
  { icon: '⚙️', label: 'Settings', href: '/settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 top-0 bottom-0 w-[280px] bg-gray-900 border-r border-gray-800 p-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-arabic-green flex items-center justify-center text-xl">
          📚
        </div>
        <div>
          <div className="font-bold text-lg">Language Builder</div>
          <div className="text-xs text-gray-400">Arabic Learning</div>
        </div>
      </div>

      <ul className="space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-arabic-green/10 text-arabic-green-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-50'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
