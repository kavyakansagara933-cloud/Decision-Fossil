"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Edit2,
  FileText,
  AlertTriangle,
  Scale,
  Shield,
  HelpCircle,
  ExternalLink,
  Save,
  RefreshCw,
  Info,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { ReasoningExtractionResult } from "@/types/ai-extraction";

const SAMPLE_TEXT = `Architecture Decision Discussion: Adopting Kafka vs RabbitMQ for Event Streaming

Context & Constraints:
Currently, our backend processes over 25,000 asynchronous orders and telemetry events per minute during peak trading windows. Our legacy single-node RabbitMQ message broker is suffering from extreme queue memory pressure, forcing the broker into flow-control throttling and dropping unacknowledged events.

Decision:
We have decided to adopt Apache Kafka with managed Strimzi operator as our primary distributed event commit log for order processing and ingestion pipelines.

Primary Rationale:
Because Kafka's partitioned log architecture decouples producers from consumer read rates and provides 7-day persistent event replayability, it guarantees zero message loss during downstream consumer degradation.

Alternatives Evaluated:
1. Scaling RabbitMQ Cluster: We considered upgrading to a multi-node mirrored RabbitMQ cluster, but rejected it because consumer lag still risks broker memory exhaustion under our expected load.
2. AWS SQS / SNS: Evaluated managed AWS queues, but rejected because vendor lock-in violates our multi-cloud deployment requirement.
3. Apache Kafka: Selected because partition-based horizontal scaling supports our anticipated 10x throughput surge.

Foundational Assumptions:
- Peak incoming event rate will remain under 150,000 events/second in Year 1.
- Network storage latency across availability zones remains below 3ms for synchronous replica acknowledgments.

Supporting Evidence:
- Internal benchmark spike: https://benchmarks.internal/reports/kafka-strimzi-load-test
- Observed p99 write latency remained at 2.4ms under 100,000 msgs/sec during our 48-hour staging stress test.

Key Risks:
- High operational complexity of managing ZooKeeper/KRaft quorum for small dev teams.

Expected Outcome:
Zero dropped messages and p95 end-to-end ingestion latency under 45ms across all order channels.`;

