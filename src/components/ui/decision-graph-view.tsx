"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  GitBranch,
  ArrowRight,
  Plus,
  Trash2,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DecisionGraph, GraphNode, GraphEdge, RelationshipType } from "@/types/decision";

interface DecisionGraphViewProps {
  graph: DecisionGraph | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  onAddRelationship?: () => void;
  onRemoveRelationship?: (relId: string) => void;
}

export function DecisionGraphView({
  graph,
  isLoading,
  onRefresh,
  onAddRelationship,
  onRemoveRelationship,
}: DecisionGraphViewProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Compute 2D node layout positions
  const layout = useMemo(() => {
    if (!graph || graph.nodes.length === 0) return { nodesWithPos: [], width: 700, height: 440 };

    const width = 740;
    const height = 440;
    const centerX = width / 2;
    const centerY = height / 2;

    const rootNode = graph.nodes.find((n) => n.id === graph.rootId) || graph.nodes[0];
    const otherNodes = graph.nodes.filter((n) => n.id !== rootNode.id);

    const nodesWithPos: Array<GraphNode & { x: number; y: number; isRoot: boolean }> = [
      { ...rootNode, x: centerX, y: centerY, isRoot: true },
    ];

    if (otherNodes.length > 0) {
      const radius = otherNodes.length <= 4 ? 180 : 210;
      otherNodes.forEach((node, index) => {
        const angle = (2 * Math.PI * index) / otherNodes.length - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        nodesWithPos.push({ ...node, x, y, isRoot: false });
      });
    }

    return { nodesWithPos, width, height };
  }, [graph]);

  if (isLoading) {
    return (
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardContent className="p-8 text-center text-xs text-zinc-500 font-mono flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-zinc-400" />
          Mapping architectural decision knowledge graph &amp; dependency topologies...
        </CardContent>
      </Card>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <Card className="border-dashed border-zinc-200 dark:border-zinc-800">
        <CardContent className="p-8 text-center space-y-3">
          <GitBranch className="h-8 w-8 text-zinc-400 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">No Decision Relationships Found</p>
            <p className="text-xs text-zinc-500">
              Connect this decision to prerequisites, superseded architectures, or conflicting alternatives.
            </p>
          </div>
          {onAddRelationship && (
            <Button size="sm" onClick={onAddRelationship} className="text-xs gap-1">
              <Plus className="h-3.5 w-3.5" /> Link Related Decision
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const nodeMap = new Map(layout.nodesWithPos.map((n) => [n.id, n]));

  const getEdgeColor = (type: RelationshipType) => {
    switch (type) {
      case "DEPENDS_ON":
        return "#3b82f6"; // Blue
      case "SUPERSEDES":
        return "#8b5cf6"; // Purple
      case "CONFLICTS_WITH":
        return "#ef4444"; // Red
      case "SUPPORTS":
        return "#10b981"; // Emerald
      case "SHARES_ASSUMPTION":
        return "#f59e0b"; // Amber
      default:
        return "#71717a"; // Zinc
    }
  };

  return (
    <Card className="border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <CardHeader className="p-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" /> Architecture Relationship Graph ({graph.nodes.length} nodes, {graph.edges.length} edges)
            </CardTitle>
            {graph.cyclesDetected && (
              <Badge variant="destructive" size="sm" className="text-[10px] font-mono">
                CYCLE DETECTED
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(1.5, z + 0.1))}
              className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.1))}
              className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <Link
              href={`/decisions/${graph.rootId}/graph`}
              className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              title="Full Page Graph Topology"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Link>
            {onAddRelationship && (
              <Button size="sm" variant="outline" onClick={onAddRelationship} className="text-xs gap-1 h-7 ml-2">
                <Plus className="h-3 w-3" /> Link Decision
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 relative bg-zinc-50/50 dark:bg-zinc-950/50">
        {/* SVG Graph Canvas */}
        <div className="overflow-auto max-h-[460px] flex justify-center p-4">
          <svg
            width={layout.width * zoomLevel}
            height={layout.height * zoomLevel}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="transition-transform duration-150 select-none"
          >
            <defs>
              <marker
                id="arrow-generic"
                viewBox="0 0 10 10"
                refX="28"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
              </marker>
              <marker
                id="arrow-depends"
                viewBox="0 0 10 10"
                refX="28"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
              </marker>
              <marker
                id="arrow-supersedes"
                viewBox="0 0 10 10"
                refX="28"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#8b5cf6" />
              </marker>
              <marker
                id="arrow-conflicts"
                viewBox="0 0 10 10"
                refX="28"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
              </marker>
            </defs>

            {/* Edge Connecting Lines */}
            {graph.edges.map((edge) => {
              const srcNode = nodeMap.get(edge.source);
              const tgtNode = nodeMap.get(edge.target);
              if (!srcNode || !tgtNode) return null;

              const strokeColor = getEdgeColor(edge.type);
              const markerId =
                edge.type === "DEPENDS_ON"
                  ? "url(#arrow-depends)"
                  : edge.type === "SUPERSEDES"
                  ? "url(#arrow-supersedes)"
                  : edge.type === "CONFLICTS_WITH"
                  ? "url(#arrow-conflicts)"
                  : "url(#arrow-generic)";

              const midX = (srcNode.x + tgtNode.x) / 2;
              const midY = (srcNode.y + tgtNode.y) / 2;

              return (
                <g key={edge.id} className="group cursor-pointer">
                  <line
                    x1={srcNode.x}
                    y1={srcNode.y}
                    x2={tgtNode.x}
                    y2={tgtNode.y}
                    stroke={strokeColor}
                    strokeWidth={edge.type === "DEPENDS_ON" ? 2.5 : 2}
                    strokeDasharray={edge.type === "CONFLICTS_WITH" ? "4,4" : undefined}
                    markerEnd={markerId}
                    className="opacity-70 group-hover:opacity-100 transition-opacity"
                  />
                  {/* Label pill on mid-point */}
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-38"
                      y="-9"
                      width="76"
                      height="18"
                      rx="9"
                      fill="#ffffff"
                      stroke={strokeColor}
                      strokeWidth="1"
                      className="dark:fill-zinc-900 shadow-xs"
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-[9px] font-mono fill-zinc-700 dark:fill-zinc-300 font-semibold"
                    >
                      {edge.type.slice(0, 11)}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Decision Nodes */}
            {layout.nodesWithPos.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isRoot = node.isRoot;

              let healthBadgeColor = "#10b981"; // Emerald
              if (node.healthStatus === "CRITICAL") healthBadgeColor = "#f43f5e";
              else if (node.healthStatus === "AT_RISK") healthBadgeColor = "#f97316";
              else if (node.healthStatus === "NEEDS_ATTENTION") healthBadgeColor = "#f59e0b";

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => setSelectedNode(node)}
                  className="cursor-pointer group"
                >
                  {/* Node container card */}
                  <rect
                    x="-85"
                    y="-30"
                    width="170"
                    height="60"
                    rx="8"
                    fill={isRoot ? "currentColor" : "#ffffff"}
                    className={`${
                      isRoot
                        ? "text-zinc-900 dark:text-zinc-100"
                        : "dark:fill-zinc-900 shadow-sm hover:shadow-md"
                    } ${
                      isSelected
                        ? "stroke-blue-500 stroke-2"
                        : "stroke-zinc-200 dark:stroke-zinc-800 stroke-1"
                    } transition-all`}
                  />

                  {/* Root indicator tag */}
                  {isRoot && (
                    <rect
                      x="-85"
                      y="-30"
                      width="170"
                      height="5"
                      rx="2"
                      fill="#3b82f6"
                    />
                  )}

                  {/* Health score circle */}
                  {node.healthScore !== undefined && (
                    <circle
                      cx="65"
                      cy="-15"
                      r="6"
                      fill={healthBadgeColor}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Status label */}
                  <text
                    x="-75"
                    y="-15"
                    className={`text-[9px] font-mono uppercase font-semibold ${
                      isRoot ? "fill-zinc-400 dark:fill-zinc-500" : "fill-zinc-400"
                    }`}
                  >
                    {node.status}
                  </text>

                  {/* Title */}
                  <text
                    x="-75"
                    y="5"
                    className={`text-[11px] font-semibold ${
                      isRoot
                        ? "fill-white dark:fill-zinc-900"
                        : "fill-zinc-900 dark:fill-zinc-100"
                    }`}
                  >
                    {node.title.length > 20 ? node.title.slice(0, 19) + "…" : node.title}
                  </text>

                  {/* Subtitle / Priority */}
                  <text
                    x="-75"
                    y="20"
                    className={`text-[9px] font-mono ${
                      isRoot ? "fill-zinc-400 dark:fill-zinc-600" : "fill-zinc-500"
                    }`}
                  >
                    {node.priority} Priority {node.healthScore !== undefined ? `• ${node.healthScore}pts` : ""}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Node Details Drawer / Popover */}
        {selectedNode && (
          <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedNode.title}
                </span>
                <Badge variant="outline" size="sm" className="text-[10px] font-mono">
                  {selectedNode.status}
                </Badge>
                {selectedNode.healthScore !== undefined && (
                  <span className="font-mono text-[10px] text-zinc-500">
                    Defensibility: {selectedNode.healthScore}/100 ({selectedNode.healthStatus})
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/decisions/${selectedNode.id}`}
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-mono"
              >
                Open Fossil <ExternalLink className="h-3 w-3" />
              </Link>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs ml-2"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
