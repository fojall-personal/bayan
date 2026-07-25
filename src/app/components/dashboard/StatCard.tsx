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
            trend.positive ? 'text-arabic-green' : 'text-error'
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
