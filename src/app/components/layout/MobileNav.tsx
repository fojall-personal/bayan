'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileCheck,
  BookOpen,
  Repeat,
  BarChart3,
} from 'lucide-react';

const iconMap = {
  LayoutDashboard,
  FileCheck,
  BookOpen,
  Repeat,
  BarChart3,
};

const navItems = [
  { icon: 'LayoutDashboard', label: 'Home', href: '/' },
  { icon: 'FileCheck', label: 'Assess', href: '/assessment' },
  { icon: 'BookOpen', label: 'Learn', href: '/learning' },
  { icon: 'Repeat', label: 'Hifz', href: '/memorization' },
  { icon: 'BarChart3', label: 'Progress', href: '/progress' },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-2 flex justify-around md:hidden z-50">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = iconMap[item.icon as keyof typeof iconMap];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${
              isActive
                ? 'text-primary-400'
                : 'text-muted hover:text-ink'
            }`}
          >
            {Icon && <Icon className="w-5 h-5" />}
            <span className="text-[10px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