export default function AIExtractPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Workflow State
  const [sourceText, setSourceText] = useState("");
  const [docReference, setDocReference] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<ReasoningExtractionResult | null>(null);
  const [providerMeta, setProviderMeta] = useState<any>(null);

  // Review & Decision Selection
  const [existingDecisions, setExistingDecisions] = useState<any[]>([]);
  const [targetDecisionId, setTargetDecisionId] = useState<string>(""); // empty = create new decision
  const [isSaving, setIsSaving] = useState(false);

  // Proposal Item Approvals (id -> boolean)
  const [acceptedAlts, setAcceptedAlts] = useState<Record<string, boolean>>({});
  const [acceptedAssumps, setAcceptedAssumps] = useState<Record<string, boolean>>({});
  const [acceptedEvids, setAcceptedEvids] = useState<Record<string, boolean>>({});

  // Editable fields during review
  const [editableTitle, setEditableTitle] = useState("");
  const [editableStatement, setEditableStatement] = useState("");
  const [editableContext, setEditableContext] = useState("");
  const [editableReasoning, setEditableReasoning] = useState("");
  const [editableOutcome, setEditableOutcome] = useState("");
  const [activeTab, setActiveTab] = useState<"proposals" | "source">("proposals");

  // Fetch existing decisions to allow attaching proposals
  useEffect(() => {
    fetch("/api/decisions")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setExistingDecisions(data.decisions || []);
        }
      })
      .catch((err) => console.error("Failed to load decisions:", err));
  }, []);

  const handleStartExtraction = async () => {
    if (sourceText.trim().length < 20) {
      toast({
        type: "error",
        title: "Input Too Short",
        message: "Please enter at least 20 characters of notes, RFCs, or discussion text.",
      });
      return;
    }

    try {
      setIsExtracting(true);
      setError(null);

      const res = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sourceText,
          workspaceId: "core-engineering",
          documentReference: docReference || "Direct Input",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to extract decision reasoning");
      }

      const extraction: ReasoningExtractionResult = data.extraction;
      setExtractionResult(extraction);
      setProviderMeta(data.providerInfo);

      // Pre-fill editable core fields
      setEditableTitle(extraction.title);
      setEditableStatement(extraction.statement);
      setEditableContext(extraction.context || "");
      setEditableReasoning(extraction.reasoning || "");
      setEditableOutcome(extraction.expectedOutcome || "");

      // Default all extracted items to ACCEPTED initially
      const altsAcc: Record<string, boolean> = {};
      extraction.alternatives.forEach((a) => (altsAcc[a.id] = true));
      setAcceptedAlts(altsAcc);

      const assumpAcc: Record<string, boolean> = {};
      extraction.assumptions.forEach((a) => (assumpAcc[a.id] = true));
      setAcceptedAssumps(assumpAcc);

      const evAcc: Record<string, boolean> = {};
      extraction.evidence.forEach((e) => (evAcc[e.id] = true));
      setAcceptedEvids(evAcc);

      toast({
        type: "success",
        title: "Extraction Complete",
        message: `Extracted ${extraction.alternatives.length} alternatives, ${extraction.assumptions.length} assumptions, and ${extraction.evidence.length} evidence items. Please review proposals below.`,
      });
    } catch (err: any) {
      setError(err.message);
      toast({ type: "error", title: "Extraction Failed", message: err.message });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveReviewedData = async (isDraft: boolean = false) => {
    if (!extractionResult) return;
    if (!editableTitle.trim() || editableTitle.length < 3) {
      toast({ type: "error", title: "Validation Error", message: "Decision Title must be at least 3 characters." });
      return;
    }
    if (!editableStatement.trim() || editableStatement.length < 10) {
      toast({ type: "error", title: "Validation Error", message: "Decision Statement must be at least 10 characters." });
      return;
    }

    try {
      setIsSaving(true);

      const acceptedAlternatives = extractionResult.alternatives
        .filter((a) => acceptedAlts[a.id])
        .map((a) => ({
          name: a.name,
          description: a.description,
          pros: a.pros,
          cons: a.cons,
          selectionReason: a.selectionReason,
          status: a.status,
          chosen: a.chosen,
          sourceExcerpt: a.sourceExcerpt,
        }));

      const acceptedAssumptions = extractionResult.assumptions
        .filter((a) => acceptedAssumps[a.id])
        .map((a) => ({
          statement: a.statement,
          importance: a.importance,
          confidence: a.confidence,
          status: "UNVERIFIED" as const,
          impactNote: a.impactNote,
          sourceExcerpt: a.sourceExcerpt,
        }));

      const acceptedEvidence = extractionResult.evidence
        .filter((e) => acceptedEvids[e.id])
        .map((e) => ({
          title: e.title,
          type: e.type,
          source: e.source,
          description: e.description,
          sourceExcerpt: e.sourceExcerpt,
        }));

      const payload = {
        workspaceId: "core-engineering",
        decisionId: targetDecisionId || undefined,
        isDraft,
        title: editableTitle,
        statement: editableStatement,
        priority: extractionResult.priority,
        status: isDraft ? "DRAFT" : "PROPOSED",
        context: editableContext,
        reasoning: editableReasoning,
        expectedOutcome: editableOutcome,
        acceptedAlternatives,
        acceptedAssumptions,
        acceptedEvidence,
        rejectedSummary: {
          alternativeCount: extractionResult.alternatives.length - acceptedAlternatives.length,
          assumptionCount: extractionResult.assumptions.length - acceptedAssumptions.length,
          evidenceCount: extractionResult.evidence.length - acceptedEvidence.length,
          riskCount: extractionResult.risks.length,
          questionCount: extractionResult.openQuestions.length,
        },
        sourceDocumentReference: docReference || "Imported Text",
      };

      const res = await fetch("/api/ai/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to commit accepted proposals");
      }

      toast({
        type: "success",
        title: isDraft ? "Saved as Draft" : "Decision Preserved Successfully",
        message: `Committed accepted items to decision fossil "${data.decision.title}".`,
      });

      router.push(`/decisions/${data.decision.id}`);
    } catch (err: any) {
      toast({ type: "error", title: "Save Failed", message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-1">
              <Link href="/decisions" className="hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> DECISIONS
              </Link>
              <span>/</span>
              <span className="text-zinc-900 dark:text-zinc-100 font-semibold flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                AI REASONING EXTRACTION
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
              Extract Decision Intelligence from Notes &amp; RFCs
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Analyze meeting notes, design documents, or PR discussions to propose structured decisions, assumptions, and evidence with strict source traceability.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSourceText(SAMPLE_TEXT);
                setDocReference("RFC-204-Streaming-Platform.md");
              }}
              className="text-xs"
            >
              Load Sample RFC
            </Button>
          </div>
        </div>
      </div>

      {/* Main Grid: Input on left / Result on right if available, or full width input */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
        {/* Source Text Input Column */}
        <div className={extractionResult ? "lg:col-span-5 space-y-4" : "lg:col-span-12 max-w-4xl mx-auto space-y-4"}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>1. Provide Source Text or Discussion</span>
                <span className="text-[11px] font-mono text-zinc-400 font-normal">
                  {sourceText.length.toLocaleString()} characters
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                Paste raw notes, Slack threads, architecture RFCs, or PR reviews. AI will propose structured items without auto-committing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Document Reference / Source Title (Optional)
                </label>
                <Input
                  value={docReference}
                  onChange={(e) => setDocReference(e.target.value)}
                  placeholder="e.g. RFC-104: Streaming Bus Architecture"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Raw Text to Analyze <span className="text-rose-500">*</span>
                </label>
                <Textarea
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Paste architectural discussion, meeting minutes, or design proposals here..."
                  rows={extractionResult ? 16 : 12}
                  className="text-xs font-mono leading-relaxed"
                />
              </div>

              <Button
                onClick={handleStartExtraction}
                isLoading={isExtracting}
                className="w-full text-xs gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Sparkles className="h-4 w-4" />
                {isExtracting ? "Analyzing Rationale & Excerpts..." : "Extract Reasoning Proposals"}
              </Button>

              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 space-y-1">
                <p className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Source Traceability Guarantee
                </p>
                <p>
                  Every extracted alternative, assumption, and evidence item is anchored to an exact supporting excerpt in your source text. AI outputs are treated as <strong>proposals</strong> and will never overwrite database records until you accept and confirm them.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Extraction Review Column */}
        {extractionResult && (
          <div className="lg:col-span-7 space-y-6">
            {/* Provider Provenance Banner */}
            <div className="p-4 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] bg-white dark:bg-zinc-900">
                    Provider: {providerMeta?.name || "Mock"}
                  </Badge>
                  <span className="font-mono text-zinc-500 text-[11px]">
                    Extracted at {new Date(extractionResult.extractedAt).toLocaleTimeString()}
                  </span>
                </div>
                {providerMeta?.warning && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 pt-1">
                    {providerMeta.warning}
                  </p>
                )}
              </div>

              {/* Destination selector: New Decision or Attach to Existing */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500 font-mono">Target:</span>
                <select
                  value={targetDecisionId}
                  onChange={(e) => setTargetDecisionId(e.target.value)}
                  className="h-8 rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 text-xs"
                >
                  <option value="">Create New Decision</option>
                  {existingDecisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      Attach to: {d.title.slice(0, 30)}...
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Core Decision Summary Form (Editable) */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold uppercase font-mono text-zinc-500">
                  Proposed Decision Summary
                </CardTitle>
                <CardDescription className="text-xs">
                  Review and edit the formal decision statement and problem context before committing.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Title</label>
                  <Input
                    value={editableTitle}
                    onChange={(e) => setEditableTitle(e.target.value)}
                    className="text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Formal Decision Statement</label>
                  <Textarea
                    value={editableStatement}
                    onChange={(e) => setEditableStatement(e.target.value)}
                    rows={2}
                    className="text-xs font-medium"
                  />
                  {extractionResult.statementExcerpt && (
                    <div className="text-[11px] text-zinc-500 italic bg-zinc-50 dark:bg-zinc-900 p-2 rounded">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">Supporting Excerpt: </span>
                      &quot;{extractionResult.statementExcerpt}&quot;
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Context / Problem</label>
                    <Textarea
                      value={editableContext}
                      onChange={(e) => setEditableContext(e.target.value)}
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Primary Rationale (Why)</label>
                    <Textarea
                      value={editableReasoning}
                      onChange={(e) => setEditableReasoning(e.target.value)}
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                </div>

                {editableOutcome && (
                  <div className="space-y-1 pt-1">
                    <label className="text-xs font-medium">Expected Outcome</label>
                    <Input
                      value={editableOutcome}
                      onChange={(e) => setEditableOutcome(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Alternatives Proposals */}
            <Card>
              <CardHeader className="p-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold uppercase font-mono text-zinc-500 flex items-center gap-1.5">
                    <Scale className="h-4 w-4" />
                    Alternatives Evaluated ({extractionResult.alternatives.length})
                  </CardTitle>
                  <span className="text-xs text-zinc-400 font-mono">
                    {Object.values(acceptedAlts).filter(Boolean).length} Accepted
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {extractionResult.alternatives.map((alt) => {
                  const isAccepted = acceptedAlts[alt.id] ?? true;
                  return (
                    <div
                      key={alt.id}
                      className={`p-3 rounded-lg border transition-all text-xs space-y-2 ${
                        isAccepted
                          ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                          : "bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200/50 dark:border-zinc-800/40 opacity-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{alt.name}</span>
                          <Badge variant="outline" size="sm">
                            {alt.status}
                          </Badge>
                          <Badge variant="neutral" size="sm">
                            {alt.traceability}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant={isAccepted ? "primary" : "outline"}
                            className="h-6 text-[11px] px-2 gap-1"
                            onClick={() => setAcceptedAlts((prev) => ({ ...prev, [alt.id]: !isAccepted }))}
                          >
                            {isAccepted ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            {isAccepted ? "Accepted" : "Rejected"}
                          </Button>
                        </div>
                      </div>

                      {alt.description && <p className="text-zinc-600 dark:text-zinc-400">{alt.description}</p>}

                      <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-950 text-[11px] text-zinc-500 font-mono">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">Source Excerpt: </span>
                        &quot;{alt.sourceExcerpt}&quot;
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Assumptions Proposals (Prominent Visual Attention) */}
            <Card className="border-amber-200 dark:border-amber-900/60">
              <CardHeader className="p-4 pb-2 border-b border-amber-100 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold uppercase font-mono text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Foundational Assumptions ({extractionResult.assumptions.length})
                  </CardTitle>
                  <span className="text-xs text-amber-700 dark:text-amber-400 font-mono">
                    {Object.values(acceptedAssumps).filter(Boolean).length} Accepted
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {extractionResult.assumptions.map((assump) => {
                  const isAccepted = acceptedAssumps[assump.id] ?? true;
                  return (
                    <div
                      key={assump.id}
                      className={`p-3 rounded-lg border transition-all text-xs space-y-2 ${
                        isAccepted
                          ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                          : "bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200/50 dark:border-zinc-800/40 opacity-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{assump.statement}</span>
                          <Badge variant="warning" size="sm">
                            {assump.importance}
                          </Badge>
                          <Badge variant="neutral" size="sm">
                            {assump.traceability}
                          </Badge>
                        </div>

                        <Button
                          size="sm"
                          variant={isAccepted ? "primary" : "outline"}
                          className="h-6 text-[11px] px-2 gap-1"
                          onClick={() => setAcceptedAssumps((prev) => ({ ...prev, [assump.id]: !isAccepted }))}
                        >
                          {isAccepted ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          {isAccepted ? "Accepted" : "Rejected"}
                        </Button>
                      </div>

                      <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-950 text-[11px] text-zinc-500 font-mono">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">Supporting Excerpt: </span>
                        &quot;{assump.sourceExcerpt}&quot;
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Evidence Proposals */}
            <Card>
              <CardHeader className="p-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold uppercase font-mono text-zinc-500 flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    Supporting Evidence ({extractionResult.evidence.length})
                  </CardTitle>
                  <span className="text-xs text-zinc-400 font-mono">
                    {Object.values(acceptedEvids).filter(Boolean).length} Accepted
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {extractionResult.evidence.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-2">No explicit evidence items identified in source.</p>
                ) : (
                  extractionResult.evidence.map((ev) => {
                    const isAccepted = acceptedEvids[ev.id] ?? true;
                    return (
                      <div
                        key={ev.id}
                        className={`p-3 rounded-lg border transition-all text-xs space-y-2 ${
                          isAccepted
                            ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                            : "bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200/50 dark:border-zinc-800/40 opacity-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{ev.title}</span>
                            <Badge variant="outline" size="sm">
                              {ev.type}
                            </Badge>
                          </div>

                          <Button
                            size="sm"
                            variant={isAccepted ? "primary" : "outline"}
                            className="h-6 text-[11px] px-2 gap-1"
                            onClick={() => setAcceptedEvids((prev) => ({ ...prev, [ev.id]: !isAccepted }))}
                          >
                            {isAccepted ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            {isAccepted ? "Accepted" : "Rejected"}
                          </Button>
                        </div>

                        {ev.source && (
                          <p className="text-[11px] font-mono text-zinc-400 truncate">{ev.source}</p>
                        )}

                        <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-950 text-[11px] text-zinc-500 font-mono">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">Supporting Excerpt: </span>
                          &quot;{ev.sourceExcerpt}&quot;
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Action Bar (Confirm & Save) */}
            <div className="sticky bottom-4 z-20 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs font-mono text-zinc-500">
                Ready to commit: {Object.values(acceptedAlts).filter(Boolean).length} alts,{" "}
                {Object.values(acceptedAssumps).filter(Boolean).length} assumptions,{" "}
                {Object.values(acceptedEvids).filter(Boolean).length} evidence
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSaveReviewedData(true)}
                  isLoading={isSaving}
                  className="text-xs gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" /> Save as Draft
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSaveReviewedData(false)}
                  isLoading={isSaving}
                  className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Check className="h-3.5 w-3.5" /> Confirm &amp; Preserve Fossil
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
