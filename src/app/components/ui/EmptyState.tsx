'use client';

import { Button } from '../ui/Button';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400 mb-6 max-w-md mx-auto">{description}</p>
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
