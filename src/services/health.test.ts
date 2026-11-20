import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { HealthService } from "./health-service";
import { DecisionService } from "./decision-service";
import { GET as decisionHealthHandler } from "@/app/api/decisions/[id]/health/route";
import { GET as workspaceHealthOverviewHandler } from "@/app/api/health/overview/route";

describe("Decision Health Scoring Engine (Unit & Integration)", () => {
  let testWorkspaceId: string;
  let testUserId: string;
  let healthyDecisionId: string;
  let riskyDecisionId: string;
  let criticalDecisionId: string;

  beforeAll(async () => {
    // 1. Create test user
    const user = await prisma.user.create({
      data: {
        name: "Health Engine Test Auditor",
        email: `health-test-${Date.now()}@decisionfossil.dev`,
      },
    });
    testUserId = user.id;

    // 2. Create test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: "Health Testing Workspace",
        slug: `health-ws-${Date.now()}`,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });
    testWorkspaceId = workspace.id;

    // 3. Create a Healthy Decision
    const healthy = await DecisionService.createDecision({
      workspaceId: testWorkspaceId,
      creatorId: testUserId,
      title: "Adopt ClickHouse for Real-Time Analytical Aggregation",
      statement: "We will route telemetry events to ClickHouse for sub-second query latency.",
      priority: "HIGH",
      status: "DECIDED",
      context: "PostgreSQL timescaledb struggled with >50k events/sec.",
      reasoning: "Columnar compression and vectorized execution meet SLO.",
    });
    healthyDecisionId = healthy.id;

    // Attach valid assumption to healthy decision
    const healthyAssumpResult = await DecisionService.addAssumption({
      decisionId: healthyDecisionId,
      statement: "Daily telemetry ingestion rate will stabilize at ~25k req/sec.",
      importance: "HIGH",
      confidence: "HIGH",
      status: "SUPPORTED",
    });

    // Attach supporting evidence
    await DecisionService.addEvidence({
      decisionId: healthyDecisionId,
      title: "ClickHouse Ingestion Benchmark v1.2",
      type: "BENCHMARK",
      source: "https://benchmarks.internal/clickhouse",
      description: "Tested 120k events/sec sustained throughput.",
      assumptionIds: [healthyAssumpResult.assumption.id],
    });

    // Attach achieved outcome
    await DecisionService.addOutcome({
      decisionId: healthyDecisionId,
      expectedOutcome: "Sub-50ms analytics query latency across 1B rows.",
      actualOutcome: "Observed 32ms p95 latency in production.",
      status: "ACHIEVED",
    });

    // 4. Create a Risky Decision (Missing evidence, challenged assumption, overdue review)
    const risky = await DecisionService.createDecision({
      workspaceId: testWorkspaceId,
      creatorId: testUserId,
      title: "Migrate Auth to Self-Hosted Keycloak",
      statement: "We will replace Auth0 with a self-hosted Keycloak cluster.",
      priority: "MEDIUM",
      status: "DECIDED",
      context: "Auth0 MAU costs grew by 300% over the last fiscal year.",
      reasoning: "Open-source control and predictable infrastructure costs.",
    });
    riskyDecisionId = risky.id;

    // Add a challenged assumption
    await DecisionService.addAssumption({
      decisionId: riskyDecisionId,
      statement: "Internal DevOps team has sufficient bandwidth to maintain HA Keycloak.",
      importance: "HIGH",
      confidence: "LOW",
      status: "CHALLENGED",
    });

    // Add an overdue assumption
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 14); // 14 days ago
    await DecisionService.addAssumption({
      decisionId: riskyDecisionId,
      statement: "Keycloak memory footprint remains below 4GB per replica.",
      importance: "MEDIUM",
      confidence: "MEDIUM",
      status: "UNTESTED",
      reviewDate: pastDate.toISOString(),
    });

    // 5. Create a Critical Decision (Invalidated critical assumption + failed outcome + contradicting evidence)
    const critical = await DecisionService.createDecision({
      workspaceId: testWorkspaceId,
      creatorId: testUserId,
      title: "Deploy Custom In-Memory State Sync Protocol",
      statement: "We will roll our own WebSocket state synchronization engine.",
      priority: "CRITICAL",
      status: "DECIDED",
      context: "Commercial sync solutions lacked end-to-end encryption features.",
      reasoning: "Custom engine ensures compliance and avoids external license fees.",
    });
    criticalDecisionId = critical.id;

    // Add invalidated critical assumption
    const critAssump = await DecisionService.addAssumption({
      decisionId: criticalDecisionId,
      statement: "In-memory sync protocol guarantees zero packet loss over flaky cellular connections.",
      importance: "CRITICAL",
      confidence: "HIGH",
      status: "INVALIDATED",
    });

    // Attach contradicting evidence link
    const ev = await prisma.evidence.create({
      data: {
        workspaceId: testWorkspaceId,
        title: "Field Test Telemetry: 14% Packet Drop Observed",
        type: "EXPERIMENT",
        source: "https://monitoring.internal/drop-rate",
      },
    });

    await prisma.decisionEvidence.create({
      data: {
        decisionId: criticalDecisionId,
        evidenceId: ev.id,
      },
    });

    await prisma.evidenceAssumption.create({
      data: {
        evidenceId: ev.id,
        assumptionId: critAssump.assumption.id,
        stance: "CONTRADICTS",
        note: "Empirical packet loss invalidates zero-loss hypothesis",
      },
    });

    // Add failed outcome
    await DecisionService.addOutcome({
      decisionId: criticalDecisionId,
      expectedOutcome: "State synchronization latency under 100ms with zero reconnect dropouts.",
      actualOutcome: "High socket disconnect storm during evening load spike; 1,400 user sessions desynced.",
      status: "FAILED",
    });
  });

  afterAll(async () => {
    // Cleanup test workspace
    if (testWorkspaceId) {
      await prisma.workspace.delete({
        where: { id: testWorkspaceId },
      });
    }
    if (testUserId) {
      await prisma.user.delete({
        where: { id: testUserId },
      });
    }
  });

  it("calculates high health score (HEALTHY) for well-supported decision", async () => {
    const health = await HealthService.calculateDecisionHealth(healthyDecisionId);

    expect(health.score).toBeGreaterThanOrEqual(80);
    expect(health.status).toBe("HEALTHY");
    expect(health.metrics.totalAssumptions).toBe(1);
    expect(health.metrics.invalidatedAssumptions).toBe(0);
    expect(health.metrics.contradictingEvidence).toBe(0);
    expect(health.metrics.failedOutcomes).toBe(0);
    expect(health.warnings).toHaveLength(0);
    expect(health.recommendations).toBeDefined();
    expect(health.summary).toContain("HEALTHY");
  });

  it("penalizes challenged and overdue assumptions (NEEDS_ATTENTION or AT_RISK)", async () => {
    const health = await HealthService.calculateDecisionHealth(riskyDecisionId);

    expect(health.score).toBeLessThan(80);
    expect(["NEEDS_ATTENTION", "AT_RISK"]).toContain(health.status);
    expect(health.metrics.challengedAssumptions).toBe(1);
    expect(health.metrics.overdueAssumptions).toBe(1);
    expect(health.metrics.totalEvidence).toBe(0);

    const overdueFactor = health.factors.find((f) => f.factor === "OVERDUE_ASSUMPTION_REVIEW");
    const challengedFactor = health.factors.find((f) => f.factor === "CHALLENGED_ASSUMPTION");
    const noEvidenceFactor = health.factors.find((f) => f.factor === "NO_EVIDENCE_ATTACHED");

    expect(overdueFactor).toBeDefined();
    expect(challengedFactor).toBeDefined();
    expect(noEvidenceFactor).toBeDefined();
    expect(health.warnings.length).toBeGreaterThan(0);
  });

  it("classifies compromised decision with invalidated critical assumption as CRITICAL", async () => {
    const health = await HealthService.calculateDecisionHealth(criticalDecisionId);

    expect(health.score).toBeLessThan(50);
    expect(health.status).toBe("CRITICAL");
    expect(health.metrics.invalidatedAssumptions).toBe(1);
    expect(health.metrics.failedOutcomes).toBe(1);
    expect(health.metrics.contradictingEvidence).toBe(1);

    const invalidFactor = health.factors.find((f) => f.factor === "INVALIDATED_ASSUMPTION");
    const failedFactor = health.factors.find((f) => f.factor === "FAILED_OUTCOME");
    const contradictionFactor = health.factors.find((f) => f.factor === "CONTRADICTING_EVIDENCE");

    expect(invalidFactor).toBeDefined();
    expect(invalidFactor?.severity).toBe("CRITICAL");
    expect(failedFactor).toBeDefined();
    expect(contradictionFactor).toBeDefined();

    expect(health.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Initiate formal decision reassessment"),
        expect.stringContaining("Document root causes of failed outcome"),
      ])
    );
  });

  it("calculates workspace health overview correctly across multiple decisions", async () => {
    const overview = await HealthService.getWorkspaceHealthOverview(testWorkspaceId);

    expect(overview.totalDecisions).toBe(3);
    expect(overview.distribution.HEALTHY).toBe(1);
    expect(overview.distribution.CRITICAL).toBe(1);
    expect(overview.atRiskDecisions.length).toBeGreaterThanOrEqual(1);
    expect(overview.atRiskDecisions[0].id).toBe(criticalDecisionId);
    expect(overview.averageScore).toBeGreaterThan(0);
    expect(overview.averageScore).toBeLessThan(100);
  });

  it("handles non-existent decision ID with a descriptive error", async () => {
    await expect(HealthService.calculateDecisionHealth("non-existent-id")).rejects.toThrow(
      'Decision with ID "non-existent-id" not found'
    );
  });

  it("serves GET /api/decisions/[id]/health successfully", async () => {
    const request = new Request(`http://localhost:3000/api/decisions/${healthyDecisionId}/health`);
    const response = await decisionHealthHandler(request, {
      params: Promise.resolve({ id: healthyDecisionId }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.health).toBeDefined();
    expect(data.health.score).toBeGreaterThanOrEqual(80);
    expect(data.health.status).toBe("HEALTHY");
  });

  it("returns 404 for non-existent decision in GET /api/decisions/[id]/health", async () => {
    const request = new Request("http://localhost:3000/api/decisions/missing-id/health");
    const response = await decisionHealthHandler(request, {
      params: Promise.resolve({ id: "missing-id" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain("not found");
  });

  it("serves GET /api/health/overview successfully", async () => {
    const request = new Request(`http://localhost:3000/api/health/overview?workspaceId=${testWorkspaceId}`);
    const response = await workspaceHealthOverviewHandler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.totalDecisions).toBe(3);
    expect(data.distribution).toBeDefined();
    expect(data.averageScore).toBeDefined();
  });
});
