"use client";

import { MetricCard } from "@/components/analytics/metric-card";
import { Users, FolderKanban, MessageSquare } from "lucide-react";

interface DashboardMetricsProps {
  memberCount: number;
  projectCount: number;
  promptCount: number;
  isAdmin: boolean;
}

export function DashboardMetrics({
  memberCount,
  projectCount,
  promptCount,
  isAdmin,
}: DashboardMetricsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        title="Team Members"
        value={memberCount}
        subtitle={isAdmin ? "You are an admin" : "You are a member"}
        icon={Users}
      />

      <MetricCard
        title="Projects"
        value={projectCount}
        subtitle="Active projects"
        icon={FolderKanban}
      />

      <MetricCard
        title="Prompts Captured"
        value={promptCount}
        subtitle="This month"
        icon={MessageSquare}
      />
    </div>
  );
}
