import { prisma } from "@/lib/db";
import {
  CreateDecisionInput,
  UpdateDecisionInput,
  UpdateDecisionStatusInput,
  CreateAlternativeInput,
  CreateAssumptionInput,
  ValidateAssumptionInput,
  CreateEvidenceInput,
  CreateOutcomeInput,
  CreateDecisionEventInput,
} from "@/types/decision";

export class DecisionService {
  /**
   * Create a new decision along with its initial v1 snapshot and audit log entry.
   */
  static async createDecision(data: CreateDecisionInput) {
    return await prisma.$transaction(async (tx) => {
      const decision = await tx.decision.create({
        data: {
          workspaceId: data.workspaceId,
          creatorId: data.creatorId,
          title: data.title,
          statement: data.statement,
          priority: data.priority,
          status: data.status,
          currentVersion: 1,
          reviewDate: data.reviewDate ? new Date(data.reviewDate) : null,
          versions: {
            create: {
              version: 1,
              statement: data.statement,
              context: data.context || null,
              reasoning: data.reasoning || null,
              statusSnapshot: data.status,
              changeSummary: "Initial decision creation",
              createdBy: data.creatorId,
            },
          },
          events: {
            create: {
              actorId: data.creatorId,
              eventType: "CREATED",
              title: `Decision initialized: ${data.title}`,
              detail: data.statement,
            },
          },
        },
        include: {
          versions: true,
          events: true,
          creator: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return decision;
    });
  }

  /**
   * Update decision statement or rationale with a new immutable version snapshot
   */
  static async updateDecision(decisionId: string, input: UpdateDecisionInput) {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.decision.findUnique({
        where: { id: decisionId },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      });
      if (!current) throw new Error("Decision not found");

      const newVersionNum = current.currentVersion + 1;
      const statement = input.statement ?? current.statement;
      const latestVer = current.versions[0];
      const context = input.context ?? latestVer?.context ?? null;
      const reasoning = input.reasoning ?? latestVer?.reasoning ?? null;

      // Update decision
      const updated = await tx.decision.update({
        where: { id: decisionId },
        data: {
          title: input.title ?? current.title,
          statement: input.statement ?? current.statement,
          priority: input.priority ?? current.priority,
          reviewDate: input.reviewDate !== undefined ? (input.reviewDate ? new Date(input.reviewDate) : null) : current.reviewDate,
          currentVersion: newVersionNum,
        },
      });

      // Create new historical version snapshot
      const version = await tx.decisionVersion.create({
        data: {
          decisionId,
          version: newVersionNum,
          statement,
          context,
          reasoning,
          statusSnapshot: current.status,
          changeSummary: input.changeSummary,
          createdBy: input.actorId || null,
        },
      });

      // Record event
      await tx.decisionEvent.create({
        data: {
          decisionId,
          actorId: input.actorId || null,
          eventType: "VERSION_CREATED",
          title: `Version ${newVersionNum} created`,
          detail: input.changeSummary,
        },
      });

      return { updated, version };
    });
  }

  /**
   * List decisions for a workspace with filter and summary stats
   */
  static async listDecisions(workspaceId: string, options?: { status?: string; search?: string }) {
    const where: any = { workspaceId };
    if (options?.status && options.status !== "ALL") {
      where.status = options.status;
    }
    if (options?.search) {
      where.OR = [
        { title: { contains: options.search } },
        { statement: { contains: options.search } },
      ];
    }

    return await prisma.decision.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        versions: {
          orderBy: { version: "desc" },
          take: 1,
        },
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
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });
  }

  /**
   * Get single decision with complete relational fossil graph
   */
  static async getDecisionById(id: string) {
    return await prisma.decision.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        workspace: true,
        versions: {
          orderBy: { version: "desc" },
        },
        alternatives: {
          orderBy: { createdAt: "asc" },
        },
        assumptions: {
          include: {
            assumption: {
              include: {
                evidenceLinks: {
                  include: {
                    evidence: true,
                  },
                },
                history: {
                  orderBy: { validatedAt: "desc" },
                  include: {
                    actor: {
                      select: { id: true, name: true, email: true },
                    },
                  },
                },
              },
            },
          },
        },
        evidence: {
          include: {
            evidence: {
              include: {
                assumptionLinks: {
                  include: {
                    assumption: true,
                  },
                },
              },
            },
          },
        },
        outcomes: {
          orderBy: { recordedAt: "desc" },
        },
        events: {
          orderBy: { occurredAt: "desc" },
          include: {
            actor: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });
  }

  /**
   * Transition Decision Lifecycle Status (Preserving Audit Event History)
   */
  static async transitionStatus(decisionId: string, input: UpdateDecisionStatusInput) {
    return await prisma.$transaction(async (tx) => {
      const decision = await tx.decision.findUnique({
        where: { id: decisionId },
      });
      if (!decision) throw new Error("Decision not found");

      const previousStatus = decision.status;
      const updated = await tx.decision.update({
        where: { id: decisionId },
        data: {
          status: input.status,
          decidedAt: input.status === "DECIDED" && !decision.decidedAt ? new Date() : decision.decidedAt,
        },
      });

      await tx.decisionEvent.create({
        data: {
          decisionId,
          actorId: input.actorId || null,
          eventType: "STATUS_CHANGED",
          title: `Status changed from ${previousStatus} to ${input.status}`,
          detail: input.reason,
          metadata: JSON.stringify({ previousStatus, newStatus: input.status }),
        },
      });

      return updated;
    });
  }

  /**
   * Create an Alternative consideration
   */
  static async addAlternative(input: CreateAlternativeInput) {
    return await prisma.$transaction(async (tx) => {
      const alternative = await tx.alternative.create({
        data: {
          decisionId: input.decisionId,
          name: input.name,
          description: input.description,
          pros: input.pros,
          cons: input.cons,
          selectionReason: input.selectionReason,
          status: input.status,
          chosen: input.chosen,
        },
      });

      await tx.decisionEvent.create({
        data: {
          decisionId: input.decisionId,
          eventType: "ALTERNATIVE_ADDED",
          title: `Alternative recorded: ${input.name}`,
          detail: input.selectionReason || input.description || null,
        },
      });

      return alternative;
    });
  }

  /**
   * Add Assumption with linkage and optional evidence connections
   */
  static async addAssumption(input: CreateAssumptionInput) {
    return await prisma.$transaction(async (tx) => {
      const assumption = await tx.assumption.create({
        data: {
          workspaceId: input.workspaceId,
          statement: input.statement,
          importance: input.importance,
          confidence: input.confidence,
          status: input.status,
          originalState: input.originalState || input.statement,
          currentState: input.originalState || input.statement,
        },
      });

      const link = await tx.decisionAssumption.create({
        data: {
          decisionId: input.decisionId,
          assumptionId: assumption.id,
          impactNote: input.impactNote,
        },
      });

      // Link any existing evidence items supporting this assumption
      if (input.evidenceIds && input.evidenceIds.length > 0) {
        for (const evidenceId of input.evidenceIds) {
          await tx.evidenceAssumption.create({
            data: {
              evidenceId,
              assumptionId: assumption.id,
            },
          });
        }
      }

      await tx.decisionEvent.create({
        data: {
          decisionId: input.decisionId,
          eventType: "ASSUMPTION_ADDED",
          title: `Assumption captured: ${input.statement}`,
          detail: input.impactNote || null,
        },
      });

      return { assumption, link };
    });
  }

  /**
   * Reassess / Validate an Assumption without overwriting original historical state
   */
  static async validateAssumption(assumptionId: string, decisionId: string, input: ValidateAssumptionInput) {
    return await prisma.$transaction(async (tx) => {
      const assumption = await tx.assumption.findUnique({
        where: { id: assumptionId },
      });
      if (!assumption) throw new Error("Assumption not found");

      const previousStatus = assumption.status;
      const previousState = assumption.currentState;

      // Update current state and timestamps
      const updated = await tx.assumption.update({
        where: { id: assumptionId },
        data: {
          status: input.newStatus,
          currentState: input.currentState,
          validatedAt: input.newStatus === "VALID" ? new Date() : assumption.validatedAt,
          invalidatedAt: input.newStatus === "INVALID" ? new Date() : assumption.invalidatedAt,
        },
      });

      // Crucial: Append to validation history (historical preservation!)
      const history = await tx.assumptionValidationHistory.create({
        data: {
          assumptionId,
          previousStatus,
          newStatus: input.newStatus,
          previousState,
          newState: input.currentState,
          reason: input.reason,
          actorId: input.actorId || null,
        },
      });

      // Record decision event
      await tx.decisionEvent.create({
        data: {
          decisionId,
          actorId: input.actorId || null,
          eventType: "ASSUMPTION_STATUS_CHANGED",
          title: `Assumption reassessed: ${input.newStatus}`,
          detail: `Reason: ${input.reason} (Observed: ${input.currentState})`,
          metadata: JSON.stringify({
            assumptionId,
            previousStatus,
            newStatus: input.newStatus,
          }),
        },
      });

      return { updated, history };
    });
  }

  /**
   * Record Evidence and optionally link to supported assumptions
   */
  static async addEvidence(input: CreateEvidenceInput) {
    return await prisma.$transaction(async (tx) => {
      const evidence = await tx.evidence.create({
        data: {
          workspaceId: input.workspaceId,
          title: input.title,
          type: input.type,
          source: input.source,
          description: input.description,
          metadata: input.metadata,
        },
      });

      const link = await tx.decisionEvidence.create({
        data: {
          decisionId: input.decisionId,
          evidenceId: evidence.id,
          note: input.note,
        },
      });

      // Connect to assumptions if specified
      if (input.assumptionIds && input.assumptionIds.length > 0) {
        for (const assumptionId of input.assumptionIds) {
          await tx.evidenceAssumption.create({
            data: {
              evidenceId: evidence.id,
              assumptionId,
            },
          });
        }
      }

      await tx.decisionEvent.create({
        data: {
          decisionId: input.decisionId,
          eventType: "EVIDENCE_ADDED",
          title: `Evidence attached: ${input.title} (${input.type})`,
          detail: input.note || input.description || null,
        },
      });

      return { evidence, link };
    });
  }

  /**
   * Record Outcome
   */
  static async addOutcome(input: CreateOutcomeInput) {
    return await prisma.$transaction(async (tx) => {
      const outcome = await tx.outcome.create({
        data: {
          decisionId: input.decisionId,
          expectedOutcome: input.expectedOutcome,
          actualOutcome: input.actualOutcome,
          status: input.status,
          measurement: input.measurement,
          notes: input.notes,
        },
      });

      await tx.decisionEvent.create({
        data: {
          decisionId: input.decisionId,
          eventType: "OUTCOME_RECORDED",
          title: `Outcome tracked: ${input.status}`,
          detail: input.actualOutcome || input.expectedOutcome,
        },
      });

      return outcome;
    });
  }

  /**
   * Append custom decision event to timeline
   */
  static async createDecisionEvent(input: CreateDecisionEventInput) {
    return await prisma.decisionEvent.create({
      data: {
        decisionId: input.decisionId,
        actorId: input.actorId || null,
        eventType: input.eventType,
        title: input.title,
        detail: input.detail,
        metadata: input.metadata,
      },
    });
  }

  /**
   * Retrieve timeline events for a decision
   */
  static async getDecisionTimeline(decisionId: string) {
    return await prisma.decisionEvent.findMany({
      where: { decisionId },
      orderBy: { occurredAt: "desc" },
      include: {
        actor: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }
}
