'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileCheck,
  BookOpen,
  Repeat,
  Type,
  BookMarked,
  Bot,
  BarChart3,
  Settings,
} from 'lucide-react';

const iconMap = {
  LayoutDashboard,
  FileCheck,
  BookOpen,
  Repeat,
  Type,
  BookMarked,
  Bot,
  BarChart3,
  Settings,
};

const navItems = [
  { icon: 'LayoutDashboard', label: 'Dashboard', href: '/' },
  { icon: 'FileCheck', label: 'Assessment', href: '/assessment' },
  { icon: 'BookOpen', label: 'Learning', href: '/learning' },
  { icon: 'Repeat', label: 'Memorization', href: '/memorization' },
  { icon: 'Type', label: 'Grammar', href: '/grammar' },
  { icon: 'BookMarked', label: 'Tajweed', href: '/tajweed' },
  { icon: 'Bot', label: 'AI Tutor', href: '/tutor' },
  { icon: 'BarChart3', label: 'Progress', href: '/progress' },
  { icon: 'Settings', label: 'Settings', href: '/settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 top-0 bottom-0 w-[280px] bg-surface border-r border-border p-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-bold text-lg">Language Builder</div>
          <div className="text-xs text-muted">Arabic Learning</div>
        </div>
      </div>

      <ul className="space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = iconMap[item.icon as keyof typeof iconMap];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-primary-500/10 text-primary-400'
                    : 'text-muted hover:bg-surface-2 hover:text-ink'
                }`}
              >
                {Icon && <Icon className="w-5 h-5" />}
                <span className="font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
