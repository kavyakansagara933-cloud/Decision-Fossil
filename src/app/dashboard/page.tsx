import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { WorkspaceService } from "@/services/workspace-service";
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
  HelpCircle,
  Plus,
  Scale,
  Sparkles,
} from "lucide-react";

export default async function DashboardPage() {
  const workspace = await WorkspaceService.getOrCreateDefaultWorkspace();

  // Aggregate metrics
  const totalDecisions = await prisma.decision.count({
    where: { workspaceId: workspace.id },
  });

  const activeDecisions = await prisma.decision.count({
    where: {
      workspaceId: workspace.id,
      status: { in: ["DECIDED", "MONITORING"] },
    },
  });

  const decisionsRequiringReview = await prisma.decision.count({
    where: {
      workspaceId: workspace.id,
      OR: [
        { status: { in: ["REASSESSING", "PROPOSED"] } },
        { reviewDate: { lte: new Date() } },
        { assumptions: { some: { assumption: { status: { in: ["INVALID", "QUESTIONABLE"] } } } } },
      ],
    },
  });

  const questionableAssumptionsCount = await prisma.assumption.count({
    where: { status: "QUESTIONABLE" },
  });

  const invalidAssumptionsCount = await prisma.assumption.count({
    where: { status: "INVALID" },
  });

  // Decisions needing immediate attention
  const attentionDecisions = await prisma.decision.findMany({
    where: {
      workspaceId: workspace.id,
      OR: [
        { status: "REASSESSING" },
        { assumptions: { some: { assumption: { status: "INVALID" } } } },
        { reviewDate: { lte: new Date() } },
      ],
    },
    take: 3,
    orderBy: { updatedAt: "desc" },
    include: {
      creator: { select: { name: true } },
      assumptions: { include: { assumption: true } },
      outcomes: true,
    },
  });

  const recentDecisions = await prisma.decision.findMany({
    where: { workspaceId: workspace.id },
    take: 5,
    orderBy: { updatedAt: "desc" },
    include: {
      creator: { select: { name: true } },
      assumptions: true,
      alternatives: true,
      outcomes: true,
    },
  });

  const recentEvents = await prisma.decisionEvent.findMany({
    take: 6,
    orderBy: { occurredAt: "desc" },
    include: {
      decision: {
        select: { id: true, title: true },
      },
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
            Decision Health &amp; Attention Center
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Track active choices, monitor assumption drift, and review decisions requiring engineering attention.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/decisions">
            <Button size="sm" variant="outline" className="text-xs">
              View All Decisions
            </Button>
          </Link>
          <Link href="/decisions/new">
            <Button size="sm" className="text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Decision Wizard
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row: Answers "What decisions need attention?" */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-mono uppercase">Total Decisions</CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight">{totalDecisions}</span>
              <Layers className="h-4 w-4 text-zinc-400" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-zinc-500">
            Recorded in this repository
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
            Decided or currently monitored
          </CardContent>
        </Card>

        <Card className={decisionsRequiringReview > 0 ? "border-amber-300 dark:border-amber-800/80 bg-amber-50/20 dark:bg-amber-950/10" : ""}>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-mono uppercase text-amber-700 dark:text-amber-400">
              Needs Attention
            </CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {decisionsRequiringReview}
              </span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-zinc-500">
            Reassessing, expired, or drifted
          </CardContent>
        </Card>

        <Card className={questionableAssumptionsCount > 0 ? "border-amber-300 dark:border-amber-800/80 bg-amber-50/20 dark:bg-amber-950/10" : ""}>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-mono uppercase text-amber-700 dark:text-amber-400">
              Drifting Assumptions
            </CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {questionableAssumptionsCount}
              </span>
              <HelpCircle className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-zinc-500">
            Marked as Questionable
          </CardContent>
        </Card>

        <Card className={invalidAssumptionsCount > 0 ? "border-rose-300 dark:border-rose-800/80 bg-rose-50/20 dark:bg-rose-950/10" : ""}>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-mono uppercase text-rose-700 dark:text-rose-400">
              Invalid Assumptions
            </CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                {invalidAssumptionsCount}
              </span>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-zinc-500">
            Premises falsified by reality
          </CardContent>
        </Card>
      </div>

      {/* Attention Section: Decisions Needing Action */}
      {attentionDecisions.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-rose-700 dark:text-rose-400 font-mono uppercase flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" /> Decisions Requiring Engineering Attention
            </h3>
            <span className="text-[11px] text-zinc-400">Triggered by invalidated assumptions or review deadlines</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {attentionDecisions.map((d) => {
              const invalidAssump = d.assumptions.find((a: any) => a.assumption.status === "INVALID");
              return (
                <div
                  key={d.id}
                  className="p-4 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/15 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <DecisionStatusBadge status={d.status} size="sm" />
                      <span className="text-[10px] font-mono text-zinc-400">v{d.currentVersion}</span>
                    </div>
                    <Link
                      href={`/decisions/${d.id}`}
                      className="text-sm font-semibold hover:underline line-clamp-1 block text-zinc-900 dark:text-zinc-100"
                    >
                      {d.title}
                    </Link>
                    {invalidAssump && (
                      <p className="text-[11px] text-rose-700 dark:text-rose-300 font-mono line-clamp-2">
                        Falsified: &quot;{invalidAssump.assumption.statement}&quot;
                      </p>
                    )}
                  </div>
                  <Link href={`/decisions/${d.id}`}>
                    <Button size="sm" variant="outline" className="w-full text-xs h-8 border-rose-300 text-rose-700 dark:text-rose-300">
                      Reassess Fossil <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Grid: Recent Decisions & Audit Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono uppercase">
              Recent Decisions
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
                  </div>
                </div>
                <Link href={`/decisions/${d.id}`}>
                  <Button variant="ghost" size="sm" className="h-8 text-xs shrink-0">
                    Inspect
                  </Button>
                </Link>
              </div>
            ))}
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
                      <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-600 ring-2 ring-white dark:ring-zinc-950" />
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
