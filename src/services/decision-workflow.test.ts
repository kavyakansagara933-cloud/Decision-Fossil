import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { DecisionService } from "@/services/decision-service";

describe("Decision Fossil End-to-End Workflow (Integration)", () => {
  let testWorkspaceId: string;
  let testUserId: string;
  let decisionId: string;
  let assumptionId: string;
  let alternativeId: string;
  let evidenceId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: "Workflow Test Architect",
        email: `workflow-${Date.now()}@decisionfossil.dev`,
      },
    });
    testUserId = user.id;

    const workspace = await prisma.workspace.create({
      data: {
        name: "End-to-End Workflow Workspace",
        slug: `workflow-ws-${Date.now()}`,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });
    testWorkspaceId = workspace.id;
  });

  afterAll(async () => {
    await prisma.workspace.delete({ where: { id: testWorkspaceId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  // Step 1: Create
  it("Step 1: Creates initial draft decision", async () => {
    const decision = await DecisionService.createDecision({
      workspaceId: testWorkspaceId,
      creatorId: testUserId,
      title: "Evaluate GraphQL Federation vs REST Gateways",
      statement: "We will adopt Apollo GraphQL Federation as the unified gateway across domain subgraphs.",
      priority: "HIGH",
      status: "DRAFT",
      context: "Multiple domain teams developing microservices require a unified client entry point.",
      reasoning: "Federation allows declarative entity ownership without a centralized BFF bottleneck.",
    });

    expect(decision.id).toBeDefined();
    expect(decision.status).toBe("DRAFT");
    expect(decision.currentVersion).toBe(1);
    decisionId = decision.id;
  });

  // Step 2: Edit with versioning
  it("Step 2: Edits decision creating immutable Version 2 snapshot", async () => {
    const updateResult = await DecisionService.updateDecision(decisionId, {
      title: "Adopt Apollo GraphQL Federation with Hive Schema Registry",
      statement: "We will standardize on Apollo Federation v2 backed by GraphQL Hive for schema checks.",
      changeSummary: "Added Hive schema registry requirement to prevent breaking client schema changes.",
      actorId: testUserId,
    });

    expect(updateResult.updated.currentVersion).toBe(2);
    expect(updateResult.version.version).toBe(2);
    expect(updateResult.version.changeSummary).toBe(
      "Added Hive schema registry requirement to prevent breaking client schema changes."
    );
  });

  // Step 3: Add Alternatives
  it("Step 3: Attaches alternatives and records selection rationale", async () => {
    const alt1 = await DecisionService.addAlternative({
      decisionId,
      name: "REST API Gateway (Kong/Envoy)",
      description: "Traditional reverse proxy routing REST requests to services",
      pros: "Simple HTTP caching, low gateway memory footprint",
      cons: "Client over-fetching, multiple network roundtrips for composite views",
      selectionReason: "Rejected due to mobile team network latency requirements",
      status: "REJECTED",
      chosen: false,
    });

    const alt2 = await DecisionService.addAlternative({
      decisionId,
      name: "Apollo GraphQL Federation",
      description: "Declarative entity subgraph composition",
      pros: "Single network request for composite views, typed schema contract",
      cons: "Gateway CPU overhead for query planning",
      selectionReason: "Selected as best balance for mobile client performance",
      status: "SELECTED",
      chosen: true,
    });

    expect(alt1.id).toBeDefined();
    expect(alt2.id).toBeDefined();
    alternativeId = alt2.id;
  });

  // Step 4: Add Assumptions
  it("Step 4: Records foundational assumptions", async () => {
    const { assumption } = await DecisionService.addAssumption({
      decisionId,
      workspaceId: testWorkspaceId,
      statement: "Gateway query planning latency will remain under 10ms for p95 requests",
      importance: "HIGH",
      confidence: "MEDIUM",
      status: "VALID",
      originalState: "Query planning latency <= 10ms",
      impactNote: "If latency exceeds 10ms, gateway becomes the primary backend bottleneck",
    });

    expect(assumption.id).toBeDefined();
    assumptionId = assumption.id;
  });

  // Step 5: Attach Evidence
  it("Step 5: Attaches evidence supporting the assumption", async () => {
    const { evidence } = await DecisionService.addEvidence({
      decisionId,
      workspaceId: testWorkspaceId,
      title: "Gateway Router Load Benchmark Report",
      type: "BENCHMARK",
      source: "https://benchmarks.internal/federation-load-test-v2",
      description: "Rust Apollo Router benchmarked at 1.8ms query planning time under 15k req/sec load.",
      assumptionIds: [assumptionId],
    });

    expect(evidence.id).toBeDefined();
    evidenceId = evidence.id;
  });

  // Step 6: Decide (Lifecycle Transition)
  it("Step 6: Transitions status from DRAFT to DECIDED with audit trail", async () => {
    const updated = await DecisionService.transitionStatus(decisionId, {
      status: "DECIDED",
      reason: "Architecture council approval received after benchmark demonstration.",
      actorId: testUserId,
    });

    expect(updated.status).toBe("DECIDED");
    expect(updated.decidedAt).toBeDefined();
  });

  // Step 7: Change Assumption (Non-destructive Reassessment)
  it("Step 7: Reassesses assumption non-destructively when real conditions diverge", async () => {
    const reassessResult = await DecisionService.validateAssumption(assumptionId, decisionId, {
      newStatus: "INVALID",
      currentState: "Query planning latency reached 24ms during high nested entity queries",
      reason: "Deep 5-level nested fragments caused plan combinatorial explosion in staging",
      actorId: testUserId,
    });

    expect(reassessResult.updated.status).toBe("INVALID");
    expect(reassessResult.history.previousStatus).toBe("VALID");
    expect(reassessResult.history.newStatus).toBe("INVALID");
    expect(reassessResult.history.previousState).toBe("Query planning latency <= 10ms");

    // Baseline originalState must NEVER be overwritten!
    const decisionGraph = await DecisionService.getDecisionById(decisionId);
    const assumpRecord = decisionGraph?.assumptions[0].assumption;
    expect(assumpRecord?.originalState).toBe("Query planning latency <= 10ms");
    expect(assumpRecord?.history.length).toBe(1);
  });

  // Step 8: Record Outcome
  it("Step 8: Records outcome comparing expectation vs reality", async () => {
    const outcome = await DecisionService.addOutcome({
      decisionId,
      expectedOutcome: "Single request fetch time under 120ms for mobile dashboard",
      actualOutcome: "Mobile dashboard fetch time measured at 85ms across cellular connections",
      status: "ACHIEVED",
      measurement: "p95 response time = 85ms",
      notes: "Enforced query depth limits to mitigate the nested entity planning latency issue",
    });

    expect(outcome.status).toBe("ACHIEVED");
  });

  // Step 9: Review Timeline
  it("Step 9: Reviews complete chronological timeline events", async () => {
    const timeline = await DecisionService.getDecisionTimeline(decisionId);
    expect(timeline.length).toBeGreaterThanOrEqual(6);

    const eventTypes = timeline.map((e) => e.eventType);
    expect(eventTypes).toContain("CREATED");
    expect(eventTypes).toContain("VERSION_CREATED");
    expect(eventTypes).toContain("ALTERNATIVE_ADDED");
    expect(eventTypes).toContain("ASSUMPTION_ADDED");
    expect(eventTypes).toContain("EVIDENCE_ADDED");
    expect(eventTypes).toContain("STATUS_CHANGED");
    expect(eventTypes).toContain("ASSUMPTION_STATUS_CHANGED");
    expect(eventTypes).toContain("OUTCOME_RECORDED");
  });
});
