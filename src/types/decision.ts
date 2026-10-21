import { z } from "zod";

// ─── Enums ──────────────────────────────────────────────────────────────────
export const DecisionStatusSchema = z.enum([
  "DRAFT",
  "PROPOSED",
  "DECIDED",
  "MONITORING",
  "REASSESSING",
  "VALIDATED",
  "REJECTED",
  "SUPERSEDED",
]);
export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;

export const DecisionPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type DecisionPriority = z.infer<typeof DecisionPrioritySchema>;

export const AssumptionStatusSchema = z.enum([
  "UNVERIFIED",
  "VALID",
  "QUESTIONABLE",
  "INVALID",
  "UNKNOWN",
]);
export type AssumptionStatus = z.infer<typeof AssumptionStatusSchema>;

export const EvidenceTypeSchema = z.enum([
  "NOTE",
  "URL",
  "DOCUMENT",
  "BENCHMARK",
  "DATASET",
  "EXPERIMENT",
  "DISCUSSION",
  "OTHER",
]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const OutcomeStatusSchema = z.enum([
  "PENDING",
  "ACHIEVED",
  "PARTIALLY_ACHIEVED",
  "FAILED",
  "UNEXPECTED",
]);
export type OutcomeStatus = z.infer<typeof OutcomeStatusSchema>;

export const AlternativeStatusSchema = z.enum([
  "PROPOSED",
  "CONSIDERED",
  "SELECTED",
  "REJECTED",
]);
export type AlternativeStatus = z.infer<typeof AlternativeStatusSchema>;

export const EventTypeSchema = z.enum([
  "CREATED",
  "PROPOSED",
  "DECIDED",
  "VERSION_CREATED",
  "ALTERNATIVE_ADDED",
  "ASSUMPTION_ADDED",
  "ASSUMPTION_STATUS_CHANGED",
  "EVIDENCE_ADDED",
  "OUTCOME_RECORDED",
  "REASSESSMENT_STARTED",
  "STATUS_CHANGED",
  "SUPERSEDED",
  "CUSTOM",
]);
export type EventType = z.infer<typeof EventTypeSchema>;

// ─── Creation & Mutation Schemas ──────────────────────────────────────────

export const CreateDecisionSchema = z.object({
  workspaceId: z.string().min(1, "Workspace is required"),
  creatorId: z.string().min(1, "Creator is required"),
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  statement: z.string().min(10, "Decision statement must be at least 10 characters"),
  priority: DecisionPrioritySchema.default("MEDIUM"),
  status: DecisionStatusSchema.default("DRAFT"),
  context: z.string().optional(),
  reasoning: z.string().optional(),
  reviewDate: z.string().datetime().optional().nullable(),
  tags: z.array(z.string()).optional(),
});
export type CreateDecisionInput = z.infer<typeof CreateDecisionSchema>;

export const UpdateDecisionSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  statement: z.string().min(10).optional(),
  priority: DecisionPrioritySchema.optional(),
  context: z.string().optional(),
  reasoning: z.string().optional(),
  reviewDate: z.string().datetime().optional().nullable(),
  changeSummary: z.string().min(3, "Change summary is required to preserve history"),
  actorId: z.string().optional(),
});
export type UpdateDecisionInput = z.infer<typeof UpdateDecisionSchema>;

export const UpdateDecisionStatusSchema = z.object({
  status: DecisionStatusSchema,
  reason: z.string().min(3, "Reason for status transition is required"),
  actorId: z.string().optional(),
});
export type UpdateDecisionStatusInput = z.infer<typeof UpdateDecisionStatusSchema>;

export const CreateAlternativeSchema = z.object({
  decisionId: z.string().min(1),
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  pros: z.string().optional(),
  cons: z.string().optional(),
  selectionReason: z.string().optional(),
  status: AlternativeStatusSchema.default("CONSIDERED"),
  chosen: z.boolean().default(false),
});
export type CreateAlternativeInput = z.infer<typeof CreateAlternativeSchema>;

export const CreateAssumptionSchema = z.object({
  decisionId: z.string().min(1),
  workspaceId: z.string().optional(),
  statement: z.string().min(5, "Assumption statement is required"),
  importance: DecisionPrioritySchema.default("MEDIUM"),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  status: AssumptionStatusSchema.default("UNVERIFIED"),
  originalState: z.string().optional(),
  impactNote: z.string().optional(),
  evidenceIds: z.array(z.string()).optional(),
});
export type CreateAssumptionInput = z.infer<typeof CreateAssumptionSchema>;

export const ValidateAssumptionSchema = z.object({
  newStatus: AssumptionStatusSchema,
  currentState: z.string().min(3, "Observed state is required"),
  reason: z.string().min(3, "Validation reason is required"),
  actorId: z.string().optional(),
});
export type ValidateAssumptionInput = z.infer<typeof ValidateAssumptionSchema>;

export const CreateEvidenceSchema = z.object({
  decisionId: z.string().min(1),
  workspaceId: z.string().optional(),
  title: z.string().min(2, "Evidence title is required"),
  type: EvidenceTypeSchema.default("NOTE"),
  source: z.string().optional(),
  description: z.string().optional(),
  metadata: z.string().optional(),
  note: z.string().optional(),
  assumptionIds: z.array(z.string()).optional(),
});
export type CreateEvidenceInput = z.infer<typeof CreateEvidenceSchema>;

export const CreateOutcomeSchema = z.object({
  decisionId: z.string().min(1),
  expectedOutcome: z.string().min(5, "Expected outcome is required"),
  actualOutcome: z.string().optional(),
  status: OutcomeStatusSchema.default("PENDING"),
  measurement: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateOutcomeInput = z.infer<typeof CreateOutcomeSchema>;

export const CreateDecisionEventSchema = z.object({
  decisionId: z.string().min(1),
  actorId: z.string().optional(),
  eventType: EventTypeSchema,
  title: z.string().min(2, "Event title is required"),
  detail: z.string().optional(),
  metadata: z.string().optional(),
});
export type CreateDecisionEventInput = z.infer<typeof CreateDecisionEventSchema>;
