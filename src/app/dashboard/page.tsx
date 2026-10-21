import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { WorkspaceService } from "@/services/workspace-service";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DecisionStatusBadge } from "@/components/ui/status-badge";
import {
  GitPullRequest,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Shield,
  Layers,
} from "lucide-react";

export default async function DashboardPage() {
  const workspace = await WorkspaceService.getOrCreateDefaultWorkspace();

  // Aggregate high level metrics
  const totalDecisions = await prisma.decision.count({
    where: { workspaceId: workspace.id },
  });

  const activeDecisions = await prisma.decision.count({
    where: {
      workspaceId: workspace.id,
      status: { in: ["DECIDED", "MONITORING"] },
    },
  });

  const reassessingDecisions = await prisma.decision.count({
    where: {
      workspaceId: workspace.id,
      status: { in: ["REASSESSING", "PROPOSED"] },
    },
  });

  const totalAssumptions = await prisma.assumption.count();
  const invalidatedAssumptions = await prisma.assumption.count({
    where: { status: "INVALID" },
  });

  const recentEvents = await prisma.decisionEvent.findMany({
    take: 5,
    orderBy: { occurredAt: "desc" },
    include: {
      decision: {
        select: { id: true, title: true },
      },
    },
  });

  const recentDecisions = await prisma.decision.findMany({
    where: { workspaceId: workspace.id },
    take: 4,
    orderBy: { updatedAt: "desc" },
    include: {
      creator: { select: { name: true } },
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-1">
            <span>WORKSPACE DASHBOARD</span>
            <span>•</span>
            <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{workspace.name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            System Intelligence Overview
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Monitor decision health, pending assumption reassessments, and architectural evolution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/decisions">
            <Button size="sm" variant="outline">
              View All Decisions
            </Button>
          </Link>
          <Link href="/decisions">
            <Button size="sm">New Decision Fossil</Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-mono uppercase">Total Preserved Fossils</CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight">{totalDecisions}</span>
              <Layers className="h-4 w-4 text-zinc-400" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-zinc-500">
            Tracked across full architectural lifecycle
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-mono uppercase">Active &amp; Monitoring</CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {activeDecisions}
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-zinc-500">
            Currently governed architectural decisions
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-mono uppercase">Reassessing / In Review</CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {reassessingDecisions}
              </span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-zinc-500">
            Requires engineering reassessment
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-mono uppercase">Assumptions Tracked</CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight">{totalAssumptions}</span>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-zinc-500">
            {invalidatedAssumptions} invalidated assumption signals
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid: Recent Decisions & Audit Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono uppercase">
              Recent Decisions
            </h3>
            <Link href="/decisions" className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
              Browse all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            {recentDecisions.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No decisions recorded yet. Head over to Decisions to record your first architectural fossil.
              </div>
            ) : (
              recentDecisions.map((d) => (
                <div key={d.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/decisions/${d.id}`}
                        className="text-sm font-semibold hover:underline text-zinc-900 dark:text-zinc-100"
                      >
                        {d.title}
                      </Link>
                      <DecisionStatusBadge status={d.status} size="sm" />
                    </div>
                    <p className="text-xs text-zinc-500 line-clamp-1">{d.statement}</p>
                    <div className="text-[11px] text-zinc-400 font-mono">
                      Owner: {d.creator?.name || "System"} • v{d.currentVersion}
                    </div>
                  </div>
                  <Link href={`/decisions/${d.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 text-xs">
                      Inspect
                    </Button>
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Audit Timeline Sidebar */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono uppercase">
            Audit Stream
          </h3>
          <Card>
            <CardContent className="p-4">
              {recentEvents.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-4">No events logged yet.</p>
              ) : (
                <div className="relative pl-4 space-y-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-200 dark:before:bg-zinc-800">
                  {recentEvents.map((evt) => (
                    <div key={evt.id} className="relative text-xs">
                      <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                      <p className="font-medium text-zinc-800 dark:text-zinc-200">{evt.title}</p>
                      {evt.detail && <p className="text-zinc-500 text-[11px] mt-0.5 line-clamp-2">{evt.detail}</p>}
                      <div className="text-[10px] text-zinc-400 font-mono mt-1">
                        {new Date(evt.occurredAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
