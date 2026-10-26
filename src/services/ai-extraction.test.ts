import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MockAIProvider, getAIProvider } from "./ai-provider";
import { POST as extractHandler } from "@/app/api/ai/extract/route";
import { POST as applyHandler } from "@/app/api/ai/apply/route";
import { prisma } from "@/lib/db";
import { DecisionService } from "./decision-service";

describe("AI Reasoning Extraction & Review System", () => {
  const sampleMeetingNotes = `Architecture Council Meeting Notes - March 14, 2026
Topic: Event Streaming Infrastructure Migration
Context: The current PostgreSQL event queue is experiencing lock contention under peak ingestion rates.
Problem: Message latency spikes over 800ms during flash sale promotions.
Decision: We will migrate real-time ingestion to Apache Kafka deployed on Kubernetes via Strimzi.
Rationale: Kafka provides horizontal partition scalability and persistent append-only logs suitable for multi-consumer replay.

Alternatives:
1. Apache Pulsar: Decoupled compute and tiered BookKeeper storage. High operational overhead for current cluster size.
2. AWS Kinesis: Fully managed cloud service. Rejected due to multi-cloud portability requirements and high per-shard throughput egress costs.
3. Apache Kafka: Proven partition scaling and rich connector ecosystem. Selected.

Assumptions:
- Peak incoming event rate will remain under 150,000 events/second in Year 1. (HIGH importance, 0.85 confidence)
- Network storage latency across availability zones remains below 3ms for synchronous replica acknowledgments. (HIGH importance, 0.80 confidence)

Evidence:
- Internal benchmark spike load test: https://benchmarks.internal/reports/kafka-strimzi-load-test
- Observed p99 write latency remained at 2.4ms under 100,000 msgs/sec during our 48-hour staging stress test.

Outcome:
Zero dropped messages and p95 end-to-end ingestion latency under 50ms across all order channels.`;

  describe("MockAIProvider (Deterministic Fallback Adapter)", () => {
    it("extracts structured decision entities with source traceability excerpts", async () => {
      const provider = new MockAIProvider();
      const result = await provider.extractReasoning(sampleMeetingNotes);

      // Basic Decision & Problem
      expect(result.title).toBeDefined();
      expect(result.title.length).toBeGreaterThan(5);
      expect(result.statement).toBeDefined();
      expect(result.context).toBeDefined();
      expect(result.reasoning).toBeDefined();

      // Alternatives with excerpts & traceability
      expect(result.alternatives.length).toBeGreaterThanOrEqual(2);
      for (const alt of result.alternatives) {
        expect(alt.name).toBeDefined();
        expect(alt.description).toBeDefined();
        expect(typeof alt.pros === "string" || alt.pros === undefined).toBe(true);
        expect(typeof alt.cons === "string" || alt.cons === undefined).toBe(true);
        expect(alt.sourceExcerpt).toBeDefined();
        expect(typeof alt.sourceExcerpt).toBe("string");
        expect(alt.traceability).toMatch(/^(EXPLICIT|INFERRED)$/);
      }

      // Check chosen alternative selection
      const chosenAlts = result.alternatives.filter((a) => a.chosen);
      expect(chosenAlts.length).toBe(1);
      expect(chosenAlts[0].name.toLowerCase()).toContain("kafka");

      // Assumptions with confidence and importance
      expect(result.assumptions.length).toBeGreaterThanOrEqual(1);
      for (const assump of result.assumptions) {
        expect(assump.statement).toBeDefined();
        expect(assump.importance).toMatch(/^(LOW|MEDIUM|HIGH|CRITICAL)$/);
        expect(assump.confidence).toMatch(/^(LOW|MEDIUM|HIGH)$/);
        expect(typeof assump.confidenceScore).toBe("number");
        expect(assump.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(assump.confidenceScore).toBeLessThanOrEqual(1);
        expect(assump.sourceExcerpt).toBeDefined();
        expect(assump.traceability).toBe("EXPLICIT");
      }

      // Evidence with source excerpt
      expect(result.evidence.length).toBeGreaterThanOrEqual(1);
      for (const ev of result.evidence) {
        expect(ev.title).toBeDefined();
        expect(ev.sourceExcerpt).toBeDefined();
        expect(ev.type).toBeDefined();
      }

      // Provider & item confidence
      expect(result.provider).toBe("deterministic-mock-provider");
      expect(result.model).toBe("regex-heuristic-extractor-v1");
      expect(result.alternatives[0].confidence).toBeGreaterThan(0.5);
    });

    it("handles short/informal notes safely with fallback heuristics", async () => {
      const provider = new MockAIProvider();
      const shortText = "We discussed using Redis for user session storage instead of memcached because of cluster replication.";
      const result = await provider.extractReasoning(shortText);

      expect(result.title).toBeDefined();
      expect(result.statement).toBeDefined();
      expect(result.alternatives.length).toBeGreaterThanOrEqual(1);
      expect(result.assumptions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("AI Provider Resolution", () => {
    it("returns an AI provider instance with deterministic fallback when no API key is set", () => {
      const { provider, isMock } = getAIProvider();
      expect(provider).toBeDefined();
      expect(provider.name).toBeDefined();
      expect(typeof provider.extractReasoning).toBe("function");
      // In test environment without GEMINI_API_KEY, fallback should be mock
      expect(typeof isMock).toBe("boolean");
    });
  });

  describe("API Endpoint: POST /api/ai/extract", () => {
    it("rejects payloads with text shorter than 20 characters", async () => {
      const req = new Request("http://localhost:3000/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Too brief" }),
      });

      const response = await extractHandler(req);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Invalid extraction request payload");
    });

    it("successfully extracts reasoning and returns metadata with source length", async () => {
      const req = new Request("http://localhost:3000/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sampleMeetingNotes,
          workspaceId: "core-engineering",
          documentReference: "Architecture Notes 2026-03",
        }),
      });

      const response = await extractHandler(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.extraction).toBeDefined();
      expect(json.extraction.documentReference).toBe("Architecture Notes 2026-03");
      expect(json.extraction.sourceTextLength).toBe(sampleMeetingNotes.length);
      expect(json.providerInfo).toBeDefined();
    });
  });

  describe("API Endpoint: POST /api/ai/apply (Review & Persist Flow)", () => {
    let createdDecisionId: string | null = null;
    let existingDecisionId: string | null = null;
    let testWorkspaceId: string;
    let testUserId: string;

    beforeAll(async () => {
      // Ensure a default user and workspace exists
      const user = await prisma.user.upsert({
        where: { email: "ai-reviewer@decisionfossil.dev" },
        update: {},
        create: {
          name: "AI Proposal Reviewer",
          email: "ai-reviewer@decisionfossil.dev",
        },
      });
      testUserId = user.id;

      const ws = await prisma.workspace.upsert({
        where: { slug: "core-engineering" },
        update: {},
        create: {
          name: "Core Engineering",
          slug: "core-engineering",
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });
      testWorkspaceId = ws.id;

      // Create an existing decision for testing attachment flow
      const existing = await DecisionService.createDecision({
        workspaceId: ws.id,
        creatorId: user.id,
        title: "Database Indexing Strategy",
        statement: "Implement composite indexes on tenant_id + created_at.",
        priority: "MEDIUM",
        status: "DECIDED",
        context: "Slow dashboard queries.",
        reasoning: "Query planner was executing sequential scans.",
      });
      existingDecisionId = existing.id;
    });

    afterAll(async () => {
      if (createdDecisionId) {
        await prisma.decision.delete({ where: { id: createdDecisionId } }).catch(() => {});
      }
      if (existingDecisionId) {
        await prisma.decision.delete({ where: { id: existingDecisionId } }).catch(() => {});
      }
    });

    it("rejects invalid apply requests without required fields", async () => {
      const req = new Request("http://localhost:3000/api/ai/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "" }),
      });

      const res = await applyHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("creates a new decision from reviewed proposals, persisting ONLY accepted items", async () => {
      const applyPayload = {
        workspaceId: "core-engineering",
        isDraft: false,
        title: "Kafka Event Ingestion Infrastructure",
        statement: "Adopt Apache Kafka as central event stream backbone.",
        priority: "HIGH" as const,
        status: "PROPOSED" as const,
        context: "Postgres queues saturating under load.",
        reasoning: "Horizontal partition scalability.",
        expectedOutcome: "Zero dropped messages at 150k events/sec.",
        sourceDocumentReference: "Architecture Review RFC #402",
        // User accepted 2 alternatives and discarded 1 (Pulsar was rejected and omitted)
        acceptedAlternatives: [
          {
            name: "Apache Kafka",
            description: "Distributed partition log with Strimzi on K8s",
            pros: "Ecosystem mature, Partition scalability",
            cons: "KRaft ops overhead",
            status: "SELECTED" as const,
            chosen: true,
            sourceExcerpt: "Apache Kafka: Proven partition scaling and rich connector ecosystem. Selected.",
          },
          {
            name: "AWS Kinesis",
            description: "Managed AWS data streams",
            pros: "No infrastructure maintenance",
            cons: "Multi-cloud lock-in",
            status: "REJECTED" as const,
            chosen: false,
            sourceExcerpt: "AWS Kinesis: Fully managed cloud service. Rejected due to portability.",
          },
        ],
        // User accepted 1 assumption and discarded 1
        acceptedAssumptions: [
          {
            statement: "Peak incoming event rate will remain under 150,000 events/second in Year 1.",
            importance: "HIGH" as const,
            confidence: "HIGH" as const,
            status: "UNVERIFIED" as const,
            impactNote: "If breached, broker partition count must increase.",
            sourceExcerpt: "Peak incoming event rate will remain under 150,000 events/second in Year 1.",
          },
        ],
        // User accepted 1 evidence item
        acceptedEvidence: [
          {
            title: "Kafka Strimzi Load Test Report",
            type: "BENCHMARK" as const,
            source: "https://benchmarks.internal/reports/kafka-strimzi-load-test",
            description: "Observed p99 write latency remained at 2.4ms under 100,000 msgs/sec",
            sourceExcerpt: "Observed p99 write latency remained at 2.4ms under 100,000 msgs/sec",
          },
        ],
        rejectedSummary: {
          alternativeCount: 1, // 1 discarded alternative
          assumptionCount: 1,  // 1 discarded assumption
          evidenceCount: 0,
        },
      };

      const req = new Request("http://localhost:3000/api/ai/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(applyPayload),
      });

      const res = await applyHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.decision).toBeDefined();
      expect(json.decision.id).toBeDefined();
      createdDecisionId = json.decision.id;

      // Verify created entities in database
      const savedDecision = await prisma.decision.findUnique({
        where: { id: createdDecisionId! },
        include: {
          alternatives: true,
          assumptions: {
            include: {
              assumption: true,
            },
          },
          evidence: {
            include: {
              evidence: true,
            },
          },
          outcomes: true,
          events: true,
        },
      });

      expect(savedDecision).toBeDefined();
      expect(savedDecision?.title).toBe("Kafka Event Ingestion Infrastructure");
      expect(savedDecision?.status).toBe("PROPOSED");

      // Verify ONLY accepted alternatives were persisted (exactly 2, not 3)
      expect(savedDecision?.alternatives.length).toBe(2);
      const chosenSaved = savedDecision?.alternatives.find((a) => a.chosen);
      expect(chosenSaved?.name).toBe("Apache Kafka");

      // Verify ONLY accepted assumptions were persisted (exactly 1)
      expect(savedDecision?.assumptions.length).toBe(1);
      expect(savedDecision?.assumptions[0].assumption.statement).toContain("150,000 events/second");

      // Verify evidence persisted
      expect(savedDecision?.evidence.length).toBe(1);
      expect(savedDecision?.evidence[0].evidence.title).toBe("Kafka Strimzi Load Test Report");

      // Verify outcome persisted
      expect(savedDecision?.outcomes.length).toBe(1);
      expect(savedDecision?.outcomes[0].expectedOutcome).toContain("Zero dropped messages");

      // Verify timeline events recorded creation and AI extraction audit event
      const customAiEvent = savedDecision?.events.find(
        (e) => e.eventType === "CUSTOM" && e.title.includes("AI Extraction")
      );
      expect(customAiEvent).toBeDefined();
      expect(customAiEvent?.detail).toContain("Architecture Review RFC #402");
    });

    it("attaches accepted proposals to an existing decision record", async () => {
      const attachPayload = {
        workspaceId: "core-engineering",
        decisionId: existingDecisionId!,
        title: "Ignored for Existing Decision",
        statement: "Ignored for Existing Decision",
        priority: "HIGH" as const,
        status: "DECIDED" as const,
        context: "Ignored",
        reasoning: "Ignored",
        sourceDocumentReference: "Post-Mortem Investigation",
        acceptedAlternatives: [
          {
            name: "Partial BRIN Index",
            description: "Block Range Index for append-only timestamp ranges",
            pros: "Extremely small index footprint",
            cons: "Higher query overhead on unordered updates",
            status: "CONSIDERED" as const,
            chosen: false,
            sourceExcerpt: "Investigate BRIN indexes for append-only audit tables.",
          },
        ],
        acceptedAssumptions: [
          {
            statement: "Query patterns consistently filter on tenant_id first.",
            importance: "CRITICAL" as const,
            confidence: "HIGH" as const,
            status: "UNVERIFIED" as const,
            impactNote: "Index scan failure if query omits tenant_id.",
            sourceExcerpt: "Query patterns consistently filter on tenant_id first.",
          },
        ],
        acceptedEvidence: [],
      };

      const req = new Request("http://localhost:3000/api/ai/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attachPayload),
      });

      const res = await applyHandler(req);
      expect(res.status).toBe(200);

      // Verify existing decision received the new entities
      const updated = await prisma.decision.findUnique({
        where: { id: existingDecisionId! },
        include: {
          alternatives: true,
          assumptions: {
            include: {
              assumption: true,
            },
          },
          events: true,
        },
      });

      const attachedAlt = updated?.alternatives.find((a) => a.name === "Partial BRIN Index");
      expect(attachedAlt).toBeDefined();

      const attachedAssump = updated?.assumptions.find((a) =>
        a.assumption.statement.includes("tenant_id first")
      );
      expect(attachedAssump).toBeDefined();

      // Verify audit event was logged on the timeline
      const attachEvent = updated?.events.find(
        (e) => e.eventType === "CUSTOM" && e.title.includes("Proposals Reviewed & Attached")
      );
      expect(attachEvent).toBeDefined();
      expect(attachEvent?.detail).toContain("Post-Mortem Investigation");
    });
  });
});
