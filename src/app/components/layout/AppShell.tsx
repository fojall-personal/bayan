'use client';

interface AppShellProps {
  children: React.ReactNode;
  sidebar?: boolean;
}

export function AppShell({ children, sidebar = true }: AppShellProps) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-50">
      {sidebar && <Sidebar />}
      <main className={sidebar ? 'ml-[280px]' : ''}>
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
