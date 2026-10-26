import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { AssumptionService } from "./assumption-service";
import { DecisionService } from "./decision-service";
import { GET as listAssumptionsHandler, POST as createAssumptionHandler } from "@/app/api/assumptions/route";
import { GET as getStatsHandler } from "@/app/api/assumptions/stats/route";
import { POST as validateAssumptionHandler } from "@/app/api/assumptions/[id]/validate/route";
import { POST as linkEvidenceHandler, DELETE as unlinkEvidenceHandler } from "@/app/api/assumptions/[id]/evidence/route";

describe("Assumption Management System (Unit & Integration)", () => {
  let testWorkspaceId: string;
  let testUserId: string;
  let testDecisionId: string;
  let testEvidenceId1: string;
  let testEvidenceId2: string;
  let createdAssumptionId: string;

  beforeAll(async () => {
    // 1. Create test user
    const user = await prisma.user.create({
      data: {
        name: "Assumption Test Lead",
        email: `assumption-test-${Date.now()}@decisionfossil.dev`,
      },
    });
    testUserId = user.id;

    // 2. Create test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: "Assumption Validation Test Workspace",
        slug: `assumption-ws-${Date.now()}`,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });
    testWorkspaceId = workspace.id;

    // 3. Create test decision
    const decision = await DecisionService.createDecision({
      workspaceId: testWorkspaceId,
      creatorId: testUserId,
      title: "Evaluate Zero-Trust Network Access (ZTNA)",
      statement: "We will adopt Cloudflare ZTNA for remote engineering access.",
      priority: "HIGH",
      status: "PROPOSED",
      context: "Legacy VPN is suffering from bandwidth bottlenecks.",
      reasoning: "ZTNA provides identity-aware granular application proxying.",
    });
    testDecisionId = decision.id;

    // 4. Create test evidence items
    const ev1 = await prisma.evidence.create({
      data: {
        workspaceId: testWorkspaceId,
        title: "ZTNA Gateway Throughput Benchmark",
        type: "BENCHMARK",
        source: "https://internal.benchmarks/ztna-throughput",
        description: "Zero packet drops measured under 10 Gbps synthetic load test.",
      },
    });
    testEvidenceId1 = ev1.id;

    const ev2 = await prisma.evidence.create({
      data: {
        workspaceId: testWorkspaceId,
        title: "Developer Workstation Latency Complaints",
        type: "DISCUSSION",
        source: "#infra-support Slack channel",
        description: "Engineers in APAC region report 120ms added round-trip overhead.",
      },
    });
    testEvidenceId2 = ev2.id;
  });

  afterAll(async () => {
    if (createdAssumptionId) {
      await prisma.assumption.deleteMany({ where: { id: createdAssumptionId } }).catch(() => {});
    }
    await prisma.decision.deleteMany({ where: { id: testDecisionId } }).catch(() => {});
    await prisma.evidence.deleteMany({ where: { id: { in: [testEvidenceId1, testEvidenceId2] } } }).catch(() => {});
    await prisma.workspace.deleteMany({ where: { id: testWorkspaceId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => {});
  });

  describe("Assumption Creation & Storage", () => {
    it("creates an assumption with statement, explanation, owner, review date, and evidence stance", async () => {
      const reviewDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

      const result = await AssumptionService.createAssumption({
        decisionId: testDecisionId,
        workspaceId: testWorkspaceId,
        statement: "Global POP coverage will keep connection latency under 40ms for 95% of engineers.",
        explanation: "Critical for developer productivity; high latency impairs remote pair programming.",
        importance: "HIGH",
        confidence: "MEDIUM",
        status: "UNTESTED",
        ownerId: testUserId,
        reviewDate,
        validationNotes: "Baseline ping statistics to be collected during 2-week pilot.",
        source: "USER",
        evidenceLinks: [
          {
            evidenceId: testEvidenceId1,
            stance: "SUPPORTS",
            note: "Supports throughput assumptions under heavy transfer load",
          },
        ],
      });

      expect(result.assumption).toBeDefined();
      expect(result.assumption.id).toBeDefined();
      createdAssumptionId = result.assumption.id;

      expect(result.assumption.statement).toContain("Global POP coverage");
      expect(result.assumption.explanation).toContain("developer productivity");
      expect(result.assumption.status).toBe("UNTESTED");
      expect(result.assumption.ownerId).toBe(testUserId);
      expect(result.assumption.reviewDate).toBeDefined();

      // Check linked decision
      expect(result.decisionLink).toBeDefined();
      expect(result.decisionLink.decisionId).toBe(testDecisionId);

      // Check timeline audit event
      const events = await prisma.decisionEvent.findMany({
        where: { decisionId: testDecisionId, eventType: "ASSUMPTION_ADDED" },
      });
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].title).toContain("Assumption added");
    });
  });

  describe("Evidence Linking with Stances", () => {
    it("links contradicting evidence to the assumption and groups correctly", async () => {
      const link = await AssumptionService.linkEvidence(createdAssumptionId, {
        evidenceId: testEvidenceId2,
        stance: "CONTRADICTS",
        note: "APAC developer latency contradicts the <40ms global target",
      });

      expect(link).toBeDefined();
      expect(link.stance).toBe("CONTRADICTS");
      expect(link.note).toContain("APAC developer latency");

      // Retrieve full assumption and verify stance breakdown
      const detailed = await AssumptionService.getAssumptionById(createdAssumptionId);
      expect(detailed).toBeDefined();
      expect(detailed?.evidenceSummary.total).toBe(2);
      expect(detailed?.evidenceSummary.supporting).toBe(1);
      expect(detailed?.evidenceSummary.contradicting).toBe(1);
      expect(detailed?.evidenceSummary.inconclusive).toBe(0);

      expect(detailed?.supportingEvidence[0].evidence.id).toBe(testEvidenceId1);
      expect(detailed?.contradictingEvidence[0].evidence.id).toBe(testEvidenceId2);

      // Check timeline event for evidence linking
      const linkEvents = await prisma.decisionEvent.findMany({
        where: { decisionId: testDecisionId, eventType: "ASSUMPTION_EVIDENCE_LINKED" },
      });
      expect(linkEvents.length).toBeGreaterThanOrEqual(1);
    });

    it("unlinks an evidence item and updates the counts", async () => {
      const unlinkRes = await AssumptionService.unlinkEvidence(
        createdAssumptionId,
        testEvidenceId2
      );
      expect(unlinkRes.success).toBe(true);

      const detailed = await AssumptionService.getAssumptionById(createdAssumptionId);
      expect(detailed?.evidenceSummary.contradicting).toBe(0);
      expect(detailed?.evidenceSummary.supporting).toBe(1);
    });
  });

  describe("Assumption Editing", () => {
    it("updates statement, explanation, and review date without losing history", async () => {
      const newReviewDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const updated = await AssumptionService.updateAssumption(createdAssumptionId, {
        explanation: "Updated explanation: latency tolerance verified with senior engineering leads.",
        reviewDate: newReviewDate,
        validationNotes: "Extended pilot review date by 2 weeks.",
      });

      expect(updated.explanation).toContain("Updated explanation");
      expect(updated.validationNotes).toContain("Extended pilot review date");

      // Verify audit event in decision timeline
      const updateEvents = await prisma.decisionEvent.findMany({
        where: { decisionId: testDecisionId, eventType: "ASSUMPTION_UPDATED" },
      });
      expect(updateEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Validation / Status Transitions & History Preservation", () => {
    it("transitions status to CHALLENGED and records full validation history", async () => {
      const result = await AssumptionService.validateAssumption(
        createdAssumptionId,
        testDecisionId,
        {
          newStatus: "CHALLENGED",
          currentState: "Tokyo office telemetry shows 95ms latency under peak hours.",
          reason: "Telemetry logs from Tokyo office indicate routing suboptimality.",
          actorId: testUserId,
          evidenceRefs: [testEvidenceId1],
        }
      );

      expect(result.updated.status).toBe("CHALLENGED");
      expect(result.updated.currentState).toContain("Tokyo office telemetry");

      expect(result.history).toBeDefined();
      expect(result.history.previousStatus).toBe("UNTESTED");
      expect(result.history.newStatus).toBe("CHALLENGED");
      expect(result.history.reason).toContain("Tokyo office indicate routing suboptimality");

      // History should be queryable
      const histories = await prisma.assumptionValidationHistory.findMany({
        where: { assumptionId: createdAssumptionId },
      });
      expect(histories.length).toBe(1);
    });

    it("transitions status to SUPPORTED and sets validatedAt timestamp", async () => {
      const result = await AssumptionService.validateAssumption(
        createdAssumptionId,
        testDecisionId,
        {
          newStatus: "SUPPORTED",
          currentState: "Cloudflare configured direct Tokyo edge POP, reducing latency to 28ms.",
          reason: "Direct routing resolved APAC peering delay.",
          actorId: testUserId,
        }
      );

      expect(result.updated.status).toBe("SUPPORTED");
      expect(result.updated.validatedAt).toBeDefined();

      const histories = await prisma.assumptionValidationHistory.findMany({
        where: { assumptionId: createdAssumptionId },
        orderBy: { validatedAt: "desc" },
      });
      expect(histories.length).toBe(2);
      expect(histories[0].previousStatus).toBe("CHALLENGED");
      expect(histories[0].newStatus).toBe("SUPPORTED");
    });
  });

  describe("Overdue and Review Date Calculation", () => {
    it("correctly identifies an overdue assumption", async () => {
      // Create an assumption with a past review date and UNTESTED status
      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const overdueAssump = await AssumptionService.createAssumption({
        decisionId: testDecisionId,
        workspaceId: testWorkspaceId,
        statement: "Legacy VPN licenses can be terminated by end of Q1 without cancellation penalties.",
        status: "UNTESTED",
        reviewDate: pastDate,
      });

      const detailed = await AssumptionService.getAssumptionById(overdueAssump.assumption.id);
      expect(detailed?.isOverdue).toBe(true);

      // Verify listAssumptions with isOverdue filter
      const overdueList = await AssumptionService.listAssumptions({
        workspaceId: testWorkspaceId,
        isOverdue: true,
      });
      expect(overdueList.some((a) => a.id === overdueAssump.assumption.id)).toBe(true);

      // Clean up
      await prisma.assumption.delete({ where: { id: overdueAssump.assumption.id } });
    });
  });

  describe("Assumption Statistics & Metrics", () => {
    it("computes accurate status counts and overdue metrics for the workspace", async () => {
      const stats = await AssumptionService.getAssumptionStats(testWorkspaceId);
      expect(stats.total).toBeGreaterThanOrEqual(1);
      expect(typeof stats.untested).toBe("number");
      expect(typeof stats.supported).toBe("number");
      expect(typeof stats.challenged).toBe("number");
      expect(typeof stats.invalidated).toBe("number");
      expect(typeof stats.overdue).toBe("number");
      expect(typeof stats.dueSoon).toBe("number");
    });
  });

  describe("REST API Endpoints", () => {
    it("GET /api/assumptions returns list of assumptions", async () => {
      const req = new Request(
        `http://localhost:3000/api/assumptions?workspaceId=${testWorkspaceId}`
      );
      const res = await listAssumptionsHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.assumptions)).toBe(true);
      expect(json.assumptions.length).toBeGreaterThanOrEqual(1);
    });

    it("GET /api/assumptions/stats returns aggregated metrics", async () => {
      const req = new Request(
        `http://localhost:3000/api/assumptions/stats?workspaceId=${testWorkspaceId}`
      );
      const res = await getStatsHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.stats.total).toBeGreaterThanOrEqual(1);
    });

    it("POST /api/assumptions/[id]/evidence links evidence with stance", async () => {
      const req = new Request(
        `http://localhost:3000/api/assumptions/${createdAssumptionId}/evidence`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evidenceId: testEvidenceId2,
            stance: "INCONCLUSIVE",
            note: "Pending formal traceroute logs from regional ISP",
          }),
        }
      );

      const res = await linkEvidenceHandler(req, {
        params: Promise.resolve({ id: createdAssumptionId }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.link.stance).toBe("INCONCLUSIVE");
    });

    it("DELETE /api/assumptions/[id]/evidence unlinks evidence", async () => {
      const req = new Request(
        `http://localhost:3000/api/assumptions/${createdAssumptionId}/evidence?evidenceId=${testEvidenceId2}`
      );
      const res = await unlinkEvidenceHandler(req, {
        params: Promise.resolve({ id: createdAssumptionId }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it("POST /api/assumptions/[id]/validate validates assumption status", async () => {
      const req = new Request(
        `http://localhost:3000/api/assumptions/${createdAssumptionId}/validate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newStatus: "CONFIRMED",
            currentState: "All APAC engineers reporting <35ms response time consistently.",
            reason: "Completed 30-day pilot with 100% satisfactory SLA.",
            actorId: testUserId,
          }),
        }
      );

      const res = await validateAssumptionHandler(req, {
        params: Promise.resolve({ id: createdAssumptionId }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.updated.status).toBe("CONFIRMED");
    });
  });
});
