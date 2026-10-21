import { describe, it, expect } from "vitest";
import {
  CreateDecisionSchema,
  UpdateDecisionSchema,
  UpdateDecisionStatusSchema,
  ValidateAssumptionSchema,
  CreateAlternativeSchema,
  CreateEvidenceSchema,
  CreateOutcomeSchema,
  CreateDecisionEventSchema,
} from "./decision";

describe("Domain Validation Schemas (Zod)", () => {
  it("validates a compliant decision payload", () => {
    const valid = {
      workspaceId: "ws-123",
      creatorId: "user-123",
      title: "Migrate database to PostgreSQL",
      statement: "We will adopt PostgreSQL as our primary transactional datastore.",
      priority: "HIGH" as const,
      status: "DRAFT" as const,
      reasoning: "ACID compliance and relational audit integrity",
    };

    const res = CreateDecisionSchema.safeParse(valid);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.priority).toBe("HIGH");
      expect(res.data.status).toBe("DRAFT");
    }
  });

  it("fails if statement is shorter than minimum requirement", () => {
    const invalid = {
      workspaceId: "ws-123",
      creatorId: "user-123",
      title: "Test",
      statement: "Short", // Less than 10 characters
    };

    const res = CreateDecisionSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("validates status lifecycle transitions with mandatory reasoning", () => {
    const transition = {
      status: "DECIDED" as const,
      reason: "Architecture review passed with consensus",
    };

    const res = UpdateDecisionStatusSchema.safeParse(transition);
    expect(res.success).toBe(true);

    const invalidTransition = {
      status: "DECIDED",
      reason: "", // Empty reason rejected
    };
    expect(UpdateDecisionStatusSchema.safeParse(invalidTransition).success).toBe(false);
  });

  it("enforces change summary on decision updates to guarantee auditability", () => {
    const updateWithoutSummary = {
      title: "Updated Title",
      changeSummary: "", // Empty
    };
    expect(UpdateDecisionSchema.safeParse(updateWithoutSummary).success).toBe(false);

    const validUpdate = {
      statement: "Updated formal statement clarifying distributed isolation level.",
      changeSummary: "Upgraded isolation level from read committed to serializable.",
    };
    expect(UpdateDecisionSchema.safeParse(validUpdate).success).toBe(true);
  });

  it("validates assumption validation input", () => {
    const validation = {
      newStatus: "INVALID" as const,
      currentState: "Scale exceeded 2M users, invalidating low-traffic assumption",
      reason: "Observed telemetry spike during holiday traffic",
    };

    const res = ValidateAssumptionSchema.safeParse(validation);
    expect(res.success).toBe(true);
  });

  it("validates alternative candidate options", () => {
    const alt = {
      decisionId: "dec-123",
      name: "MongoDB",
      description: "Document store candidate",
      status: "REJECTED" as const,
      chosen: false,
      selectionReason: "Does not support non-destructive relational joins cleanly",
    };

    const res = CreateAlternativeSchema.safeParse(alt);
    expect(res.success).toBe(true);
  });

  it("validates evidence linking across assumptions", () => {
    const evidence = {
      decisionId: "dec-123",
      title: "Postgres 16 Benchmarks",
      type: "BENCHMARK" as const,
      source: "https://pgbench.internal/run/82",
      assumptionIds: ["assump-1", "assump-2"],
    };

    const res = CreateEvidenceSchema.safeParse(evidence);
    expect(res.success).toBe(true);
  });

  it("validates outcomes comparing expectation vs reality", () => {
    const outcome = {
      decisionId: "dec-123",
      expectedOutcome: "Throughput stays above 10,000 req/sec",
      actualOutcome: "Throughput peaked at 14,200 req/sec without latency spikes",
      status: "ACHIEVED" as const,
      measurement: "p99 latency = 12ms",
    };

    const res = CreateOutcomeSchema.safeParse(outcome);
    expect(res.success).toBe(true);
  });

  it("validates immutable timeline event creation", () => {
    const event = {
      decisionId: "dec-123",
      eventType: "STATUS_CHANGED" as const,
      title: "Decision transitioned to MONITORING",
      detail: "Deployed to production cluster; observation phase initiated.",
    };

    const res = CreateDecisionEventSchema.safeParse(event);
    expect(res.success).toBe(true);
  });
});
