"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Save,
  Plus,
  Trash2,
  Layers,
  HelpCircle,
  FileText,
  AlertCircle,
  Scale,
  Calendar,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  DecisionPriority,
  DecisionStatus,
  AlternativeStatus,
  AssumptionStatus,
  EvidenceType,
  OutcomeStatus,
} from "@/types/decision";

const STEPS = [
  { id: 1, label: "Basic Info", desc: "Title & Statement" },
  { id: 2, label: "Reasoning", desc: "Problem & Rationale" },
  { id: 3, label: "Alternatives", desc: "Considered Options" },
  { id: 4, label: "Assumptions", desc: "Key Hypotheses" },
  { id: 5, label: "Evidence", desc: "Supporting Artifacts" },
  { id: 6, label: "Outcome", desc: "Expectation vs Reality" },
  { id: 7, label: "Confirm", desc: "Review & Commit" },
];

export default function NewDecisionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Step 1: Basic Information ──────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [priority, setPriority] = useState<DecisionPriority>("MEDIUM");
  const [status, setStatus] = useState<DecisionStatus>("PROPOSED");
  const [reviewDate, setReviewDate] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  // ─── Step 2: Reasoning & Context ────────────────────────────────────────
  const [context, setContext] = useState("");
  const [reasoning, setReasoning] = useState("");

  // ─── Step 3: Alternatives ───────────────────────────────────────────────
  const [alternatives, setAlternatives] = useState<
    Array<{
      name: string;
      description: string;
      pros: string;
      cons: string;
      selectionReason: string;
      status: AlternativeStatus;
      chosen: boolean;
    }>
  >([
    {
      name: "",
      description: "",
      pros: "",
      cons: "",
      selectionReason: "",
      status: "CONSIDERED",
      chosen: false,
    },
  ]);

  // ─── Step 4: Assumptions ────────────────────────────────────────────────
  const [assumptions, setAssumptions] = useState<
    Array<{
      statement: string;
      importance: DecisionPriority;
      confidence: "LOW" | "MEDIUM" | "HIGH";
      status: AssumptionStatus;
      impactNote: string;
    }>
  >([
    {
      statement: "",
      importance: "MEDIUM",
      confidence: "MEDIUM",
      status: "UNVERIFIED",
      impactNote: "",
    },
  ]);

  // ─── Step 5: Evidence ───────────────────────────────────────────────────
  const [evidenceList, setEvidenceList] = useState<
    Array<{
      title: string;
      type: EvidenceType;
      source: string;
      description: string;
    }>
  >([]);

  // ─── Step 6: Expected Outcome ───────────────────────────────────────────
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [actualOutcome, setActualOutcome] = useState("");
  const [outcomeStatus, setOutcomeStatus] = useState<OutcomeStatus>("PENDING");
  const [measurement, setMeasurement] = useState("");
  const [outcomeNotes, setOutcomeNotes] = useState("");

  // ─── Alternative Handlers ───────────────────────────────────────────────
  const addAlternative = () => {
    setAlternatives((prev) => [
      ...prev,
      {
        name: "",
        description: "",
        pros: "",
        cons: "",
        selectionReason: "",
        status: "CONSIDERED",
        chosen: false,
      },
    ]);
  };

  const removeAlternative = (index: number) => {
    setAlternatives((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAlternative = (index: number, field: string, value: any) => {
    setAlternatives((prev) =>
      prev.map((alt, i) => {
        if (i !== index) return alt;
        const updated = { ...alt, [field]: value };
        if (field === "chosen" && value === true) {
          updated.status = "SELECTED";
        }
        return updated;
      })
    );
  };

  // ─── Assumption Handlers ────────────────────────────────────────────────
  const addAssumption = () => {
    setAssumptions((prev) => [
      ...prev,
      {
        statement: "",
        importance: "MEDIUM",
        confidence: "MEDIUM",
        status: "UNVERIFIED",
        impactNote: "",
      },
    ]);
  };

  const removeAssumption = (index: number) => {
    setAssumptions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAssumption = (index: number, field: string, value: any) => {
    setAssumptions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // ─── Evidence Handlers ──────────────────────────────────────────────────
  const addEvidence = () => {
    setEvidenceList((prev) => [
      ...prev,
      {
        title: "",
        type: "NOTE",
        source: "",
        description: "",
      },
    ]);
  };

  const removeEvidence = (index: number) => {
    setEvidenceList((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEvidence = (index: number, field: string, value: any) => {
    setEvidenceList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // ─── Submission ─────────────────────────────────────────────────────────
  const handleSubmit = async (overrideStatus?: DecisionStatus) => {
    if (!title.trim() || title.length < 3) {
      toast({ type: "error", title: "Validation Error", message: "Decision Title must be at least 3 characters." });
      setCurrentStep(1);
      return;
    }
    if (!statement.trim() || statement.length < 10) {
      toast({ type: "error", title: "Validation Error", message: "Formal Decision Statement must be at least 10 characters." });
      setCurrentStep(1);
      return;
    }

    try {
      setIsSubmitting(true);
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        title,
        statement,
        priority,
        status: overrideStatus || status,
        reviewDate: reviewDate ? new Date(reviewDate).toISOString() : null,
        tags,
        context: context.trim() || undefined,
        reasoning: reasoning.trim() || undefined,
        alternatives: alternatives.filter((a) => a.name.trim()),
        assumptions: assumptions.filter((a) => a.statement.trim()),
        evidence: evidenceList.filter((e) => e.title.trim()),
        outcome: expectedOutcome.trim()
          ? {
              expectedOutcome,
              actualOutcome: actualOutcome.trim() || undefined,
              status: outcomeStatus,
              measurement: measurement.trim() || undefined,
              notes: outcomeNotes.trim() || undefined,
            }
          : undefined,
      };

      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to commit decision");
      }

      toast({
        type: "success",
        title: "Decision Preserved Successfully",
        message: `Fossil initialized: "${title}". Redirecting to details view...`,
      });

      router.push(`/decisions/${data.decision.id}`);
    } catch (err: any) {
      toast({
        type: "error",
        title: "Submission Failed",
        message: err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header & Back Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-1">
            <Link href="/decisions" className="hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> DECISIONS
            </Link>
            <span>/</span>
            <span>NEW FOSSIL WIZARD</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Record New Decision Fossil
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Capture what was decided, why, what alternatives and assumptions supported it, and expected outcomes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSubmit("DRAFT")}
            isLoading={isSubmitting}
            className="text-xs gap-1.5"
          >
            <Save className="h-3.5 w-3.5" /> Save as Draft
          </Button>
        </div>
      </div>

      {/* Step Navigator */}
      <div className="mt-6 hidden md:grid grid-cols-7 gap-2">
        {STEPS.map((step) => {
          const isActive = currentStep === step.id;
          const isDone = currentStep > step.id;
          return (
            <button
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              className={`p-3 rounded-md text-left transition-all border ${
                isActive
                  ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-900 shadow-xs"
                  : isDone
                  ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 text-zinc-700 dark:text-zinc-300"
                  : "border-zinc-200 dark:border-zinc-800/80 bg-transparent text-zinc-400"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-mono font-medium">
                <span>0{step.id}</span>
                {isDone && <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
              </div>
              <p className="text-xs font-semibold mt-1 truncate">{step.label}</p>
              <p className="text-[10px] text-zinc-500 truncate">{step.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Mobile Step Indicator */}
      <div className="md:hidden mt-4 flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs">
        <span className="font-mono font-medium">
          Step {currentStep} of 7: {STEPS[currentStep - 1].label}
        </span>
        <span className="text-[11px] text-zinc-500">{STEPS[currentStep - 1].desc}</span>
      </div>

      {/* Main Wizard Form Cards */}
      <div className="mt-8">
        {/* STEP 1: Basic Information */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Basic Decision Information</CardTitle>
              <CardDescription>
                Define the high-level decision title, formal statement, priority level, and target review date.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  Decision Title <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Standardize on PostgreSQL with Prisma for Primary Datastore"
                  required
                />
                <p className="text-[11px] text-zinc-400">Keep it descriptive and specific to the technical or architectural choice.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  Formal Decision Statement <span className="text-rose-500">*</span>
                </label>
                <Textarea
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  placeholder="What is the exact architectural or strategic decision being made?"
                  rows={3}
                  required
                />
                <p className="text-[11px] text-zinc-400">Minimum 10 characters. Example: &quot;We will adopt Kafka as the primary streaming bus for data ingestion.&quot;</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Priority / Impact</label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Initial Status</label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PROPOSED">Proposed</option>
                    <option value="DECIDED">Decided</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Reassessment / Review Date</label>
                  <Input
                    type="date"
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  Tags (comma separated)
                </label>
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="infrastructure, database, backend, security"
                  className="text-xs"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: Reasoning & Constraints */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Problem Space &amp; Architectural Reasoning</CardTitle>
              <CardDescription>
                Record the context, underlying constraints, and primary reason why this decision is necessary.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  What problem is being solved? (Context &amp; Constraints)
                </label>
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Describe the operational, organizational, or technical situation that prompted this decision..."
                  rows={4}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  Why is this decision necessary? (Primary Rationale)
                </label>
                <Textarea
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  placeholder="Explain why this approach was chosen and what trade-offs were accepted..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: Alternatives Considered */}
        {currentStep === 3 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Step 3: Alternatives Considered</CardTitle>
                <CardDescription>
                  Capture the rejected or competing architectural paths evaluated, along with their trade-offs.
                </CardDescription>
              </div>
              <Button onClick={addAlternative} size="sm" variant="outline" className="text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Option
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {alternatives.map((alt, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold uppercase text-zinc-500">
                      Option #{idx + 1}
                    </span>
                    {alternatives.length > 1 && (
                      <button
                        onClick={() => removeAlternative(idx)}
                        className="text-zinc-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-xs font-medium">Alternative Name</label>
                      <Input
                        value={alt.name}
                        onChange={(e) => updateAlternative(idx, "name", e.target.value)}
                        placeholder="e.g. Apache Kafka, MongoDB, DynamoDB"
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Disposition / Status</label>
                      <select
                        value={alt.status}
                        onChange={(e: any) => updateAlternative(idx, "status", e.target.value)}
                        className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs"
                      >
                        <option value="CONSIDERED">Considered</option>
                        <option value="SELECTED">Selected</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium">Description</label>
                    <Input
                      value={alt.description}
                      onChange={(e) => updateAlternative(idx, "description", e.target.value)}
                      placeholder="Brief summary of how this option would work..."
                      className="text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        Advantages / Pros
                      </label>
                      <Textarea
                        value={alt.pros}
                        onChange={(e) => updateAlternative(idx, "pros", e.target.value)}
                        placeholder="Key advantages, speed, cost efficiency..."
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-rose-700 dark:text-rose-400">
                        Disadvantages / Cons
                      </label>
                      <Textarea
                        value={alt.cons}
                        onChange={(e) => updateAlternative(idx, "cons", e.target.value)}
                        placeholder="Drawbacks, operational complexity, limitations..."
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium">Selection / Rejection Reason</label>
                    <Input
                      value={alt.selectionReason}
                      onChange={(e) => updateAlternative(idx, "selectionReason", e.target.value)}
                      placeholder="Why was this option chosen or ruled out?"
                      className="text-xs"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* STEP 4: Assumptions */}
        {currentStep === 4 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Step 4: Foundational Assumptions</CardTitle>
                <CardDescription>
                  Record the operational, scale, or organizational assumptions upon which this decision rests.
                </CardDescription>
              </div>
              <Button onClick={addAssumption} size="sm" variant="outline" className="text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Assumption
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {assumptions.map((assump, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold uppercase text-zinc-500">
                      Assumption #{idx + 1}
                    </span>
                    {assumptions.length > 1 && (
                      <button
                        onClick={() => removeAssumption(idx)}
                        className="text-zinc-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium">Assumption Statement</label>
                    <Input
                      value={assump.statement}
                      onChange={(e) => updateAssumption(idx, "statement", e.target.value)}
                      placeholder="e.g. Daily ingress traffic will remain below 10,000 req/sec"
                      className="text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Importance</label>
                      <select
                        value={assump.importance}
                        onChange={(e: any) => updateAssumption(idx, "importance", e.target.value)}
                        className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium">Confidence Level</label>
                      <select
                        value={assump.confidence}
                        onChange={(e: any) => updateAssumption(idx, "confidence", e.target.value)}
                        className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium">Current Status</label>
                      <select
                        value={assump.status}
                        onChange={(e: any) => updateAssumption(idx, "status", e.target.value)}
                        className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs"
                      >
                        <option value="UNVERIFIED">Unverified</option>
                        <option value="VALID">Valid</option>
                        <option value="QUESTIONABLE">Questionable</option>
                        <option value="INVALID">Invalid</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium">Impact Note</label>
                    <Input
                      value={assump.impactNote}
                      onChange={(e) => updateAssumption(idx, "impactNote", e.target.value)}
                      placeholder="What happens to the decision if this assumption fails?"
                      className="text-xs"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* STEP 5: Evidence */}
        {currentStep === 5 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Step 5: Supporting Evidence</CardTitle>
                <CardDescription>
                  Attach benchmarks, metrics, documents, or URLs that substantiate this decision.
                </CardDescription>
              </div>
              <Button onClick={addEvidence} size="sm" variant="outline" className="text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Attach Evidence
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {evidenceList.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-500">
                  No evidence items attached yet. Click &quot;Attach Evidence&quot; to link benchmarks, documentation, or experiment results.
                </div>
              ) : (
                evidenceList.map((ev, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold uppercase text-zinc-500">
                        Evidence #{idx + 1}
                      </span>
                      <button
                        onClick={() => removeEvidence(idx)}
                        className="text-zinc-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-xs font-medium">Evidence Title</label>
                        <Input
                          value={ev.title}
                          onChange={(e) => updateEvidence(idx, "title", e.target.value)}
                          placeholder="e.g. pgbench query benchmark results"
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Type</label>
                        <select
                          value={ev.type}
                          onChange={(e: any) => updateEvidence(idx, "type", e.target.value)}
                          className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs"
                        >
                          <option value="NOTE">Note</option>
                          <option value="URL">URL</option>
                          <option value="DOCUMENT">Document</option>
                          <option value="BENCHMARK">Benchmark</option>
                          <option value="DATASET">Dataset</option>
                          <option value="EXPERIMENT">Experiment</option>
                          <option value="DISCUSSION">Discussion</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium">Source / Link / Citation</label>
                      <Input
                        value={ev.source}
                        onChange={(e) => updateEvidence(idx, "source", e.target.value)}
                        placeholder="https://grafana.internal/... or document reference"
                        className="text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium">Description</label>
                      <Textarea
                        value={ev.description}
                        onChange={(e) => updateEvidence(idx, "description", e.target.value)}
                        placeholder="What did this evidence demonstrate?"
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 6: Expected Outcome */}
        {currentStep === 6 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 6: Expected Outcome &amp; Success Criteria</CardTitle>
              <CardDescription>
                Define the expected outcome to enable future comparison of Expectation vs. Reality.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  Expected Outcome
                </label>
                <Textarea
                  value={expectedOutcome}
                  onChange={(e) => setExpectedOutcome(e.target.value)}
                  placeholder="What is expected to happen after this decision is implemented? (e.g. Database p99 latency stays below 15ms)"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Outcome Status</label>
                  <select
                    value={outcomeStatus}
                    onChange={(e: any) => setOutcomeStatus(e.target.value)}
                    className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs"
                  >
                    <option value="PENDING">Pending (Observation Phase)</option>
                    <option value="ACHIEVED">Achieved</option>
                    <option value="PARTIALLY_ACHIEVED">Partially Achieved</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Target Metrics / Measurement</label>
                  <Input
                    value={measurement}
                    onChange={(e) => setMeasurement(e.target.value)}
                    placeholder="e.g. Latency < 15ms, CPU < 60%"
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Additional Notes</label>
                <Textarea
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  placeholder="Any telemetry or monitoring notes..."
                  rows={2}
                  className="text-xs"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 7: Review & Confirm */}
        {currentStep === 7 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 7: Confirm &amp; Preserve Decision Fossil</CardTitle>
              <CardDescription>
                Review the complete decision record before committing it to the permanent decision intelligence graph.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default">{priority}</Badge>
                  <Badge variant="warning">{status}</Badge>
                  {reviewDate && (
                    <span className="text-xs text-zinc-500 font-mono">
                      Review: {reviewDate}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold">{title || "Untitled Decision"}</h3>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {statement || "No formal statement specified."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1 text-xs">
                  <h4 className="font-semibold text-zinc-500 font-mono uppercase">Reasoning Summary</h4>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    {reasoning || context ? (reasoning || context) : "None provided"}
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1 text-xs">
                  <h4 className="font-semibold text-zinc-500 font-mono uppercase">Counts &amp; Attachments</h4>
                  <ul className="space-y-1 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                    <li>• {alternatives.filter((a) => a.name.trim()).length} Alternatives registered</li>
                    <li>• {assumptions.filter((a) => a.statement.trim()).length} Assumptions tracked</li>
                    <li>• {evidenceList.filter((e) => e.title.trim()).length} Evidence items attached</li>
                    <li>• Expected Outcome: {expectedOutcome ? "Defined" : "Deferred"}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Navigation Buttons Footer */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <div>
          {currentStep > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="gap-1.5 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Previous
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentStep < 7 ? (
            <Button
              size="sm"
              onClick={() => {
                if (currentStep === 1) {
                  if (!title.trim() || title.length < 3) {
                    toast({ type: "error", title: "Validation Error", message: "Decision Title must be at least 3 characters." });
                    return;
                  }
                  if (!statement.trim() || statement.length < 10) {
                    toast({ type: "error", title: "Validation Error", message: "Formal Decision Statement must be at least 10 characters." });
                    return;
                  }
                }
                setCurrentStep((prev) => prev + 1);
              }}
              className="gap-1.5 text-xs"
            >
              Next Step <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => handleSubmit()}
              isLoading={isSubmitting}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Confirm &amp; Preserve Decision
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
