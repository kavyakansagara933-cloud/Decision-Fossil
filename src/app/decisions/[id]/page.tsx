"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  User,
  History,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Layers,
  Sparkles,
  GitCommit,
  GitBranch,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DecisionStatusBadge } from "@/components/ui/status-badge";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { Input, Textarea } from "@/components/ui/input";

export default function DecisionDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { toast } = useToast();

  const [decision, setDecision] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status transition state
  const [isTransitionOpen, setIsTransitionOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState("DECIDED");
  const [statusReason, setStatusReason] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Assumption Reassessment state
  const [selectedAssumption, setSelectedAssumption] = useState<any>(null);
  const [reassessStatus, setReassessStatus] = useState("VALID");
  const [reassessState, setReassessState] = useState("");
  const [reassessReason, setReassessReason] = useState("");
  const [isSubmittingReassess, setIsSubmittingReassess] = useState(false);

  const fetchDecision = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/decisions/${id}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load decision");
      }
      setDecision(data.decision);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDecision();
  }, [id]);

  const handleStatusTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsUpdatingStatus(true);
      const res = await fetch(`/api/decisions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TRANSITION_STATUS",
          status: nextStatus,
          reason: statusReason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update lifecycle status");
      }

      toast({
        type: "success",
        title: "Lifecycle Transition Logged",
        message: `Decision moved to status: ${nextStatus}. Audit event recorded.`,
      });

      setIsTransitionOpen(false);
      setStatusReason("");
      fetchDecision();
    } catch (err: any) {
      toast({
        type: "error",
        title: "Transition Failed",
        message: err.message,
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleReassessAssumption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssumption) return;

    try {
      setIsSubmittingReassess(true);
      const res = await fetch(`/api/decisions/${id}/reassess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assumptionId: selectedAssumption.id,
          newStatus: reassessStatus,
          currentState: reassessState,
          reason: reassessReason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to record assumption reassessment");
      }

      toast({
        type: "success",
        title: "Assumption Reassessment Preserved",
        message: "Historical validation entry appended without overwriting baseline.",
      });

      setSelectedAssumption(null);
      setReassessState("");
      setReassessReason("");
      fetchDecision();
    } catch (err: any) {
      toast({
        type: "error",
        title: "Reassessment Failed",
        message: err.message,
      });
    } finally {
      setIsSubmittingReassess(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <LoadingState message="Extracting relational decision fossil graph..." />
      </div>
    );
  }

  if (error || !decision) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <ErrorState
          title="Fossil Not Found"
          message={error || "Could not locate requested decision"}
          onRetry={fetchDecision}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Breadcrumbs & Navigation */}
      <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-4">
        <Link href="/decisions" className="hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          DECISIONS
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{decision.id.substring(0, 8)}</span>
      </div>

      {/* Decision Header */}
      <div className="pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <DecisionStatusBadge status={decision.status} size="md" />
              <Badge variant="outline" className="text-xs">
                Version {decision.currentVersion}
              </Badge>
              <Badge variant="neutral" className="text-xs">
                Priority: {decision.priority}
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
              {decision.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-500 pt-1">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-zinc-400" />
                {decision.creator?.name || "Architect"}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                Preserved {new Date(decision.createdAt).toLocaleDateString()}
              </span>
              {decision.reviewDate && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <Clock className="h-3.5 w-3.5" />
                    Review target: {new Date(decision.reviewDate).toLocaleDateString()}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setIsTransitionOpen(true)}
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
            >
              <GitBranch className="h-3.5 w-3.5" />
              Transition Lifecycle
            </Button>
          </div>
        </div>
      </div>

      {/* Main Relational Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        {/* Left Column (2 Cols): Core Statement, Why, Alternatives, Assumptions, Evidence */}
        <div className="lg:col-span-2 space-y-8">
          {/* Formal Decision Statement */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider font-mono text-zinc-500">
              1. Formal Decision Statement
            </h2>
            <div className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              {decision.statement}
            </div>
          </section>

          {/* Rationale & Why */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider font-mono text-zinc-500">
              2. Architectural Rationale &amp; Context
            </h2>
            <div className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-mono mb-1">
                  Context / Problem Space
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {decision.versions[0]?.context || "Initial problem space established during system planning."}
                </p>
              </div>
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
                <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-mono mb-1">
                  Primary Rationale (Why)
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {decision.versions[0]?.reasoning || "Selected based on evaluation of constraints, team expertise, and operational complexity."}
                </p>
              </div>
            </div>
          </section>

          {/* Alternatives Considered */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider font-mono text-zinc-500">
                3. Alternatives Considered ({decision.alternatives?.length || 0})
              </h2>
            </div>
            {decision.alternatives?.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 text-center">
                No alternative candidates logged for this decision fossil.
              </div>
            ) : (
              <div className="space-y-3">
                {decision.alternatives.map((alt: any) => (
                  <div
                    key={alt.id}
                    className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{alt.name}</span>
                        {alt.chosen && <Badge variant="success" size="sm">Selected</Badge>}
                      </div>
                      <Badge variant="outline" size="sm">{alt.status}</Badge>
                    </div>
                    {alt.description && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">{alt.description}</p>
                    )}
                    {alt.selectionReason && (
                      <div className="text-[11px] text-zinc-500 bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded border border-zinc-100 dark:border-zinc-850">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">Disposition Rationale: </span>
                        {alt.selectionReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Assumptions & Historical Validation (The Core Principle!) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider font-mono text-zinc-500">
                4. Foundational Assumptions &amp; Reassessment History ({decision.assumptions?.length || 0})
              </h2>
            </div>

            {decision.assumptions?.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 text-center">
                No foundational assumptions attached yet.
              </div>
            ) : (
              <div className="space-y-4">
                {decision.assumptions.map(({ assumption }: any) => (
                  <div
                    key={assumption.id}
                    className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{assumption.statement}</span>
                        <Badge
                          variant={
                            assumption.status === "VALID"
                              ? "success"
                              : assumption.status === "INVALID"
                              ? "destructive"
                              : "warning"
                          }
                          size="sm"
                        >
                          {assumption.status}
                        </Badge>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => {
                          setSelectedAssumption(assumption);
                          setReassessState(assumption.currentState || "");
                        }}
                      >
                        Reassess Assumption
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-500 font-mono">
                      <div>Baseline State: {assumption.originalState}</div>
                      <div>Current Observed: {assumption.currentState}</div>
                    </div>

                    {/* Historical Validation Trail */}
                    {assumption.history && assumption.history.length > 0 && (
                      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
                        <h5 className="text-[11px] font-mono font-semibold text-zinc-400 mb-2 uppercase">
                          Non-Destructive Validation Trail ({assumption.history.length})
                        </h5>
                        <div className="space-y-2">
                          {assumption.history.map((h: any) => (
                            <div
                              key={h.id}
                              className="text-xs p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                  {h.previousStatus} → {h.newStatus}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-mono">
                                  {new Date(h.validatedAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                                {h.reason}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Evidence Supporting Rationale */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider font-mono text-zinc-500">
              5. Supporting Evidence ({decision.evidence?.length || 0})
            </h2>
            {decision.evidence?.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 text-center">
                No external evidence links or benchmarks attached.
              </div>
            ) : (
              <div className="space-y-3">
                {decision.evidence.map(({ evidence }: any) => (
                  <div
                    key={evidence.id}
                    className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{evidence.title}</span>
                      <Badge variant="outline" size="sm">{evidence.type}</Badge>
                    </div>
                    {evidence.source && (
                      <p className="text-xs font-mono text-zinc-400 break-all">{evidence.source}</p>
                    )}
                    {evidence.description && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">{evidence.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Observed Outcomes */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider font-mono text-zinc-500">
              6. Outcomes &amp; Impact ({decision.outcomes?.length || 0})
            </h2>
            {decision.outcomes?.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 text-center">
                No post-decision outcomes or impact observations recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {decision.outcomes.map((out: any) => (
                  <div
                    key={out.id}
                    className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs font-mono text-zinc-500">Expected:</span>
                      <Badge variant="outline" size="sm">{out.status}</Badge>
                    </div>
                    <p className="text-xs text-zinc-800 dark:text-zinc-200 font-medium">{out.expectedOutcome}</p>
                    {out.actualOutcome && (
                      <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                        <span className="font-semibold text-zinc-500 font-mono">Actual: </span>
                        <span>{out.actualOutcome}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Timeline & Version Fossils */}
        <div className="space-y-6">
          {/* Decision Timeline Events */}
          <Card>
            <CardHeader className="p-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-500">
                Decision Audit Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="relative pl-4 space-y-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-200 dark:before:bg-zinc-800">
                {decision.events?.map((evt: any) => (
                  <div key={evt.id} className="relative text-xs">
                    <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{evt.title}</p>
                    {evt.detail && <p className="text-zinc-500 text-[11px] mt-0.5">{evt.detail}</p>}
                    <span className="text-[10px] text-zinc-400 font-mono block mt-1">
                      {new Date(evt.occurredAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Version Snapshots */}
          <Card>
            <CardHeader className="p-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-500">
                Version History (Fossil Snapshots)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {decision.versions?.map((ver: any) => (
                <div
                  key={ver.id}
                  className="p-3 rounded border border-zinc-200 dark:border-zinc-800 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold font-mono">v{ver.version}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {new Date(ver.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">{ver.changeSummary}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Status Transition Modal */}
      {isTransitionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-semibold">Transition Decision Lifecycle</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Record a formal lifecycle transition and document the engineering reasoning behind it.
            </p>

            <form onSubmit={handleStatusTransition} className="space-y-4 mt-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">Target Status</label>
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value)}
                  className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PROPOSED">Proposed</option>
                  <option value="DECIDED">Decided</option>
                  <option value="MONITORING">Monitoring</option>
                  <option value="REASSESSING">Reassessing</option>
                  <option value="VALIDATED">Validated</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="SUPERSEDED">Superseded</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Reason for Transition</label>
                <Textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g. Completed benchmarking tests and team consensus reached."
                  rows={3}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTransitionOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isUpdatingStatus}>
                  Commit Transition
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assumption Reassessment Modal */}
      {selectedAssumption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-semibold">Reassess Assumption</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Preserve reassessment history non-destructively: &ldquo;{selectedAssumption.statement}&rdquo;
            </p>

            <form onSubmit={handleReassessAssumption} className="space-y-4 mt-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">New Status Evaluation</label>
                <select
                  value={reassessStatus}
                  onChange={(e) => setReassessStatus(e.target.value)}
                  className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs"
                >
                  <option value="VALID">Valid (Still Holds)</option>
                  <option value="QUESTIONABLE">Questionable (Drifting)</option>
                  <option value="INVALID">Invalid (No Longer True)</option>
                  <option value="UNKNOWN">Unknown</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Current Observed Reality</label>
                <Input
                  value={reassessState}
                  onChange={(e) => setReassessState(e.target.value)}
                  placeholder="e.g. Throughput reached 1.2M req/sec during Black Friday"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Validation Rationale</label>
                <Textarea
                  value={reassessReason}
                  onChange={(e) => setReassessReason(e.target.value)}
                  placeholder="Why is this status updated? What telemetry or metrics led to this conclusion?"
                  rows={3}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAssumption(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isSubmittingReassess}>
                  Preserve Reassessment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
