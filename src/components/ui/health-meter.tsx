"use client";

import React, { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  Info,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DecisionHealthResult } from "@/types/decision";

interface DecisionHealthMeterProps {
  health: DecisionHealthResult | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  onRequestReassess?: () => void;
}

export function DecisionHealthMeter({
  health,
  isLoading,
  onRefresh,
  onRequestReassess,
}: DecisionHealthMeterProps) {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  if (isLoading) {
    return (
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardContent className="p-4 flex items-center justify-center gap-2 text-xs text-zinc-500 font-mono py-8">
          <RefreshCw className="h-4 w-4 animate-spin text-zinc-400" />
          Evaluating decision defensibility &amp; health telemetry...
        </CardContent>
      </Card>
    );
  }

  if (!health) {
    return null;
  }

  const { score, status, summary, factors, warnings, recommendations, metrics } = health;

  // Status Styling Configuration
  const statusConfig = {
    HEALTHY: {
      color: "text-emerald-500 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      barBg: "bg-emerald-500",
      badgeVariant: "success" as const,
      icon: ShieldCheck,
      label: "HEALTHY",
    },
    NEEDS_ATTENTION: {
      color: "text-amber-500 dark:text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      barBg: "bg-amber-500",
      badgeVariant: "warning" as const,
      icon: Activity,
      label: "NEEDS ATTENTION",
    },
    AT_RISK: {
      color: "text-orange-500 dark:text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      barBg: "bg-orange-500",
      badgeVariant: "warning" as const,
      icon: AlertTriangle,
      label: "AT RISK",
    },
    CRITICAL: {
      color: "text-rose-500 dark:text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/30",
      barBg: "bg-rose-500",
      badgeVariant: "destructive" as const,
      icon: ShieldAlert,
      label: "CRITICAL RISK",
    },
  }[status] || {
    color: "text-zinc-500",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/30",
    barBg: "bg-zinc-500",
    badgeVariant: "outline" as const,
    icon: HelpCircle,
    label: status,
  };

  const StatusIcon = statusConfig.icon;

  return (
    <Card className={`border ${statusConfig.border} transition-all`}>
      <CardHeader className="p-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} /> Decision Health &amp; Defensibility
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={statusConfig.badgeVariant} size="sm" className="font-mono text-[10px]">
              {statusConfig.label}
            </Badge>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                title="Recalculate Health Score"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Score & Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono tracking-tight ${statusConfig.color}`}>
                {score}
              </span>
              <span className="text-xs font-mono text-zinc-400">/ 100</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">
              Evaluated {new Date(health.evaluatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {/* Linear Meter */}
          <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className={`h-full ${statusConfig.barBg} transition-all duration-500 ease-out`}
              style={{ width: `${Math.max(4, score)}%` }}
            />
          </div>
        </div>

        {/* Narrative Summary */}
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          {summary}
        </p>

        {/* Metric Badges Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-mono text-zinc-400 uppercase block">Assumptions</span>
            <span className="text-xs font-bold font-mono text-zinc-800 dark:text-zinc-200">
              {metrics.invalidatedAssumptions > 0 ? (
                <span className="text-rose-500">-{metrics.invalidatedAssumptions} invalid</span>
              ) : metrics.challengedAssumptions > 0 ? (
                <span className="text-amber-500">~{metrics.challengedAssumptions} chall.</span>
              ) : (
                <span className="text-emerald-500">OK ({metrics.totalAssumptions})</span>
              )}
            </span>
          </div>

          <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-mono text-zinc-400 uppercase block">Evidence</span>
            <span className="text-xs font-bold font-mono text-zinc-800 dark:text-zinc-200">
              {metrics.contradictingEvidence > 0 ? (
                <span className="text-rose-500">{metrics.contradictingEvidence} dispute</span>
              ) : metrics.totalEvidence === 0 ? (
                <span className="text-amber-500">0 attached</span>
              ) : (
                <span className="text-emerald-500">{metrics.totalEvidence} verified</span>
              )}
            </span>
          </div>

          <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-mono text-zinc-400 uppercase block">Outcomes</span>
            <span className="text-xs font-bold font-mono text-zinc-800 dark:text-zinc-200">
              {metrics.failedOutcomes > 0 ? (
                <span className="text-rose-500">{metrics.failedOutcomes} failed</span>
              ) : metrics.achievedOutcomes > 0 ? (
                <span className="text-emerald-500">{metrics.achievedOutcomes} achieved</span>
              ) : (
                <span className="text-zinc-400">{metrics.totalOutcomes} logged</span>
              )}
            </span>
          </div>
        </div>

        {/* Action Button for Risky Decisions */}
        {(status === "CRITICAL" || status === "AT_RISK" || status === "NEEDS_ATTENTION") && onRequestReassess && (
          <Button
            onClick={onRequestReassess}
            size="sm"
            variant={status === "CRITICAL" ? "danger" : "outline"}
            className="w-full text-xs gap-1.5 h-8 font-medium"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Initiate Decision Reassessment Workflow
          </Button>
        )}

        {/* Toggleable Breakdown Details */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
            className="w-full flex items-center justify-between text-[11px] font-mono text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            <span>{isDetailsExpanded ? "Hide Audit Breakdown" : "View Deductions & Recommendations"}</span>
            {isDetailsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {isDetailsExpanded && (
            <div className="mt-3 space-y-3 pt-1 text-xs">
              {/* Itemized Deductions */}
              {factors.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase text-zinc-400 block font-semibold">
                    Health Factor Deductions ({factors.length})
                  </span>
                  <div className="space-y-1">
                    {factors.map((f, i) => (
                      <div
                        key={i}
                        className="p-2 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-2 text-[11px]"
                      >
                        <div className="space-y-0.5">
                          <p className="text-zinc-800 dark:text-zinc-200 font-medium leading-tight">
                            {f.reason}
                          </p>
                          <span className="text-[9px] font-mono text-zinc-400 uppercase">
                            Factor: {f.factor}
                          </span>
                        </div>
                        <span className="font-mono text-rose-500 font-bold shrink-0">
                          -{f.deduction}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[11px] flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Zero defensibility deductions. All decision pillars intact.
                </div>
              )}

              {/* Actionable Recommendations */}
              {recommendations.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-mono uppercase text-zinc-400 block font-semibold">
                    Recommended Actions
                  </span>
                  <ul className="space-y-1 list-disc list-inside text-[11px] text-zinc-600 dark:text-zinc-400">
                    {recommendations.map((rec, i) => (
                      <li key={i} className="leading-snug">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
