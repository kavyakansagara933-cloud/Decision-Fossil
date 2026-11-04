import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { TimelineService } from "./timeline-service";
import { DecisionService } from "./decision-service";
import { GET as decisionTimelineHandler } from "@/app/api/decisions/[id]/timeline/route";
import { GET as workspaceTimelineHandler } from "@/app/api/timeline/route";

describe("Decision Timeline & Activity History (Unit & Integration)", () => {
  let testWorkspaceId: string;
  let testUserId: string;
  let testDecisionId: string;
  let createdEventIds: string[] = [];

  beforeAll(async () => {
    // 1. Create test user
    const user = await prisma.user.create({
      data: {
        name: "Timeline Test Auditor",
        email: `timeline-test-${Date.now()}@decisionfossil.dev`,
      },
    });
    testUserId = user.id;

    // 2. Create test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: "Timeline History Test Workspace",
        slug: `timeline-ws-${Date.now()}`,
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
      title: "Evaluate Micro-Frontends Architecture",
      statement: "We will adopt Module Federation for independent domain deployments.",
      priority: "HIGH",
      status: "PROPOSED",
      context: "Monolithic web build times exceeding 25 minutes.",
      reasoning: "Independent team release cadence without cross-team lockstep.",
    });
    testDecisionId = decision.id;

    // Seed distinct chronological events
    const event1 = await TimelineService.recordEvent({
      decisionId: testDecisionId,
      actorId: testUserId,
      eventType: "ALTERNATIVE_ADDED",
      title: "Alternative candidate considered: Single-SPA",
      detail: "Single-SPA evaluated but requires centralized wrapper bundle.",
      metadata: { candidate: "Single-SPA", status: "CONSIDERED" },
    });
    createdEventIds.push(event1.id);

    const event2 = await TimelineService.recordEvent({
      decisionId: testDecisionId,
      actorId: testUserId,
      eventType: "ASSUMPTION_ADDED",
      title: "Assumption recorded: Module Federation shared dependencies load under 200ms",
      detail: "Assumes browser HTTP/2 multiplexing handles multiple chunks smoothly.",
      metadata: { importance: "HIGH", confidence: "MEDIUM" },
    });
    createdEventIds.push(event2.id);

    const event3 = await TimelineService.recordEvent({
      decisionId: testDecisionId,
      actorId: testUserId,
      eventType: "ASSUMPTION_STATUS_CHANGED",
      title: "Assumption validated: SUPPORTED",
      detail: "Staging performance metrics confirmed p95 chunk latency of 140ms.",
      metadata: { previousStatus: "UNTESTED", newStatus: "SUPPORTED" },
    });
    createdEventIds.push(event3.id);

    const event4 = await TimelineService.recordEvent({
      decisionId: testDecisionId,
      actorId: null,
      eventType: "AI_PROPOSALS_APPLIED",
      title: "AI Extraction Proposals Reviewed & Applied",
      detail: "Extracted 2 alternatives and 3 assumptions from Architecture RFC #88.",
      metadata: { source: "RFC #88", acceptedCount: 5 },
    });
    createdEventIds.push(event4.id);
  });

  afterAll(async () => {
    if (testDecisionId) {
      await prisma.decision.deleteMany({ where: { id: testDecisionId } }).catch(() => {});
    }
    if (testWorkspaceId) {
      await prisma.workspace.deleteMany({ where: { id: testWorkspaceId } }).catch(() => {});
    }
    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => {});
    }
  });

  describe("Event Recording & Deduplication", () => {
    it("records audit events with actor attribution, category, and metadata", async () => {
      const event = await TimelineService.recordEvent({
        decisionId: testDecisionId,
        actorId: testUserId,
        eventType: "EVIDENCE_ADDED",
        title: "Load Test Benchmark Attached",
        detail: "Synthetic load test report under 5,000 concurrent browser sessions.",
        metadata: { tool: "k6", p99: "185ms" },
      });

      expect(event).toBeDefined();
      expect(event.title).toBe("Load Test Benchmark Attached");
      expect(event.actorId).toBe(testUserId);
      expect(event.metadata).toContain("k6");
    });

    it("prevents rapid duplicate event submission within deduplication window", async () => {
      const duplicateTitle = "Duplicate Trigger Test Event";

      const first = await TimelineService.recordEvent({
        decisionId: testDecisionId,
        actorId: testUserId,
        eventType: "CUSTOM",
        title: duplicateTitle,
        detail: "First attempt",
      });

      const second = await TimelineService.recordEvent({
        decisionId: testDecisionId,
        actorId: testUserId,
        eventType: "CUSTOM",
        title: duplicateTitle,
        detail: "Second immediate attempt",
      });

      // Should return the exact same event ID without writing a duplicate row
      expect(first.id).toBe(second.id);
    });
  });

  describe("Chronological Ordering", () => {
    it("returns events in newest-first order by default", async () => {
      const result = await TimelineService.getTimelineEvents({
        decisionId: testDecisionId,
        order: "desc",
      });

      expect(result.events.length).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < result.events.length - 1; i++) {
        const current = new Date(result.events[i].occurredAt).getTime();
        const next = new Date(result.events[i + 1].occurredAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it("returns events in oldest-first order when requested", async () => {
      const result = await TimelineService.getTimelineEvents({
        decisionId: testDecisionId,
        order: "asc",
      });

      expect(result.events.length).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < result.events.length - 1; i++) {
        const current = new Date(result.events[i].occurredAt).getTime();
        const next = new Date(result.events[i + 1].occurredAt).getTime();
        expect(current).toBeLessThanOrEqual(next);
      }
    });
  });

  describe("Category and Actor Filtering", () => {
    it("filters timeline events strictly by category: ASSUMPTION", async () => {
      const result = await TimelineService.getTimelineEvents({
        decisionId: testDecisionId,
        category: "ASSUMPTION",
      });

      expect(result.events.length).toBeGreaterThanOrEqual(2);
      for (const ev of result.events) {
        expect(ev.category).toBe("ASSUMPTION");
        expect(ev.eventType.startsWith("ASSUMPTION_")).toBe(true);
      }
    });

    it("filters timeline events by category: AI", async () => {
      const result = await TimelineService.getTimelineEvents({
        decisionId: testDecisionId,
        category: "AI",
      });

      expect(result.events.length).toBeGreaterThanOrEqual(1);
      for (const ev of result.events) {
        expect(ev.actorType).toBe("AI");
      }
    });

    it("filters timeline events by actorId", async () => {
      const result = await TimelineService.getTimelineEvents({
        decisionId: testDecisionId,
        actorId: testUserId,
      });

      expect(result.events.length).toBeGreaterThanOrEqual(2);
      for (const ev of result.events) {
        expect(ev.actorId).toBe(testUserId);
      }
    });

    it("filters events by search text", async () => {
      const result = await TimelineService.getTimelineEvents({
        decisionId: testDecisionId,
        search: "Single-SPA",
      });

      expect(result.events.length).toBe(1);
      expect(result.events[0].title).toContain("Single-SPA");
    });
  });

  describe("Pagination", () => {
    it("paginates events accurately with page and pageSize", async () => {
      const page1 = await TimelineService.getTimelineEvents({
        decisionId: testDecisionId,
        page: 1,
        pageSize: 2,
      });

      expect(page1.events.length).toBe(2);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.pageSize).toBe(2);
      expect(page1.pagination.totalPages).toBeGreaterThanOrEqual(2);
      expect(page1.pagination.hasMore).toBe(true);
      expect(page1.pagination.hasPrevious).toBe(false);

      const page2 = await TimelineService.getTimelineEvents({
        decisionId: testDecisionId,
        page: 2,
        pageSize: 2,
      });

      expect(page2.events.length).toBeGreaterThanOrEqual(1);
      expect(page2.pagination.page).toBe(2);
      expect(page2.pagination.hasPrevious).toBe(true);
      expect(page2.events[0].id).not.toBe(page1.events[0].id);
    });
  });

  describe("API Endpoints", () => {
    it("GET /api/decisions/[id]/timeline returns paginated events with metadata", async () => {
      const req = new Request(
        `http://localhost:3000/api/decisions/${testDecisionId}/timeline?order=desc&pageSize=5`
      );

      const res = await decisionTimelineHandler(req, {
        params: Promise.resolve({ id: testDecisionId }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.events)).toBe(true);
      expect(json.pagination).toBeDefined();
      expect(json.pagination.total).toBeGreaterThanOrEqual(3);
      expect(json.timeline).toBeDefined(); // backward compatibility
    });

    it("GET /api/timeline returns workspace-level chronological activity feed", async () => {
      const req = new Request(
        `http://localhost:3000/api/timeline?workspaceId=${testWorkspaceId}&pageSize=10`
      );

      const res = await workspaceTimelineHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.events)).toBe(true);
      expect(json.events.length).toBeGreaterThanOrEqual(3);
    });
  });
});
