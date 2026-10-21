import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { DecisionService } from "@/services/decision-service";
import { WorkspaceService } from "@/services/workspace-service";

describe("Decision Domain & Relational Integrity (Integration)", () => {
  let testWorkspaceId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Setup dedicated test user & workspace
    const user = await prisma.user.create({
      data: {
        name: "Test Architect",
        email: `test-${Date.now()}@decisionfossil.dev`,
      },
    });
    testUserId = user.id;

    const workspace = await prisma.workspace.create({
      data: {
        name: "Integration Test Workspace",
        slug: `int-test-${Date.now()}`,
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
    // Cleanup test records
    await prisma.workspace.delete({ where: { id: testWorkspaceId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it("creates a decision with automatic v1 snapshot and creation event", async () => {
    const decision = await DecisionService.createDecision({
      workspaceId: testWorkspaceId,
      creatorId: testUserId,
      title: "Adopt CockroachDB for Distributed Transactions",
      statement: "We will adopt CockroachDB as a multi-region distributed SQL database.",
      priority: "HIGH",
      status: "DRAFT",
      context: "Expanding from single-region AWS to multi-region EU and US deployment.",
      reasoning: "Strict serializable transactions with zero single point of failure.",
    });

    expect(decision.id).toBeDefined();
    expect(decision.currentVersion).toBe(1);
    expect(decision.versions.length).toBe(1);
    expect(decision.versions[0].version).toBe(1);
    expect(decision.versions[0].changeSummary).toBe("Initial decision creation");
    expect(decision.events.length).toBe(1);
    expect(decision.events[0].eventType).toBe("CREATED");
  });

  it("updates a decision and creates a new immutable version snapshot without overwriting v1", async () => {
    const decision = await DecisionService.createDecision({
      workspaceId: testWorkspaceId,
      creatorId: testUserId,
      title: "Evaluate Message Brokers",
      statement: "Initial baseline: Evaluate SQS vs Kafka.",
      priority: "MEDIUM",
      status: "DRAFT",
    });

    const updateResult = await DecisionService.updateDecision(decision.id, {
      statement: "Formal decision: Standardize on Apache Kafka due to replay requirements.",
      changeSummary: "Promoted Kafka after requirement for 7-day replay emerged.",
      actorId: testUserId,
    });

    expect(updateResult.updated.currentVersion).toBe(2);
    expect(updateResult.version.version).toBe(2);

    const full = await DecisionService.getDecisionById(decision.id);
    expect(full?.versions.length).toBe(2);
    // Old v1 statement is still intact in history!
    expect(full?.versions.find((v) => v.version === 1)?.statement).toBe("Initial baseline: Evaluate SQS vs Kafka.");
    expect(full?.versions.find((v) => v.version === 2)?.statement).toBe(
      "Formal decision: Standardize on Apache Kafka due to replay requirements."
    );
  });

  it("preserves non-destructive assumption reassessment history", async () => {
    const decision = await DecisionService.createDecision({
      workspaceId: testWorkspaceId,
      creatorId: testUserId,
      title: "In-Memory Cache Cluster",
      statement: "Deploy Redis cluster with 32GB RAM capacity.",
    });

    const { assumption } = await DecisionService.addAssumption({
      decisionId: decision.id,
      workspaceId: testWorkspaceId,
      statement: "Daily active key set will not exceed 10 million items",
      importance: "HIGH",
      confidence: "HIGH",
      status: "VALID",
      originalState: "Key count <= 10M",
      impactNote: "Fits within 32GB Redis instance memory limit",
    });

    expect(assumption.status).toBe("VALID");

    // Later: Reassess assumption when traffic surges
    const reassessment = await DecisionService.validateAssumption(assumption.id, decision.id, {
      newStatus: "INVALID",
      currentState: "Key set reached 28M items during Q4 sale, inducing OOM eviction",
      reason: "Customer catalog explosion exceeded initial memory projections",
      actorId: testUserId,
    });

    expect(reassessment.updated.status).toBe("INVALID");
    expect(reassessment.history.previousStatus).toBe("VALID");
    expect(reassessment.history.newStatus).toBe("INVALID");
    expect(reassessment.history.previousState).toBe("Key count <= 10M");

    // Verify full graph maintains both initial baseline and historical trail
    const fetched = await DecisionService.getDecisionById(decision.id);
    const fetchedAssumption = fetched?.assumptions[0].assumption;
    expect(fetchedAssumption?.originalState).toBe("Key count <= 10M");
    expect(fetchedAssumption?.currentState).toBe(
      "Key set reached 28M items during Q4 sale, inducing OOM eviction"
    );
    expect(fetchedAssumption?.history.length).toBe(1);
  });

  it("attaches evidence and links to supported assumptions", async () => {
    const decision = await DecisionService.createDecision({
      workspaceId: testWorkspaceId,
      creatorId: testUserId,
      title: "HTTP/3 Protocol Rollout",
      statement: "Enable QUIC and HTTP/3 on Cloudflare edge proxies.",
    });

    const { assumption } = await DecisionService.addAssumption({
      decisionId: decision.id,
      workspaceId: testWorkspaceId,
      statement: "HTTP/3 reduces tail latency for mobile users on lossy networks",
      importance: "MEDIUM",
    });

    const { evidence } = await DecisionService.addEvidence({
      decisionId: decision.id,
      workspaceId: testWorkspaceId,
      title: "Cloudflare Mobile Latency Whitepaper",
      type: "DOCUMENT",
      source: "https://blog.cloudflare.com/http3-performance",
      description: "Documented 12% improvement in TTFB across mobile 3G/4G connections.",
      assumptionIds: [assumption.id],
    });

    expect(evidence.id).toBeDefined();

    const fetched = await DecisionService.getDecisionById(decision.id);
    expect(fetched?.evidence.length).toBe(1);
    expect(fetched?.assumptions[0].assumption.evidenceLinks.length).toBe(1);
    expect(fetched?.assumptions[0].assumption.evidenceLinks[0].evidence.title).toBe(
      "Cloudflare Mobile Latency Whitepaper"
    );
  });

  it("records outcomes comparing expectation vs reality", async () => {
    const decision = await DecisionService.createDecision({
      workspaceId: testWorkspaceId,
      creatorId: testUserId,
      title: "Edge SSR Rendering Migration",
      statement: "Render landing pages on Vercel Edge Runtime instead of Node.js container.",
    });

    const outcome = await DecisionService.addOutcome({
      decisionId: decision.id,
      expectedOutcome: "Time to First Byte (TTFB) drops under 100ms globally",
      actualOutcome: "Global TTFB averaged 68ms across 40 edge locations",
      status: "ACHIEVED",
      measurement: "p95 TTFB = 68ms (baseline was 380ms)",
      notes: "Edge caching header hit-ratio reached 94%",
    });

    expect(outcome.status).toBe("ACHIEVED");
    expect(outcome.actualOutcome).toBeDefined();

    const timeline = await DecisionService.getDecisionTimeline(decision.id);
    expect(timeline.some((e) => e.eventType === "OUTCOME_RECORDED")).toBe(true);
  });
});
