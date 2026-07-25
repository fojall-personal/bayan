'use client';

import { Dashboard } from '@/components/dashboard/Dashboard';

/**
 * Module 05's dashboard existed as an unrouted file — the plan marked the module
 * complete while nothing could reach it. /api/progress/dashboard works as of
 * Stage 2, so it now has something to render.
 */
export default function DashboardPage() {
  return <Dashboard />;
}
