import { z } from "zod";

// ─── AI Extraction Traceability Schema ──────────────────────────────────────

export const TraceabilityTypeSchema = z.enum(["EXPLICIT", "INFERRED"]);
export type TraceabilityType = z.infer<typeof TraceabilityTypeSchema>;

export const ExtractedAlternativeSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Alternative name is required"),
  description: z.string().optional(),
  pros: z.string().optional(),
  cons: z.string().optional(),
  selectionReason: z.string().optional(),
  status: z.enum(["CONSIDERED", "SELECTED", "REJECTED"]).default("CONSIDERED"),
  chosen: z.boolean().default(false),
  sourceExcerpt: z.string().min(1, "Supporting source excerpt is required"),
  traceability: TraceabilityTypeSchema.default("EXPLICIT"),
  confidence: z.number().min(0).max(1).optional(),
});
export type ExtractedAlternative = z.infer<typeof ExtractedAlternativeSchema>;

export const ExtractedAssumptionSchema = z.object({
  id: z.string(),
  statement: z.string().min(3, "Assumption statement is required"),
  importance: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  originalState: z.string().optional(),
  impactNote: z.string().optional(),
  sourceExcerpt: z.string().min(1, "Supporting source excerpt is required"),
  traceability: TraceabilityTypeSchema.default("EXPLICIT"),
  confidenceScore: z.number().min(0).max(1).optional(),
});
export type ExtractedAssumption = z.infer<typeof ExtractedAssumptionSchema>;

export const ExtractedEvidenceSchema = z.object({
  id: z.string(),
  title: z.string().min(2, "Evidence title is required"),
  type: z.enum([
    "NOTE",
    "URL",
    "DOCUMENT",
    "BENCHMARK",
    "DATASET",
    "EXPERIMENT",
    "DISCUSSION",
    "OTHER",
  ]).default("NOTE"),
  source: z.string().optional(),
  description: z.string().optional(),
  sourceExcerpt: z.string().min(1, "Supporting source excerpt is required"),
  traceability: TraceabilityTypeSchema.default("EXPLICIT"),
  confidence: z.number().min(0).max(1).optional(),
});
export type ExtractedEvidence = z.infer<typeof ExtractedEvidenceSchema>;

export const ExtractedRiskSchema = z.object({
  id: z.string(),
  risk: z.string().min(3, "Risk description is required"),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  mitigation: z.string().optional(),
  sourceExcerpt: z.string().min(1, "Supporting source excerpt is required"),
  traceability: TraceabilityTypeSchema.default("INFERRED"),
});
export type ExtractedRisk = z.infer<typeof ExtractedRiskSchema>;

export const ExtractedQuestionSchema = z.object({
  id: z.string(),
  question: z.string().min(3, "Question is required"),
  impact: z.string().optional(),
  sourceExcerpt: z.string().optional(),
  traceability: TraceabilityTypeSchema.default("INFERRED"),
});
export type ExtractedQuestion = z.infer<typeof ExtractedQuestionSchema>;

export const ExtractedStakeholderSchema = z.object({
  id: z.string(),
  nameOrRole: z.string().min(2, "Name or role is required"),
  role: z.string().optional(),
  sourceExcerpt: z.string().min(1, "Supporting source excerpt is required"),
  traceability: TraceabilityTypeSchema.default("EXPLICIT"),
});
export type ExtractedStakeholder = z.infer<typeof ExtractedStakeholderSchema>;

