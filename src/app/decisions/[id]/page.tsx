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
  Edit3,
  Plus,
  Trash2,
  ExternalLink,
  Target,
  ArrowRight,
  TrendingUp,
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

  // ─── Modal States ────────────────────────────────────────────────────────
  // 1. Status transition
  const [isTransitionOpen, setIsTransitionOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState("DECIDED");
  const [statusReason, setStatusReason] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // 2. Decision Editing (Version Snapshot)
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editStatement, setEditStatement] = useState("");
  const [editPriority, setEditPriority] = useState<any>("MEDIUM");
  const [editContext, setEditContext] = useState("");
  const [editReasoning, setEditReasoning] = useState("");
  const [editChangeSummary, setEditChangeSummary] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // 3. Assumption Reassessment
  const [selectedAssumption, setSelectedAssumption] = useState<any>(null);
  const [reassessStatus, setReassessStatus] = useState("VALID");
  const [reassessState, setReassessState] = useState("");
  const [reassessReason, setReassessReason] = useState("");
  const [isSubmittingReassess, setIsSubmittingReassess] = useState(false);

  // 4. Quick Add Alternative
  const [isAddAltOpen, setIsAddAltOpen] = useState(false);
  const [altName, setAltName] = useState("");
  const [altDesc, setAltDesc] = useState("");
  const [altPros, setAltPros] = useState("");
  const [altCons, setAltCons] = useState("");
  const [altReason, setAltReason] = useState("");
  const [altStatus, setAltStatus] = useState("CONSIDERED");
  const [isSubmittingAlt, setIsSubmittingAlt] = useState(false);

  // 5. Quick Add Assumption
  const [isAddAssumpOpen, setIsAddAssumpOpen] = useState(false);
  const [assumpStatement, setAssumpStatement] = useState("");
  const [assumpImportance, setAssumpImportance] = useState("MEDIUM");
  const [assumpConfidence, setAssumpConfidence] = useState("MEDIUM");
  const [assumpImpactNote, setAssumpImpactNote] = useState("");
  const [isSubmittingAssump, setIsSubmittingAssump] = useState(false);

  // 6. Quick Add Evidence
  const [isAddEvidenceOpen, setIsAddEvidenceOpen] = useState(false);
  const [evTitle, setEvTitle] = useState("");
  const [evType, setEvType] = useState("BENCHMARK");
  const [evSource, setEvSource] = useState("");
  const [evDesc, setEvDesc] = useState("");
  const [isSubmittingEvidence, setIsSubmittingEvidence] = useState(false);

  // 7. Record/Update Outcome
  const [isOutcomeOpen, setIsOutcomeOpen] = useState(false);
  const [outcomeExpected, setOutcomeExpected] = useState("");
  const [outcomeActual, setOutcomeActual] = useState("");
  const [outcomeStat, setOutcomeStat] = useState("ACHIEVED");
  const [outcomeMeasure, setOutcomeMeasure] = useState("");
  const [outcomeNotesText, setOutcomeNotesText] = useState("");
  const [isSubmittingOutcome, setIsSubmittingOutcome] = useState(false);

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

      // Pre-fill edit fields
      setEditTitle(data.decision.title);
      setEditStatement(data.decision.statement);
      setEditPriority(data.decision.priority);
      const latestVer = data.decision.versions?.[0];
      setEditContext(latestVer?.context || "");
      setEditReasoning(latestVer?.reasoning || "");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDecision();
  }, [id]);

  // ─── Lifecycle Status Transition ─────────────────────────────────────────
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
        title: "Lifecycle Transition Committed",
        message: `Decision moved to status: ${nextStatus}. Audit event recorded.`,
      });

      setIsTransitionOpen(false);
      setStatusReason("");
      fetchDecision();
    } catch (err: any) {
      toast({ type: "error", title: "Transition Failed", message: err.message });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // ─── Immutable Decision Edit (New Version) ──────────────────────────────
  const handleEditDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editChangeSummary.trim()) {
      toast({ type: "error", title: "Validation Error", message: "Please provide a change summary to preserve historical reasoning." });
      return;
    }

    try {
      setIsSubmittingEdit(true);
      const res = await fetch(`/api/decisions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          statement: editStatement,
          priority: editPriority,
          context: editContext,
          reasoning: editReasoning,
          changeSummary: editChangeSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update decision");
      }

      toast({
        type: "success",
        title: "Version Snapshot Preserved",
        message: `Version ${data.version.version} created non-destructively.`,
      });

      setIsEditOpen(false);
      setEditChangeSummary("");
      fetchDecision();
    } catch (err: any) {
      toast({ type: "error", title: "Update Failed", message: err.message });
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // ─── Assumption Reassessment ─────────────────────────────────────────────
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
      toast({ type: "error", title: "Reassessment Failed", message: err.message });
    } finally {
      setIsSubmittingReassess(false);
    }
  };

  // ─── Add Alternative ─────────────────────────────────────────────────────
  const handleAddAlternative = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmittingAlt(true);
      const res = await fetch(`/api/decisions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "ALTERNATIVE",
          name: altName,
          description: altDesc,
          pros: altPros,
          cons: altCons,
          selectionReason: altReason,
          status: altStatus,
          chosen: altStatus === "SELECTED",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add alternative");
      }

      toast({ type: "success", title: "Alternative Attached", message: `Recorded candidate option "${altName}".` });
      setIsAddAltOpen(false);
      setAltName("");
      setAltDesc("");
      setAltPros("");
      setAltCons("");
      setAltReason("");
      fetchDecision();
    } catch (err: any) {
      toast({ type: "error", title: "Action Failed", message: err.message });
    } finally {
      setIsSubmittingAlt(false);
    }
  };

  // ─── Add Assumption ──────────────────────────────────────────────────────
  const handleAddAssumption = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmittingAssump(true);
      const res = await fetch(`/api/decisions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "ASSUMPTION",
          statement: assumpStatement,
          importance: assumpImportance,
          confidence: assumpConfidence,
          status: "UNVERIFIED",
          impactNote: assumpImpactNote,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add assumption");
      }

      toast({ type: "success", title: "Assumption Preserved", message: "Recorded assumption hypothesis." });
      setIsAddAssumpOpen(false);
      setAssumpStatement("");
      setAssumpImpactNote("");
      fetchDecision();
    } catch (err: any) {
      toast({ type: "error", title: "Action Failed", message: err.message });
    } finally {
      setIsSubmittingAssump(false);
    }
  };

  // ─── Add Evidence ────────────────────────────────────────────────────────
  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmittingEvidence(true);
      const res = await fetch(`/api/decisions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "EVIDENCE",
          title: evTitle,
          type: evType,
          source: evSource,
          description: evDesc,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to attach evidence");
      }

      toast({ type: "success", title: "Evidence Attached", message: `Linked artifact "${evTitle}".` });
      setIsAddEvidenceOpen(false);
      setEvTitle("");
      setEvSource("");
      setEvDesc("");
      fetchDecision();
    } catch (err: any) {
      toast({ type: "error", title: "Action Failed", message: err.message });
    } finally {
      setIsSubmittingEvidence(false);
    }
  };

  // ─── Record Outcome ──────────────────────────────────────────────────────
  const handleRecordOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmittingOutcome(true);
      const res = await fetch(`/api/decisions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "OUTCOME",
          expectedOutcome: outcomeExpected,
          actualOutcome: outcomeActual,
          status: outcomeStat,
          measurement: outcomeMeasure,
          notes: outcomeNotesText,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to record outcome");
      }

      toast({ type: "success", title: "Outcome Preserved", message: "Logged Expectation vs Reality measurement." });
      setIsOutcomeOpen(false);
      fetchDecision();
    } catch (err: any) {
      toast({ type: "error", title: "Action Failed", message: err.message });
    } finally {
      setIsSubmittingOutcome(false);
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

  const selectedAlternative = decision.alternatives?.find((a: any) => a.chosen || a.status === "SELECTED");
  const rejectedAlternatives = decision.alternatives?.filter((a: any) => !a.chosen && a.status !== "SELECTED") || [];

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
              {decision.tags?.map(({ tag }: any) => (
                <span
                  key={tag.id}
                  className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                >
                  #{tag.name}
                </span>
              ))}
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

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              onClick={() => setIsEditOpen(true)}
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit Decision
            </Button>
            <Button
              onClick={() => setIsTransitionOpen(true)}
              size="sm"
              className="text-xs gap-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              <GitBranch className="h-3.5 w-3.5" />
              Transition Lifecycle
            </Button>
          </div>
        </div>
      </div>

      {/* Main Relational Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        {/* Left Column (2 Cols): Statement, Why, Alternatives, Assumptions, Evidence, Outcomes */}
        <div className="lg:col-span-2 space-y-8">
          {/* 1. Formal Decision Statement */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider font-mono text-zinc-500">
              1. Formal Decision Statement
            </h2>
            <div className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 font-medium">
              {decision.statement}
            </div>
          </section>

          {/* 2. Rationale & Problem Space */}
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

          {/* 3. Alternatives Considered */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider font-mono text-zinc-500">
                3. Alternatives Considered ({decision.alternatives?.length || 0})
              </h2>
              <Button onClick={() => setIsAddAltOpen(true)} size="sm" variant="outline" className="text-xs gap-1 h-7">
                <Plus className="h-3 w-3" /> Add Alternative
              </Button>
            </div>

            {decision.alternatives?.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 text-center">
                No alternative candidates logged for this decision fossil.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Selected Option highlight */}
                {selectedAlternative && (
                  <div className="p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-semibold text-sm text-emerald-950 dark:text-emerald-200">
                          {selectedAlternative.name} (Selected Option)
                        </span>
                      </div>
                      <Badge variant="success" size="sm">Selected</Badge>
                    </div>
                    {selectedAlternative.description && (
                      <p className="text-xs text-zinc-700 dark:text-zinc-300">{selectedAlternative.description}</p>
                    )}
                    {selectedAlternative.selectionReason && (
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-300 bg-white/80 dark:bg-zinc-900/80 p-2.5 rounded border border-emerald-200/60 dark:border-emerald-800/40">
                        <span className="font-semibold text-emerald-800 dark:text-emerald-300">Selection Justification: </span>
                        {selectedAlternative.selectionReason}
                      </div>
                    )}
                  </div>
                )}

                {/* Rejected/Considered options */}
                {rejectedAlternatives.map((alt: any) => (
                  <div
                    key={alt.id}
                    className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{alt.name}</span>
                      <Badge variant="outline" size="sm">{alt.status}</Badge>
                    </div>
                    {alt.description && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">{alt.description}</p>
                    )}
                    {(alt.pros || alt.cons) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                        {alt.pros && (
                          <div className="p-2 rounded bg-emerald-50/30 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                            <strong>Pros:</strong> {alt.pros}
                          </div>
                        )}
                        {alt.cons && (
                          <div className="p-2 rounded bg-rose-50/30 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 text-rose-800 dark:text-rose-300">
                            <strong>Cons:</strong> {alt.cons}
                          </div>
                        )}
                      </div>
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

          {/* 4. Assumptions & Non-Destructive Validation History */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider font-mono text-zinc-500">
                  4. Assumptions &amp; Validation History ({decision.assumptions?.length || 0})
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Operational premises that must remain valid for this decision to hold.
                </p>
              </div>
              <Button onClick={() => setIsAddAssumpOpen(true)} size="sm" variant="outline" className="text-xs gap-1 h-7">
                <Plus className="h-3 w-3" /> Add Assumption
              </Button>
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
                        <Badge variant="outline" size="sm">
                          Confidence: {assumption.confidence}
                        </Badge>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 gap-1"
                        onClick={() => {
                          setSelectedAssumption(assumption);
                          setReassessState(assumption.currentState || "");
                        }}
                      >
                        <Scale className="h-3 w-3" /> Reassess Status
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-500 font-mono">
                      <div>Baseline State: {assumption.originalState}</div>
                      <div>Current Observed: {assumption.currentState}</div>
                    </div>

                    {/* Linked Evidence to this assumption */}
                    {assumption.evidenceLinks?.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                        <span className="text-zinc-400 font-mono">Supporting Evidence:</span>
                        {assumption.evidenceLinks.map(({ evidence }: any) => (
                          <span
                            key={evidence.id}
                            className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[10px] text-zinc-600 dark:text-zinc-300"
                          >
                            {evidence.title}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Historical Validation Trail */}
                    {assumption.history && assumption.history.length > 0 && (
                      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
                        <h5 className="text-[11px] font-mono font-semibold text-zinc-400 mb-2 uppercase flex items-center gap-1.5">
                          <History className="h-3 w-3" />
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

          {/* 5. Supporting Evidence */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider font-mono text-zinc-500">
                5. Supporting Evidence ({decision.evidence?.length || 0})
              </h2>
              <Button onClick={() => setIsAddEvidenceOpen(true)} size="sm" variant="outline" className="text-xs gap-1 h-7">
                <Plus className="h-3 w-3" /> Link Evidence
              </Button>
            </div>

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
                      <a
                        href={evidence.source.startsWith("http") ? evidence.source : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 break-all flex items-center gap-1"
                      >
                        {evidence.source}
                        {evidence.source.startsWith("http") && <ExternalLink className="h-3 w-3 inline" />}
                      </a>
                    )}
                    {evidence.description && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">{evidence.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 6. Observed Outcomes (Expectation vs Reality) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider font-mono text-zinc-500">
                6. Outcomes &amp; Impact ({decision.outcomes?.length || 0})
              </h2>
              <Button onClick={() => setIsOutcomeOpen(true)} size="sm" variant="outline" className="text-xs gap-1 h-7">
                <Plus className="h-3 w-3" /> Record Outcome
              </Button>
            </div>

            {decision.outcomes?.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 text-center">
                No post-decision outcomes or impact observations recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {decision.outcomes.map((out: any) => (
                  <div
                    key={out.id}
                    className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs font-mono text-zinc-500 uppercase">
                        Expectation vs. Reality
                      </span>
                      <Badge
                        variant={out.status === "ACHIEVED" ? "success" : out.status === "FAILED" ? "destructive" : "warning"}
                        size="sm"
                      >
                        {out.status}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="p-3 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800">
                        <span className="text-[10px] font-mono uppercase text-zinc-400 block mb-0.5">Expected:</span>
                        <p className="text-xs text-zinc-800 dark:text-zinc-200">{out.expectedOutcome}</p>
                      </div>

                      {out.actualOutcome && (
                        <div className="p-3 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800">
                          <span className="text-[10px] font-mono uppercase text-zinc-400 block mb-0.5">Observed Reality:</span>
                          <p className="text-xs text-zinc-800 dark:text-zinc-200 font-medium">{out.actualOutcome}</p>
                        </div>
                      )}
                    </div>

                    {out.measurement && (
                      <div className="text-[11px] font-mono text-zinc-500">
                        Metrics: {out.measurement}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Visual Timeline & Version Snapshots */}
        <div className="space-y-6">
          {/* Decision Timeline Events */}
          <Card>
            <CardHeader className="p-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Chronological Event Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="relative pl-4 space-y-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-200 dark:before:bg-zinc-800">
                {decision.events?.map((evt: any) => (
                  <div key={evt.id} className="relative text-xs">
                    <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100 ring-2 ring-white dark:ring-zinc-950" />
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
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" /> Version History ({decision.versions?.length || 1})
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
                  <p className="text-zinc-600 dark:text-zinc-400 text-[11px] line-clamp-2">{ver.statement}</p>
                  {ver.changeSummary && (
                    <div className="text-[10px] text-zinc-400 italic pt-1 border-t border-zinc-100 dark:border-zinc-800">
                      Reason: {ver.changeSummary}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── MODALS ───────────────────────────────────────────────────────── */}

      {/* Modal 1: Edit Decision (Immutable Versioning) */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold">Edit Decision &amp; Create Version Snapshot</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Changes to statements or reasoning create an immutable version snapshot (v{decision.currentVersion + 1}) to prevent accidental loss of historical rationale.
            </p>

            <form onSubmit={handleEditDecision} className="space-y-4 mt-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">Title</label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Formal Decision Statement</label>
                <Textarea value={editStatement} onChange={(e) => setEditStatement(e.target.value)} rows={3} required />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Context / Problem Space</label>
                <Textarea value={editContext} onChange={(e) => setEditContext(e.target.value)} rows={3} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Primary Rationale (Why)</label>
                <Textarea value={editReasoning} onChange={(e) => setEditReasoning(e.target.value)} rows={3} />
              </div>

              <div className="space-y-1 bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded border border-amber-200 dark:border-amber-800">
                <label className="text-xs font-semibold text-amber-900 dark:text-amber-300">
                  Change Summary / Justification <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={editChangeSummary}
                  onChange={(e) => setEditChangeSummary(e.target.value)}
                  placeholder="Why is this decision statement or rationale being modified?"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isSubmittingEdit}>
                  Commit Version Snapshot
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Status Transition */}
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
                <Button type="button" variant="outline" size="sm" onClick={() => setIsTransitionOpen(false)}>
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

      {/* Modal 3: Assumption Reassessment */}
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
                  placeholder="e.g. Ingress reached 38,000 req/sec during launch"
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
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedAssumption(null)}>
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

      {/* Modal 4: Add Alternative */}
      {isAddAltOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl">
            <h3 className="text-base font-semibold">Attach Alternative Option</h3>
            <form onSubmit={handleAddAlternative} className="space-y-3 mt-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">Alternative Name</label>
                <Input value={altName} onChange={(e) => setAltName(e.target.value)} placeholder="e.g. Apache Kafka" required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Disposition</label>
                <select
                  value={altStatus}
                  onChange={(e) => setAltStatus(e.target.value)}
                  className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs"
                >
                  <option value="CONSIDERED">Considered</option>
                  <option value="SELECTED">Selected</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Pros</label>
                <Input value={altPros} onChange={(e) => setAltPros(e.target.value)} placeholder="High throughput, replayable..." />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Cons</label>
                <Input value={altCons} onChange={(e) => setAltCons(e.target.value)} placeholder="Cluster complexity, RAM overhead..." />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Selection / Rejection Reason</label>
                <Input value={altReason} onChange={(e) => setAltReason(e.target.value)} placeholder="Rationale..." />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddAltOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isSubmittingAlt}>
                  Save Alternative
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Add Assumption */}
      {isAddAssumpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl">
            <h3 className="text-base font-semibold">Record New Assumption</h3>
            <form onSubmit={handleAddAssumption} className="space-y-3 mt-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">Assumption Statement</label>
                <Input
                  value={assumpStatement}
                  onChange={(e) => setAssumpStatement(e.target.value)}
                  placeholder="e.g. Read traffic exceeds write traffic by 90:10"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Importance</label>
                  <select
                    value={assumpImportance}
                    onChange={(e) => setAssumpImportance(e.target.value)}
                    className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Confidence</label>
                  <select
                    value={assumpConfidence}
                    onChange={(e) => setAssumpConfidence(e.target.value)}
                    className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Impact Note</label>
                <Input
                  value={assumpImpactNote}
                  onChange={(e) => setAssumpImpactNote(e.target.value)}
                  placeholder="What happens if this assumption is falsified?"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddAssumpOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isSubmittingAssump}>
                  Preserve Assumption
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 6: Add Evidence */}
      {isAddEvidenceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl">
            <h3 className="text-base font-semibold">Attach Supporting Evidence</h3>
            <form onSubmit={handleAddEvidence} className="space-y-3 mt-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">Title</label>
                <Input value={evTitle} onChange={(e) => setEvTitle(e.target.value)} placeholder="e.g. Latency Benchmark Suite" required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Type</label>
                <select
                  value={evType}
                  onChange={(e) => setEvType(e.target.value)}
                  className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs"
                >
                  <option value="BENCHMARK">Benchmark</option>
                  <option value="DOCUMENT">Document</option>
                  <option value="URL">URL</option>
                  <option value="DATASET">Dataset</option>
                  <option value="EXPERIMENT">Experiment</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Source / URL</label>
                <Input value={evSource} onChange={(e) => setEvSource(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Description</label>
                <Textarea value={evDesc} onChange={(e) => setEvDesc(e.target.value)} rows={2} />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddEvidenceOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isSubmittingEvidence}>
                  Link Evidence
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 7: Record Outcome */}
      {isOutcomeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl">
            <h3 className="text-base font-semibold">Record Decision Outcome</h3>
            <form onSubmit={handleRecordOutcome} className="space-y-3 mt-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">Expected Outcome</label>
                <Textarea
                  value={outcomeExpected}
                  onChange={(e) => setOutcomeExpected(e.target.value)}
                  placeholder="What was originally expected?"
                  rows={2}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Actual Observed Outcome</label>
                <Textarea
                  value={outcomeActual}
                  onChange={(e) => setOutcomeActual(e.target.value)}
                  placeholder="What actually occurred?"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Outcome Status</label>
                  <select
                    value={outcomeStat}
                    onChange={(e) => setOutcomeStat(e.target.value)}
                    className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs"
                  >
                    <option value="ACHIEVED">Achieved</option>
                    <option value="PARTIALLY_ACHIEVED">Partially Achieved</option>
                    <option value="FAILED">Failed</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Measurement</label>
                  <Input value={outcomeMeasure} onChange={(e) => setOutcomeMeasure(e.target.value)} placeholder="p99 = 8ms" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsOutcomeOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isSubmittingOutcome}>
                  Preserve Outcome
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
