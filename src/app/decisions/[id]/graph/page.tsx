"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  GitBranch,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { DecisionGraphView } from "@/components/ui/decision-graph-view";
import { DecisionGraph, RelationshipType } from "@/types/decision";

export default function DecisionGraphPage() {
  const params = useParams();
  const id = params?.id as string;
  const { toast } = useToast();

  const [graph, setGraph] = useState<DecisionGraph | null>(null);
  const [relationships, setRelationships] = useState<any>({ outgoing: [], incoming: [] });
  const [allDecisions, setAllDecisions] = useState<any[]>([]);
  const [depth, setDepth] = useState<number>(2);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Link Relationship Modal
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [targetDecisionId, setTargetDecisionId] = useState("");
  const [relType, setRelType] = useState<RelationshipType>("DEPENDS_ON");
  const [relDescription, setRelDescription] = useState("");
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);

  const fetchGraphData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);

      const [graphRes, relRes, decListRes] = await Promise.all([
        fetch(`/api/decisions/${id}/graph?depth=${depth}`),
        fetch(`/api/decisions/${id}/relationships`),
        fetch(`/api/decisions`),
      ]);

      const [graphData, relData, decListData] = await Promise.all([
        graphRes.json(),
        relRes.json(),
        decListRes.json(),
      ]);

      if (!graphRes.ok || !graphData.success) {
        throw new Error(graphData.error || "Failed to load decision knowledge graph");
      }

      setGraph(graphData.graph);
      if (relRes.ok && relData.success) {
        setRelationships({ outgoing: relData.outgoing || [], incoming: relData.incoming || [] });
      }
      if (decListRes.ok && decListData.success) {
        setAllDecisions(decListData.decisions?.filter((d: any) => d.id !== id) || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, [id, depth]);

  const handleAddRelationship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDecisionId) {
      toast({ type: "error", title: "Target Missing", message: "Please select a target decision to connect." });
      return;
    }

    try {
      setIsSubmittingLink(true);
      const res = await fetch(`/api/decisions/${id}/relationships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetDecisionId,
          type: relType,
          description: relDescription.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to establish relationship");
      }

      toast({
        type: "success",
        title: "Relationship Preserved",
        message: `Linked decision under relationship: ${relType}`,
      });

      setIsLinkModalOpen(false);
      setTargetDecisionId("");
      setRelDescription("");
      fetchGraphData();
    } catch (err: any) {
      toast({ type: "error", title: "Action Blocked", message: err.message });
    } finally {
      setIsSubmittingLink(false);
    }
  };

  const handleRemoveRelationship = async (relId: string) => {
    try {
      const res = await fetch(`/api/decisions/${id}/relationships/${relId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to remove relationship");
      }

      toast({
        type: "success",
        title: "Relationship Removed",
        message: "Disconnected relationship edge.",
      });
      fetchGraphData();
    } catch (err: any) {
      toast({ type: "error", title: "Delete Failed", message: err.message });
    }
  };

  if (isLoading && !graph) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <LoadingState message="Traversing multi-hop decision dependency graph..." />
      </div>
    );
  }

  if (error && !graph) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <ErrorState
          title="Graph Traversal Failed"
          message={error}
          onRetry={fetchGraphData}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-2">
            <Link href={`/decisions/${id}`} className="hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              BACK TO FOSSIL
            </Link>
            <span>/</span>
            <span>TOPOLOGY GRAPH</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-blue-500" />
            Decision Knowledge Graph &amp; Architectural Lineage
          </h1>
        </div>

        {/* Depth & Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono">
            <span className="text-zinc-400">Depth:</span>
            {[1, 2, 3, 4].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDepth(d)}
                className={`px-1.5 py-0.5 rounded ${
                  depth === d
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            onClick={() => setIsLinkModalOpen(true)}
            className="text-xs gap-1 h-8"
          >
            <Plus className="h-3.5 w-3.5" /> Link Related Decision
          </Button>
        </div>
      </div>

      {/* Main Graph Canvas */}
      <DecisionGraphView
        graph={graph}
        isLoading={isLoading}
        onRefresh={fetchGraphData}
        onAddRelationship={() => setIsLinkModalOpen(true)}
        onRemoveRelationship={handleRemoveRelationship}
      />

      {/* Itemized Relationships List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Outgoing Relationships */}
        <Card>
          <CardHeader className="p-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-500">
              Outgoing Dependencies &amp; Supersessions ({relationships.outgoing.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {relationships.outgoing.length === 0 ? (
              <p className="text-xs text-zinc-400 font-mono py-2">No outgoing relationships defined.</p>
            ) : (
              relationships.outgoing.map((rel: any) => (
                <div
                  key={rel.id}
                  className="p-3 rounded border border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                        {rel.type}
                      </Badge>
                      <Link
                        href={`/decisions/${rel.targetDecision.id}`}
                        className="font-semibold text-zinc-900 dark:text-zinc-100 hover:underline flex items-center gap-1"
                      >
                        {rel.targetDecision.title}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    {rel.description && (
                      <p className="text-zinc-500 text-[11px]">{rel.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveRelationship(rel.id)}
                    className="text-zinc-400 hover:text-rose-500 h-7 w-7 p-0 shrink-0"
                    title="Remove Relationship"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Incoming Relationships */}
        <Card>
          <CardHeader className="p-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-500">
              Incoming Dependents &amp; References ({relationships.incoming.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {relationships.incoming.length === 0 ? (
              <p className="text-xs text-zinc-400 font-mono py-2">No decisions currently depend on this fossil.</p>
            ) : (
              relationships.incoming.map((rel: any) => (
                <div
                  key={rel.id}
                  className="p-3 rounded border border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                        {rel.type}
                      </Badge>
                      <Link
                        href={`/decisions/${rel.sourceDecision.id}`}
                        className="font-semibold text-zinc-900 dark:text-zinc-100 hover:underline flex items-center gap-1"
                      >
                        {rel.sourceDecision.title}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    {rel.description && (
                      <p className="text-zinc-500 text-[11px]">{rel.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveRelationship(rel.id)}
                    className="text-zinc-400 hover:text-rose-500 h-7 w-7 p-0 shrink-0"
                    title="Remove Relationship"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Link Relationship Modal */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-semibold">Connect Architectural Relationship</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Connect this decision to another architectural choice. Cycle detection will enforce acyclic dependencies.
            </p>

            <form onSubmit={handleAddRelationship} className="space-y-4 mt-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">Relationship Type</label>
                <select
                  value={relType}
                  onChange={(e) => setRelType(e.target.value as RelationshipType)}
                  className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs"
                >
                  <option value="DEPENDS_ON">DEPENDS_ON — Prerequisite architectural choice</option>
                  <option value="SUPERSEDES">SUPERSEDES — Replaces and marks target superseded</option>
                  <option value="CONFLICTS_WITH">CONFLICTS_WITH — Mutual architectural friction</option>
                  <option value="SUPPORTS">SUPPORTS — Complements or reinforces reasoning</option>
                  <option value="SHARES_ASSUMPTION">SHARES_ASSUMPTION — Shared premise or hypothesis</option>
                  <option value="RELATES_TO">RELATES_TO — Contextual association</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Target Decision</label>
                <select
                  value={targetDecisionId}
                  onChange={(e) => setTargetDecisionId(e.target.value)}
                  className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-800 bg-transparent px-3 text-xs"
                  required
                >
                  <option value="">Select a decision to link...</option>
                  {allDecisions.map((dec) => (
                    <option key={dec.id} value={dec.id}>
                      {dec.title} ({dec.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Context / Justification (Optional)</label>
                <Textarea
                  value={relDescription}
                  onChange={(e) => setRelDescription(e.target.value)}
                  placeholder="Explain why these decisions are linked..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLinkModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isSubmittingLink}>
                  Preserve Connection
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
