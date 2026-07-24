'use client';

interface MemorizationEntryProps {
  entry: {
    surah_id: number;
    ayah_from: number;
    ayah_to: number;
    status: 'mastered' | 'learning' | 'reviewing' | 'new';
    next_review: string;
    audio_url?: string;
  };
  onClick: () => void;
}

export function MemorizationEntry({ entry, onClick }: MemorizationEntryProps) {
  const statusColors: Record<string, string> = {
    mastered: 'bg-arabic-green/20 text-arabic-green border-arabic-green/30',
    learning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    reviewing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    new: 'bg-gray-700 text-gray-400 border-gray-600',
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 border rounded-lg cursor-pointer hover:scale-[1.02] transition-all ${
        statusColors[entry.status]
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Surah {entry.surah_id}</div>
          <div className="text-sm opacity-80">Ayahs {entry.ayah_from}-{entry.ayah_to}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium capitalize">{entry.status}</div>
          {entry.next_review && (
            <div className="text-xs opacity-70">
              Next: {new Date(entry.next_review).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
