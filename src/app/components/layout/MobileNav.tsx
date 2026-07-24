'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { icon: '🏠', label: 'Home', href: '/' },
  { icon: '📊', label: 'Assess', href: '/assessment' },
  { icon: '📖', label: 'Learn', href: '/learning' },
  { icon: '🕌', label: 'Hifz', href: '/memorization' },
  { icon: '📈', label: 'Progress', href: '/progress' },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-2 flex justify-around md:hidden z-50">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${
              isActive
                ? 'text-arabic-green-400'
                : 'text-gray-400 hover:text-gray-50'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
