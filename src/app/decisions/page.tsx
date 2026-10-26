"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Filter,
  Layers,
  ArrowUpRight,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DecisionStatusBadge } from "@/components/ui/status-badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { DecisionStatus } from "@/types/decision";

interface DecisionListItem {
  id: string;
  title: string;
  statement: string;
  status: DecisionStatus;
  priority: string;
  currentVersion: number;
  reviewDate: string | null;
  updatedAt: string;
  creator: { name: string; email: string };
  alternatives: any[];
  assumptions: any[];
  evidence: any[];
  outcomes: any[];
}

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState<DecisionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // New Decision Form State
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");
  const [context, setContext] = useState("");
  const [reasoning, setReasoning] = useState("");

  const fetchDecisions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const query = new URLSearchParams();
      if (statusFilter !== "ALL") query.append("status", statusFilter);
      if (search.trim()) query.append("search", search.trim());

      const res = await fetch(`/api/decisions?${query.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load decisions");
      }
      setDecisions(data.decisions);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDecisions();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDecisions();
  };

  const handleCreateDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          statement,
          priority,
          context,
          reasoning,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create decision");
      }

      toast({
        type: "success",
        title: "Decision Fossil Initialized",
        message: `Version 1 recorded for "${title}".`,
      });

      setIsModalOpen(false);
      setTitle("");
      setStatement("");
      setContext("");
      setReasoning("");
      fetchDecisions();
    } catch (err: any) {
      toast({
        type: "error",
        title: "Creation Failed",
        message: err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-1">
            <span>REPOSITORY</span>
            <span>/</span>
            <span>DECISIONS</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Decision Index
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Permanent record of architectural, technical, and organizational choices with underlying rationale.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/decisions/extract">
            <Button
              variant="outline"
              className="gap-2 border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/40"
            >
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              AI Extract
            </Button>
          </Link>
          <Link href="/decisions/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Decision Wizard
            </Button>
          </Link>
          <Button onClick={() => setIsModalOpen(true)} variant="outline" className="text-xs">
            Quick Add
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, statement, or rationale keywords..."
            className="pl-9 text-xs"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PROPOSED">Proposed</option>
            <option value="DECIDED">Decided</option>
            <option value="MONITORING">Monitoring</option>
            <option value="REASSESSING">Reassessing</option>
            <option value="VALIDATED">Validated</option>
            <option value="REJECTED">Rejected</option>
            <option value="SUPERSEDED">Superseded</option>
          </select>
          <Button onClick={fetchDecisions} variant="secondary" size="sm" className="text-xs">
            Filter
          </Button>
        </div>
      </div>

      {/* Decision Listing */}
      <div className="mt-6">
        {isLoading ? (
          <LoadingState message="Extracting preserved decision fossils..." />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchDecisions} />
        ) : decisions.length === 0 ? (
          <EmptyState
            title="No decisions recorded yet"
            description="Start capturing architectural reasoning, assumptions, alternatives, and validation requirements."
            actionLabel="Initialize First Decision"
            onAction={() => setIsModalOpen(true)}
          />
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            {decisions.map((decision) => (
              <div
                key={decision.id}
                className="p-5 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/decisions/${decision.id}`}
                      className="text-base font-semibold text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1.5"
                    >
                      {decision.title}
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
                    </Link>
                    <DecisionStatusBadge status={decision.status} size="sm" />
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400">
                      v{decision.currentVersion}
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400">
                      {decision.priority}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 max-w-3xl">
                    {decision.statement}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-zinc-400 pt-1">
                    <span>Owner: {decision.creator?.name || "System"}</span>
                    <span>•</span>
                    <span>{decision.assumptions?.length || 0} Assumptions</span>
                    <span>•</span>
                    <span>{decision.alternatives?.length || 0} Alternatives</span>
                    <span>•</span>
                    <span>{decision.evidence?.length || 0} Evidence Links</span>
                    <span>•</span>
                    <span>Updated {new Date(decision.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/decisions/${decision.id}`}>
                    <Button variant="outline" size="sm" className="text-xs">
                      Inspect Fossil
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-base font-semibold">Initialize Decision Fossil</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDecision} className="space-y-4 mt-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Adopt Event-Driven Kafka Architecture for Ingestion"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Formal Decision Statement</label>
                <Textarea
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  placeholder="What is the precise architectural decision being made?"
                  rows={2}
                  required
                />
              </div>

              <div className="space-y-1">
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

              <div className="space-y-1">
                <label className="text-xs font-medium">Context / Problem Space (Optional)</label>
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="What situation prompted this decision?"
                  rows={2}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Primary Rationale / Why (Optional)</label>
                <Textarea
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  placeholder="Why is this chosen over other candidates?"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isSubmitting}>
                  Preserve Decision
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
