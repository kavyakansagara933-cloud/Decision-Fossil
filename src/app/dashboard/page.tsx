import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { WorkspaceService } from "@/services/workspace-service";
import { AssumptionService } from "@/services/assumption-service";
import { HealthService } from "@/services/health-service";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DecisionStatusBadge } from "@/components/ui/status-badge";
import {
  Layers,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  HelpCircle,
  Plus,
  Scale,
  Sparkles,
  GitBranch,
  Activity,
  Calendar,
  ExternalLink,
} from "lucide-react";

export default async function DashboardPage() {
  const workspace = await WorkspaceService.getOrCreateDefaultWorkspace();

  // 1. Fetch Health Overview across workspace
  const healthOverview = await HealthService.getWorkspaceHealthOverview(workspace.id);

  // 2. Aggregate decision lifecycle metrics
  const totalDecisions = await prisma.decision.count({
    where: { workspaceId: workspace.id, archivedAt: null },
  });

  const activeDecisions = await prisma.decision.count({
    where: {
      workspaceId: workspace.id,
      archivedAt: null,
      status: { in: ["DECIDED", "MONITORING"] },
    },
  });

  const reassessingCount = await prisma.decision.count({
    where: {
      workspaceId: workspace.id,
      archivedAt: null,
      status: "REASSESSING",
    },
  });

  const proposedCount = await prisma.decision.count({
    where: {
      workspaceId: workspace.id,
      archivedAt: null,
      status: "PROPOSED",
    },
  });

  // 3. Assumption Intelligence & Review Stats
  const assumptionStats = await AssumptionService.getAssumptionStats(workspace.id);
  const overdueAssumptions = await AssumptionService.listAssumptions({
    workspaceId: workspace.id,
    isOverdue: true,
  });

  // 4. Decisions requiring engineering attention (from health overview + status)
  const atRiskDecisions = healthOverview.atRiskDecisions.slice(0, 4);

  // 5. Recent Decisions with relationship & version counts
  const recentDecisions = await prisma.decision.findMany({
    where: { workspaceId: workspace.id, archivedAt: null },
    take: 6,
    orderBy: { updatedAt: "desc" },
    include: {
      creator: { select: { name: true } },
      assumptions: true,
      alternatives: true,
      outcomes: true,
      sourceRelationships: true,
    },
  });

  // 6. Recent Audit Events from timeline
  const recentEvents = await prisma.decisionEvent.findMany({
    take: 7,
    orderBy: { occurredAt: "desc" },
    include: {
      decision: {
        select: { id: true, title: true },
      },
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      {/* Workspace Header & Action Hub */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-1">
            <span>DECISION INTELLIGENCE PLATFORM</span>
            <span>•</span>
            <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{workspace.name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 flex items-center gap-2.5">
            <Activity className="h-6 w-6 text-blue-500" />
            Decision Health &amp; Architecture Command Center
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Preserve reasoning, monitor assumption drift, prevent architectural regressions, and maintain defensibility.
          </p>
        </div>

        {/* Quick Actions Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/decisions/extract">
            <Button size="sm" variant="outline" className="text-xs gap-1.5 h-8">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> AI Reasoning Extract
            </Button>
          </Link>
          <Link href="/decisions/new">
            <Button size="sm" className="text-xs gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" /> Record Decision
            </Button>
          </Link>
        </div>
      </div>

      {/* Portfolio Defensibility & Health Overview Card */}
      <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-950/10">
        <CardHeader className="p-4 pb-3 border-b border-blue-100 dark:border-blue-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-blue-950 dark:text-blue-300">
                Portfolio Architecture Defensibility Score
              </CardTitle>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">
              Evaluated across {healthOverview.totalDecisions} active fossils
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
            {/* Average Score Gauge */}
            <div className="space-y-1 md:border-r border-zinc-200 dark:border-zinc-800 pr-4">
              <span className="text-xs font-mono uppercase text-zinc-400 block">Workspace Health Index</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-blue-600 dark:text-blue-400">
                  {healthOverview.averageScore}
                </span>
                <span className="text-xs font-mono text-zinc-400">/ 100</span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden mt-1">
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${Math.max(5, healthOverview.averageScore)}%` }}
                />
              </div>
            </div>

            {/* Health Distribution Pills */}
            <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-center">
                <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 uppercase block font-semibold">
                  Healthy
                </span>
                <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-300">
                  {healthOverview.distribution.HEALTHY}
                </span>
                <span className="text-[9px] text-zinc-400 block mt-0.5">80-100 pts</span>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-center">
                <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 uppercase block font-semibold">
                  Attention
                </span>
                <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-300">
                  {healthOverview.distribution.NEEDS_ATTENTION}
                </span>
                <span className="text-[9px] text-zinc-400 block mt-0.5">60-79 pts</span>
              </div>

              <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 text-center">
                <span className="text-[10px] font-mono text-orange-700 dark:text-orange-400 uppercase block font-semibold">
                  At Risk
                </span>
                <span className="text-xl font-bold font-mono text-orange-600 dark:text-orange-300">
                  {healthOverview.distribution.AT_RISK}
                </span>
                <span className="text-[9px] text-zinc-400 block mt-0.5">40-59 pts</span>
              </div>

              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 text-center">
                <span className="text-[10px] font-mono text-rose-700 dark:text-rose-400 uppercase block font-semibold">
                  Critical
                </span>
                <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-300">
                  {healthOverview.distribution.CRITICAL}
                </span>
                <span className="text-[9px] text-zinc-400 block mt-0.5">&lt; 40 pts</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Row: Lifecycle & Drift */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-mono uppercase">Total Decisions</CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight">{totalDecisions}</span>
              <Layers className="h-4 w-4 text-zinc-400" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-zinc-500">
            {proposedCount} proposed, {reassessingCount} in reassessment
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-mono uppercase">Active Decisions</CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {activeDecisions}
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-zinc-500">
            Decided or currently monitored in production
          </CardContent>
        </Card>

        <Card className={assumptionStats.challenged > 0 ? "border-amber-300 dark:border-amber-800/80 bg-amber-50/20 dark:bg-amber-950/10" : ""}>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-mono uppercase text-amber-700 dark:text-amber-400">
              Challenged Premises
            </CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {assumptionStats.challenged}
              </span>
              <HelpCircle className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-zinc-500">
            Assumptions showing empirical friction
          </CardContent>
        </Card>

        <Card className={assumptionStats.invalidated > 0 ? "border-rose-300 dark:border-rose-800/80 bg-rose-50/20 dark:bg-rose-950/10" : ""}>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-mono uppercase text-rose-700 dark:text-rose-400">
              Invalidated Assumptions
            </CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                {assumptionStats.invalidated}
              </span>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-zinc-500">
            Premises falsified by observations
          </CardContent>
        </Card>
      </div>

      {/* At-Risk Decisions Spotlight Section */}
      {atRiskDecisions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-rose-700 dark:text-rose-400 font-mono uppercase flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" /> Decisions Requiring Urgent Engineering Attention ({atRiskDecisions.length})
            </h3>
            <span className="text-[11px] text-zinc-400 font-mono">Triggered by invalidated assumptions or failed telemetry</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {atRiskDecisions.map((d: any) => (
              <div
                key={d.id}
                className="p-4 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/15 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Badge variant="destructive" size="sm" className="font-mono text-[10px]">
                      {d.healthStatus}
                    </Badge>
                    <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400">
                      Score: {d.healthScore}/100
                    </span>
                  </div>
                  <Link
                    href={`/decisions/${d.id}`}
                    className="text-sm font-semibold hover:underline line-clamp-1 block text-zinc-900 dark:text-zinc-100"
                  >
                    {d.title}
                  </Link>
                  <p className="text-[11px] text-zinc-500 line-clamp-2">
                    {d.invalidatedAssumptions > 0
                      ? `Compromised by ${d.invalidatedAssumptions} invalidated assumption(s)`
                      : d.overdueAssumptions > 0
                      ? `${d.overdueAssumptions} review deadlines expired`
                      : "Defensibility deductions detected"}
                  </p>
                </div>
                <Link href={`/decisions/${d.id}`}>
                  <Button size="sm" variant="outline" className="w-full text-xs h-8 border-rose-300 text-rose-700 dark:text-rose-300">
                    Reassess Decision <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assumption Intelligence & Review Summary */}
      <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono uppercase flex items-center gap-2">
              <Scale className="h-4 w-4 text-indigo-500" />
              Assumption Intelligence &amp; Horizon Review Health
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Continuously verifies whether foundational hypotheses across all architecture fossils remain supported by empirical evidence.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              Total: <strong>{assumptionStats.total}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              Untested: <strong>{assumptionStats.untested}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              Supported: <strong>{assumptionStats.supported + assumptionStats.confirmed}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              Challenged: <strong>{assumptionStats.challenged}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
              Invalidated: <strong>{assumptionStats.invalidated}</strong>
            </span>
            {assumptionStats.overdue > 0 && (
              <span className="px-2.5 py-1 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 font-semibold border border-rose-300 dark:border-rose-800 animate-pulse">
                Overdue: {assumptionStats.overdue}
              </span>
            )}
          </div>
        </div>

        {overdueAssumptions.length > 0 ? (
          <div className="space-y-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <h4 className="text-xs font-semibold text-rose-700 dark:text-rose-400 font-mono uppercase flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Assumptions Past Review Deadline ({overdueAssumptions.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {overdueAssumptions.slice(0, 4).map((a: any) => {
                const targetDecision = a.decisions?.[0]?.decision;
                return (
                  <div
                    key={a.id}
                    className="p-3 rounded-lg bg-white dark:bg-zinc-950 border border-rose-200 dark:border-rose-900/40 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1">{a.statement}</p>
                      {targetDecision && (
                        <p className="text-[11px] text-zinc-500 font-mono">
                          Decision: <span className="font-medium">{targetDecision.title}</span>
                        </p>
                      )}
                      <p className="text-[10px] text-rose-600 dark:text-rose-400 font-mono">
                        Deadline: {a.reviewDate ? new Date(a.reviewDate).toLocaleDateString() : "Immediate"}
                      </p>
                    </div>
                    {targetDecision && (
                      <Link href={`/decisions/${targetDecision.id}`}>
                        <Button size="sm" variant="outline" className="h-7 text-[11px] px-2 shrink-0">
                          Review
                        </Button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-500 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            ✓ All assumption reviews are currently up to date. No overdue deadlines.
          </p>
        )}
      </div>

      {/* Main Content Grid: Recent Decisions & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono uppercase">
              Recent Decisions &amp; Fossils
            </h3>
            <Link href="/decisions" className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
              Browse all decisions <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            {recentDecisions.map((d) => (
              <div key={d.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                <div className="space-y-1 pr-4">
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
                  <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-3 pt-0.5">
                    <span>Owner: {d.creator?.name || "Architect"}</span>
                    <span>•</span>
                    <span>v{d.currentVersion}</span>
                    <span>•</span>
                    <span>{d.alternatives.length} Alternatives</span>
                    <span>•</span>
                    <span>{d.assumptions.length} Assumptions</span>
                    {d.sourceRelationships.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-blue-500">
                          <GitBranch className="h-3 w-3" /> {d.sourceRelationships.length} Links
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/decisions/${d.id}/graph`}>
                    <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" title="View Graph">
                      <GitBranch className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Link href={`/decisions/${d.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 text-xs shrink-0">
                      Inspect
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Timeline Sidebar */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono uppercase">
              Recent Activity Stream
            </h3>
            <span className="text-[11px] text-zinc-400 font-mono">Live Audit</span>
          </div>

          <Card>
            <CardContent className="p-4">
              {recentEvents.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-4">No events logged yet.</p>
              ) : (
                <div className="relative pl-4 space-y-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-200 dark:before:bg-zinc-800">
                  {recentEvents.map((evt) => (
                    <div key={evt.id} className="relative text-xs">
                      <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-600 ring-2 ring-white dark:ring-zinc-950" />
                      <p className="font-medium text-zinc-800 dark:text-zinc-200">{evt.title}</p>
                      {evt.detail && <p className="text-zinc-500 text-[11px] mt-0.5 line-clamp-2">{evt.detail}</p>}
                      <div className="text-[10px] text-zinc-400 font-mono mt-1 flex items-center justify-between">
                        <span>{new Date(evt.occurredAt).toLocaleDateString()}</span>
                        {evt.decision && (
                          <Link href={`/decisions/${evt.decision.id}`} className="hover:underline text-blue-500 truncate max-w-[120px]">
                            {evt.decision.title}
                          </Link>
                        )}
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