// Root Extraction Output Schema
export const ReasoningExtractionResultSchema = z.object({
  title: z.string().min(3, "Decision title must be at least 3 characters"),
  statement: z.string().min(10, "Decision statement must be at least 10 characters"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  status: z.enum([
    "DRAFT",
    "PROPOSED",
    "DECIDED",
    "MONITORING",
    "REASSESSING",
    "VALIDATED",
    "REJECTED",
    "SUPERSEDED",
  ]).default("PROPOSED"),
  context: z.string().optional(),
  reasoning: z.string().optional(),
  statementExcerpt: z.string().optional(),
  contextExcerpt: z.string().optional(),
  reasoningExcerpt: z.string().optional(),
  expectedOutcome: z.string().optional(),
  expectedOutcomeExcerpt: z.string().optional(),
  alternatives: z.array(ExtractedAlternativeSchema).default([]),
  assumptions: z.array(ExtractedAssumptionSchema).default([]),
  evidence: z.array(ExtractedEvidenceSchema).default([]),
  risks: z.array(ExtractedRiskSchema).default([]),
  openQuestions: z.array(ExtractedQuestionSchema).default([]),
  stakeholders: z.array(ExtractedStakeholderSchema).default([]),
  provider: z.string().default("mock"),
  model: z.string().default("deterministic-fallback"),
  extractedAt: z.string().datetime().default(() => new Date().toISOString()),
});
export type ReasoningExtractionResult = z.infer<typeof ReasoningExtractionResultSchema>;

// Client Request Input Schema
export const ExtractReasoningRequestSchema = z.object({
  text: z
    .string()
    .min(20, "Source text must be at least 20 characters to extract meaningful reasoning")
    .max(50000, "Source text cannot exceed 50,000 characters"),
  workspaceId: z.string().min(1, "Workspace ID is required"),
  documentReference: z.string().max(300).optional(),
});
export type ExtractReasoningRequest = z.infer<typeof ExtractReasoningRequestSchema>;

// Apply Extracted Items Commit Request
export const ApplyExtractionRequestSchema = z.object({
  workspaceId: z.string().min(1, "Workspace ID is required"),
  decisionId: z.string().optional(), // If provided, attaches to existing; otherwise creates new decision
  isDraft: z.boolean().default(false),
  // Confirmed / edited core info
  title: z.string().min(3),
  statement: z.string().min(10),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  status: z.enum([
    "DRAFT",
    "PROPOSED",
    "DECIDED",
    "MONITORING",
    "REASSESSING",
    "VALIDATED",
    "REJECTED",
    "SUPERSEDED",
  ]).default("PROPOSED"),
  context: z.string().optional(),
  reasoning: z.string().optional(),
  expectedOutcome: z.string().optional(),
  // User accepted & edited items
  acceptedAlternatives: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      pros: z.string().optional(),
      cons: z.string().optional(),
      selectionReason: z.string().optional(),
      status: z.enum(["CONSIDERED", "SELECTED", "REJECTED"]).default("CONSIDERED"),
      chosen: z.boolean().default(false),
      sourceExcerpt: z.string().optional(),
    })
  ).default([]),
  acceptedAssumptions: z.array(
    z.object({
      statement: z.string().min(3),
      importance: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
      confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
      status: z.enum(["UNVERIFIED", "VALID", "QUESTIONABLE", "INVALID", "UNKNOWN"]).default("UNVERIFIED"),
      impactNote: z.string().optional(),
      sourceExcerpt: z.string().optional(),
    })
  ).default([]),
  acceptedEvidence: z.array(
    z.object({
      title: z.string().min(2),
      type: z.enum([
        "NOTE",
        "URL",
        "DOCUMENT",
        "BENCHMARK",
        "DATASET",
        "EXPERIMENT",
        "DISCUSSION",
        "OTHER",
      ]).default("NOTE"),
      source: z.string().optional(),
      description: z.string().optional(),
      sourceExcerpt: z.string().optional(),
    })
  ).default([]),
  rejectedSummary: z.object({
    alternativeCount: z.number().default(0),
    assumptionCount: z.number().default(0),
    evidenceCount: z.number().default(0),
    riskCount: z.number().default(0),
    questionCount: z.number().default(0),
  }).optional(),
  sourceDocumentReference: z.string().optional(),
});
export type ApplyExtractionRequest = z.infer<typeof ApplyExtractionRequestSchema>;
