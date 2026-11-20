import { prisma } from "@/lib/db";
import {
  DecisionHealthResult,
  HealthFactor,
  HealthMetrics,
  HealthStatus,
} from "@/types/decision";

export class HealthService {
  /**
   * Deterministically calculates the health score, risk factors, warnings,
   * and recommendations for a given decision.
   */
  static async calculateDecisionHealth(decisionId: string): Promise<DecisionHealthResult> {
    const decision: any = await prisma.decision.findUnique({
      where: { id: decisionId },
      include: {
        assumptions: {
          include: {
            assumption: {
              include: {
                evidenceLinks: true,
              },
            },
          },
        },
        evidence: {
          include: {
            evidence: true,
          },
        },
        outcomes: true,
      },
    });

    if (!decision) {
      throw new Error(`Decision with ID "${decisionId}" not found`);
    }

    const now = new Date();
    let score = 100;
    const factors: HealthFactor[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // 1. Evaluate Assumptions
    const rawAssumptions = decision.assumptions.map((da: any) => da.assumption);
    const totalAssumptions = rawAssumptions.length;

    let invalidatedCount = 0;
    let challengedCount = 0;
    let overdueCount = 0;
    let untestedCount = 0;
    let supportedCount = 0;

    for (const assumption of rawAssumptions) {
      const status = assumption.status.toUpperCase();
      const importance = (assumption.importance || "MEDIUM").toUpperCase();
      const isOverdue = assumption.reviewDate && new Date(assumption.reviewDate) < now;

      // Invalidation check
      if (status === "INVALIDATED" || status === "INVALID") {
        invalidatedCount++;
        let deduction = 10;
        let severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "MEDIUM";

        if (importance === "CRITICAL") {
          deduction = 25;
          severity = "CRITICAL";
        } else if (importance === "HIGH") {
          deduction = 18;
          severity = "HIGH";
        }

        score -= deduction;
        factors.push({
          factor: "INVALIDATED_ASSUMPTION",
          deduction,
          severity,
          reason: `Assumption "${assumption.statement.slice(0, 60)}" is INVALIDATED (${importance} importance)`,
        });
        warnings.push(`Critical assumption invalidated: "${assumption.statement}"`);
      }
      // Challenged check
      else if (status === "CHALLENGED" || status === "QUESTIONABLE") {
        challengedCount++;
        let deduction = 6;
        let severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";

        if (importance === "CRITICAL") {
          deduction = 14;
          severity = "HIGH";
        } else if (importance === "HIGH") {
          deduction = 10;
          severity = "MEDIUM";
        }

        score -= deduction;
        factors.push({
          factor: "CHALLENGED_ASSUMPTION",
          deduction,
          severity,
          reason: `Assumption "${assumption.statement.slice(0, 60)}" is CHALLENGED (${importance} importance)`,
        });
        warnings.push(`Challenged premise detected: "${assumption.statement}"`);
      }
      // Supported/Confirmed
      else if (status === "SUPPORTED" || status === "CONFIRMED" || status === "VALID") {
        supportedCount++;
      }
      // Untested / Unverified
      else {
        untestedCount++;
      }

      // Overdue review check
      if (isOverdue && status !== "CONFIRMED" && status !== "VALID") {
        overdueCount++;
        const deduction = importance === "CRITICAL" ? 12 : 8;
        score -= deduction;
        factors.push({
          factor: "OVERDUE_ASSUMPTION_REVIEW",
          deduction,
          severity: importance === "CRITICAL" ? "HIGH" : "MEDIUM",
          reason: `Assumption "${assumption.statement.slice(0, 60)}" has passed its review date (${new Date(assumption.reviewDate!).toLocaleDateString()})`,
        });
        warnings.push(`Overdue assumption review: "${assumption.statement}"`);
      }
    }

    // 2. Evaluate Evidence Quality & Contradictions
    const totalEvidence = decision.evidence.length;
    let supportingEvidenceCount = 0;
    let contradictingEvidenceCount = 0;

    // Check evidence links connected to assumptions
    for (const da of decision.assumptions) {
      for (const link of da.assumption.evidenceLinks) {
        if (link.stance === "CONTRADICTS") {
          contradictingEvidenceCount++;
        } else if (link.stance === "SUPPORTS") {
          supportingEvidenceCount++;
        }
      }
    }

    if (totalEvidence === 0 && (decision.status === "DECIDED" || decision.status === "VALIDATED")) {
      const deduction = 15;
      score -= deduction;
      factors.push({
        factor: "NO_EVIDENCE_ATTACHED",
        deduction,
        severity: "MEDIUM",
        reason: "Active or decided architecture fossil has no supporting evidence or benchmarks attached",
      });
      warnings.push("No evidence artifacts or telemetry linked to this decision.");
    }

    if (contradictingEvidenceCount > 0) {
      const deduction = Math.min(25, contradictingEvidenceCount * 10);
      score -= deduction;
      factors.push({
        factor: "CONTRADICTING_EVIDENCE",
        deduction,
        severity: deduction >= 20 ? "CRITICAL" : "HIGH",
        reason: `${contradictingEvidenceCount} evidence link(s) explicitly contradict underlying assumptions`,
      });
      warnings.push(`${contradictingEvidenceCount} piece(s) of evidence directly contradict decision assumptions.`);
    }

    // 3. Evaluate Outcomes (Expectation vs Reality)
    const outcomes = decision.outcomes;
    const totalOutcomes = outcomes.length;
    let achievedCount = 0;
    let failedCount = 0;
    let pendingCount = 0;

    for (const outcome of outcomes) {
      const status = outcome.status.toUpperCase();
      if (status === "FAILED") {
        failedCount++;
        const deduction = 20;
        score -= deduction;
        factors.push({
          factor: "FAILED_OUTCOME",
          deduction,
          severity: "HIGH",
          reason: `Observed outcome failed expectation: "${outcome.expectedOutcome.slice(0, 60)}"`,
        });
        warnings.push(`Failed outcome recorded: "${outcome.expectedOutcome}"`);
      } else if (status === "ACHIEVED") {
        achievedCount++;
      } else {
        pendingCount++;
      }
    }

    // Check if decision has been active for over 30 days without outcomes
    const decisionAgeDays = Math.floor(
      (now.getTime() - new Date(decision.decidedAt || decision.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if ((decision.status === "DECIDED" || decision.status === "VALIDATED") && totalOutcomes === 0 && decisionAgeDays > 30) {
      const deduction = 8;
      score -= deduction;
      factors.push({
        factor: "UNVERIFIED_MATURE_DECISION",
        deduction,
        severity: "LOW",
        reason: `Decision was adopted ${decisionAgeDays} days ago but has no observed outcomes or telemetry preserved`,
      });
      recommendations.push("Record post-implementation outcome telemetry to verify architectural impact.");
    }

    // Clamp score
    const finalScore = Math.max(0, Math.min(100, score));

    // Determine Health Status
    let status: HealthStatus = "HEALTHY";
    if (finalScore < 40 || invalidatedCount >= 2 || (invalidatedCount >= 1 && failedCount >= 1)) {
      status = "CRITICAL";
    } else if (finalScore < 60 || invalidatedCount >= 1 || failedCount >= 1) {
      status = "AT_RISK";
    } else if (finalScore < 80 || challengedCount >= 1 || overdueCount >= 1 || totalEvidence === 0) {
      status = "NEEDS_ATTENTION";
    }

    // Formulate Recommendations
    if (invalidatedCount > 0) {
      recommendations.push("Initiate formal decision reassessment: one or more key assumptions have been proven invalid.");
    }
    if (overdueCount > 0) {
      recommendations.push("Review and update expiring assumptions whose validation horizon has passed.");
    }
    if (contradictingEvidenceCount > 0) {
      recommendations.push("Investigate contradicting benchmark or observational evidence with stakeholders.");
    }
    if (totalEvidence === 0) {
      recommendations.push("Attach external evidence (benchmarks, PRDs, architectural diagrams) to strengthen defensibility.");
    }
    if (failedCount > 0) {
      recommendations.push("Document root causes of failed outcome and consider superseding or amending this decision.");
    }
    if (recommendations.length === 0) {
      recommendations.push("Decision reasoning and assumption matrix remain healthy. Continue routine monitoring.");
    }

    // Formulate Summary
    let summary = `Decision health is ${status} with a defensibility score of ${finalScore}/100.`;
    if (status === "CRITICAL") {
      summary = `CRITICAL RISK: Multiple assumptions invalidated or outcomes failed. Immediate architectural re-evaluation recommended.`;
    } else if (status === "AT_RISK") {
      summary = `AT RISK: Foundational assumptions are compromised or outcomes missed expectations. Reassessment advised.`;
    } else if (status === "NEEDS_ATTENTION") {
      summary = `NEEDS ATTENTION: Minor assumption drift, overdue reviews, or evidence gaps detected.`;
    }

    const metrics: HealthMetrics = {
      totalAssumptions,
      invalidatedAssumptions: invalidatedCount,
      challengedAssumptions: challengedCount,
      overdueAssumptions: overdueCount,
      untestedAssumptions: untestedCount,
      totalEvidence,
      supportingEvidence: supportingEvidenceCount,
      contradictingEvidence: contradictingEvidenceCount,
      totalOutcomes,
      achievedOutcomes: achievedCount,
      failedOutcomes: failedCount,
      pendingOutcomes: pendingCount,
    };

    return {
      decisionId,
      score: finalScore,
      status,
      summary,
      factors,
      warnings,
      recommendations,
      metrics,
      evaluatedAt: now.toISOString(),
    };
  }

  /**
   * Calculates workspace-wide health distribution and high-risk decision list.
   */
  static async getWorkspaceHealthOverview(workspaceId?: string) {
    const where: any = workspaceId ? { workspaceId, archivedAt: null } : { archivedAt: null };
    const decisions = await prisma.decision.findMany({
      where,
      select: { id: true, title: true, status: true, priority: true, updatedAt: true },
    });

    const evaluations = await Promise.all(
      decisions.map(async (d: any) => {
        const health = await this.calculateDecisionHealth(d.id);
        return {
          id: d.id,
          title: d.title,
          status: d.status,
          priority: d.priority,
          healthScore: health.score,
          healthStatus: health.status,
          warningsCount: health.warnings.length,
          invalidatedAssumptions: health.metrics.invalidatedAssumptions,
          overdueAssumptions: health.metrics.overdueAssumptions,
        };
      })
    );

    const distribution = {
      HEALTHY: evaluations.filter((e: any) => e.healthStatus === "HEALTHY").length,
      NEEDS_ATTENTION: evaluations.filter((e: any) => e.healthStatus === "NEEDS_ATTENTION").length,
      AT_RISK: evaluations.filter((e: any) => e.healthStatus === "AT_RISK").length,
      CRITICAL: evaluations.filter((e: any) => e.healthStatus === "CRITICAL").length,
    };

    const avgScore =
      evaluations.length > 0
        ? Math.round(evaluations.reduce((sum: number, e: any) => sum + e.healthScore, 0) / evaluations.length)
        : 100;

    const atRiskDecisions = evaluations
      .filter((e: any) => e.healthStatus === "CRITICAL" || e.healthStatus === "AT_RISK")
      .sort((a: any, b: any) => a.healthScore - b.healthScore);

    return {
      totalDecisions: evaluations.length,
      averageScore: avgScore,
      distribution,
      atRiskDecisions,
      evaluations,
    };
  }
}

