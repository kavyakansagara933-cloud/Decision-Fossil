import { describe, it, expect } from "vitest";
import {
  CreateDecisionSchema,
  UpdateDecisionStatusSchema,
  ValidateAssumptionSchema,
  CreateAlternativeSchema,
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
});
