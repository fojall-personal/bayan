'use client';

import { Badge } from '../ui/Badge';
import { ProgressBar } from '../ui/ProgressBar';

interface LessonCardProps {
  lesson: {
    id: string;
    title: string;
    module: string;
    level: number;
    estimated_minutes: number;
    completed?: boolean;
    current_step?: number;
    total_steps?: number;
  };
  onClick: () => void;
}

export function LessonCard({ lesson, onClick }: LessonCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-arabic-green/50 hover:shadow-glow transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <Badge variant={lesson.completed ? 'success' : 'info'}>
          {lesson.module}
        </Badge>
        {lesson.completed && (
          <span className="text-arabic-green text-lg">✓</span>
        )}
      </div>

      <h3 className="font-semibold text-lg mb-2 group-hover:text-arabic-green transition-colors">
        {lesson.title}
      </h3>

      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>Level {lesson.level}</span>
        <span>{lesson.estimated_minutes} min</span>
      </div>

      {lesson.current_step && lesson.total_steps && (
        <div className="mt-3">
          <ProgressBar
            progress={(lesson.current_step / lesson.total_steps) * 100}
            tone="leaf"
          />
        </div>
      )}
    </div>
  );
}
