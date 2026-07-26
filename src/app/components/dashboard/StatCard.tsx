'use client';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  trend?: { value: number; positive: boolean };
}

export function StatCard({ label, value, icon, trend }: StatCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      {trend && (
        <div
          className={`mt-3 flex items-center gap-1 text-sm ${
            // `arabic-green` is not in the palette — globals.css lists it as a
            // known dead token, and ProgressBar and Badge were already cleaned of
            // it. Tailwind emits nothing for an undefined token, so a POSITIVE
            // trend was rendering with no colour at all while a negative one went
            // red. leaf-400 is the palette's positive green.
            trend.positive ? 'text-leaf-400' : 'text-error'
          }`}
        >
          <span>{trend.positive ? '↑' : '↓'}</span>
          <span>{Math.abs(trend.value)}%</span>
          <span className="text-gray-500">vs last week</span>
        </div>
      )}
    </div>
  );
}
