import { prisma } from "@/lib/db";
import {
  CreateAssumptionInput,
  UpdateAssumptionInput,
  ValidateAssumptionInput,
  LinkEvidenceAssumptionInput,
  AssumptionStatus,
  EvidenceStance,
} from "@/types/decision";

export class AssumptionService {
  /**
   * Create a new assumption linked to a decision and workspace
   */
  static async createAssumption(input: CreateAssumptionInput) {
    return await prisma.$transaction(async (tx) => {
      // 1. Verify decision exists
      const decision = await tx.decision.findUnique({
        where: { id: input.decisionId },
      });
      if (!decision) {
        throw new Error(`Decision with ID '${input.decisionId}' not found`);
      }

      const workspaceId = input.workspaceId || decision.workspaceId;

      // 2. Create the assumption entity
      const assumption = await tx.assumption.create({
        data: {
          workspaceId,
          statement: input.statement,
          explanation: input.explanation || null,
          importance: input.importance,
          confidence: input.confidence,
          status: input.status || "UNTESTED",
          ownerId: input.ownerId || null,
          reviewDate: input.reviewDate ? new Date(input.reviewDate) : null,
          validationNotes: input.validationNotes || null,
          source: input.source || "USER",
          sourceExcerpt: input.sourceExcerpt || null,
          originalState: input.originalState || input.statement,
          currentState: input.originalState || input.statement,
        },
      });

      // 3. Link assumption to decision
      const decisionLink = await tx.decisionAssumption.create({
        data: {
          decisionId: input.decisionId,
          assumptionId: assumption.id,
          impactNote: input.impactNote || input.explanation || null,
        },
      });

      // 4. Link evidence with stance if provided
      if (input.evidenceLinks && input.evidenceLinks.length > 0) {
        for (const link of input.evidenceLinks) {
          await tx.evidenceAssumption.create({
            data: {
              evidenceId: link.evidenceId,
              assumptionId: assumption.id,
              stance: link.stance || "SUPPORTS",
              note: link.note || null,
            },
          });
        }
      } else if (input.evidenceIds && input.evidenceIds.length > 0) {
        for (const evidenceId of input.evidenceIds) {
          await tx.evidenceAssumption.create({
            data: {
              evidenceId,
              assumptionId: assumption.id,
              stance: "SUPPORTS",
            },
          });
        }
      }

      // 5. Append timeline event
      await tx.decisionEvent.create({
        data: {
          decisionId: input.decisionId,
          eventType: "ASSUMPTION_ADDED",
          title: `Assumption added: ${input.statement.slice(0, 80)}`,
          detail: input.explanation || input.impactNote || null,
          metadata: JSON.stringify({
            assumptionId: assumption.id,
            importance: input.importance,
            confidence: input.confidence,
            status: assumption.status,
            reviewDate: input.reviewDate || null,
            source: input.source || "USER",
          }),
        },
      });

      return { assumption, decisionLink };
    });
  }

  /**
   * Update an existing assumption's statement, explanation, owner, reviewDate, etc.
   */
  static async updateAssumption(id: string, input: UpdateAssumptionInput) {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.assumption.findUnique({
        where: { id },
        include: { decisions: true },
      });
      if (!existing) {
        throw new Error(`Assumption '${id}' not found`);
      }

      const updated = await tx.assumption.update({
        where: { id },
        data: {
          statement: input.statement ?? existing.statement,
          explanation: input.explanation !== undefined ? input.explanation : existing.explanation,
          importance: input.importance ?? existing.importance,
          confidence: input.confidence ?? existing.confidence,
          ownerId: input.ownerId !== undefined ? input.ownerId : existing.ownerId,
          reviewDate:
            input.reviewDate !== undefined
              ? input.reviewDate
                ? new Date(input.reviewDate)
                : null
              : existing.reviewDate,
          validationNotes:
            input.validationNotes !== undefined
              ? input.validationNotes
              : existing.validationNotes,
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          decisions: true,
        },
      });

      // Record timeline events for linked decisions
      for (const d of existing.decisions) {
        await tx.decisionEvent.create({
          data: {
            decisionId: d.decisionId,
            actorId: input.actorId || null,
            eventType: "ASSUMPTION_UPDATED",
            title: `Assumption updated: ${updated.statement.slice(0, 80)}`,
            detail: `Fields updated: ${Object.keys(input)
              .filter((k) => k !== "actorId")
              .join(", ")}`,
            metadata: JSON.stringify({
              assumptionId: id,
              changes: input,
            }),
          },
        });
      }

      return updated;
    });
  }

  /**
   * Validate / Reassess an Assumption with explicit evidence review & history tracking
   */
  static async validateAssumption(
    assumptionId: string,
    decisionId: string,
    input: ValidateAssumptionInput
  ) {
    return await prisma.$transaction(async (tx) => {
      const assumption = await tx.assumption.findUnique({
        where: { id: assumptionId },
      });
      if (!assumption) throw new Error(`Assumption '${assumptionId}' not found`);

      const previousStatus = assumption.status;
      const previousState = assumption.currentState;

      const isValidated = ["SUPPORTED", "VALID", "CONFIRMED"].includes(input.newStatus);
      const isInvalidated = ["INVALIDATED", "INVALID"].includes(input.newStatus);

      // 1. Update assumption state and timestamps
      const updated = await tx.assumption.update({
        where: { id: assumptionId },
        data: {
          status: input.newStatus,
          currentState: input.currentState,
          validationNotes: input.reason,
          validatedAt: isValidated ? new Date() : assumption.validatedAt,
          invalidatedAt: isInvalidated ? new Date() : assumption.invalidatedAt,
        },
      });

      // 2. Append validation history record (audit preservation)
      const history = await tx.assumptionValidationHistory.create({
        data: {
          assumptionId,
          previousStatus,
          newStatus: input.newStatus,
          previousState,
          newState: input.currentState,
          reason: input.reason,
          actorId: input.actorId || null,
          evidenceRefs: input.evidenceRefs ? JSON.stringify(input.evidenceRefs) : null,
        },
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
      });

      // 3. Log decision timeline event
      await tx.decisionEvent.create({
        data: {
          decisionId,
          actorId: input.actorId || null,
          eventType: "ASSUMPTION_STATUS_CHANGED",
          title: `Assumption reassessed: ${input.newStatus}`,
          detail: `Reason: ${input.reason} | Observed: ${input.currentState}`,
          metadata: JSON.stringify({
            assumptionId,
            previousStatus,
            newStatus: input.newStatus,
            evidenceRefs: input.evidenceRefs || [],
          }),
        },
      });

      return { updated, history };
    });
  }

  /**
   * Link an evidence item to an assumption with a specific stance (SUPPORTS / CONTRADICTS / INCONCLUSIVE)
   */
  static async linkEvidence(assumptionId: string, input: LinkEvidenceAssumptionInput) {
    return await prisma.$transaction(async (tx) => {
      const assumption = await tx.assumption.findUnique({
        where: { id: assumptionId },
        include: { decisions: true },
      });
      if (!assumption) throw new Error(`Assumption '${assumptionId}' not found`);

      const evidence = await tx.evidence.findUnique({
        where: { id: input.evidenceId },
      });
      if (!evidence) throw new Error(`Evidence '${input.evidenceId}' not found`);

      const link = await tx.evidenceAssumption.upsert({
        where: {
          evidenceId_assumptionId: {
            evidenceId: input.evidenceId,
            assumptionId,
          },
        },
        update: {
          stance: input.stance || "SUPPORTS",
          note: input.note !== undefined ? input.note : undefined,
        },
        create: {
          evidenceId: input.evidenceId,
          assumptionId,
          stance: input.stance || "SUPPORTS",
          note: input.note || null,
        },
        include: { evidence: true },
      });

      // Timeline events for linked decisions
      for (const d of assumption.decisions) {
        await tx.decisionEvent.create({
          data: {
            decisionId: d.decisionId,
            actorId: input.actorId || null,
            eventType: "ASSUMPTION_EVIDENCE_LINKED",
            title: `Evidence linked (${input.stance}): ${evidence.title.slice(0, 60)}`,
            detail: input.note || `Evidence stance marked as ${input.stance}`,
            metadata: JSON.stringify({
              assumptionId,
              evidenceId: input.evidenceId,
              stance: input.stance,
            }),
          },
        });
      }

      return link;
    });
  }

  /**
   * Unlink an evidence item from an assumption
   */
  static async unlinkEvidence(assumptionId: string, evidenceId: string, actorId?: string) {
    return await prisma.$transaction(async (tx) => {
      const assumption = await tx.assumption.findUnique({
        where: { id: assumptionId },
        include: { decisions: true },
      });
      if (!assumption) throw new Error(`Assumption '${assumptionId}' not found`);

      await tx.evidenceAssumption.deleteMany({
        where: {
          assumptionId,
          evidenceId,
        },
      });

      for (const d of assumption.decisions) {
        await tx.decisionEvent.create({
          data: {
            decisionId: d.decisionId,
            actorId: actorId || null,
            eventType: "ASSUMPTION_EVIDENCE_UNLINKED",
            title: `Evidence unlinked from assumption`,
            detail: `Evidence '${evidenceId}' disassociated from assumption '${assumptionId}'`,
            metadata: JSON.stringify({
              assumptionId,
              evidenceId,
            }),
          },
        });
      }

      return { success: true };
    });
  }

  /**
   * Retrieve assumption by ID with full details (decisions, stance-grouped evidence, history)
   */
  static async getAssumptionById(id: string) {
    const assumption = await prisma.assumption.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        workspace: { select: { id: true, name: true, slug: true } },
        decisions: {
          include: {
            decision: {
              select: {
                id: true,
                title: true,
                status: true,
                currentVersion: true,
                updatedAt: true,
              },
            },
          },
        },
        evidenceLinks: {
          include: { evidence: true },
          orderBy: { addedAt: "desc" },
        },
        history: {
          include: {
            actor: { select: { id: true, name: true, email: true } },
          },
          orderBy: { validatedAt: "desc" },
        },
      },
    });

    if (!assumption) return null;

    const now = new Date();
    const isResolved = ["CONFIRMED", "VALID", "INVALIDATED", "INVALID"].includes(
      assumption.status
    );
    const isOverdue = Boolean(
      assumption.reviewDate && new Date(assumption.reviewDate) < now && !isResolved
    );
    const isDueSoon = Boolean(
      assumption.reviewDate &&
        new Date(assumption.reviewDate) >= now &&
        new Date(assumption.reviewDate).getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000 &&
        !isResolved
    );

    const supportingEvidence = assumption.evidenceLinks.filter(
      (e) => e.stance === "SUPPORTS" || !e.stance
    );
    const contradictingEvidence = assumption.evidenceLinks.filter(
      (e) => e.stance === "CONTRADICTS"
    );
    const inconclusiveEvidence = assumption.evidenceLinks.filter(
      (e) => e.stance === "INCONCLUSIVE"
    );

    return {
      ...assumption,
      isOverdue,
      isDueSoon,
      evidenceSummary: {
        total: assumption.evidenceLinks.length,
        supporting: supportingEvidence.length,
        contradicting: contradictingEvidence.length,
        inconclusive: inconclusiveEvidence.length,
      },
      supportingEvidence,
      contradictingEvidence,
      inconclusiveEvidence,
    };
  }

  /**
   * List assumptions with filtering
   */
  static async listAssumptions(filters: {
    workspaceId?: string;
    decisionId?: string;
    status?: string;
    isOverdue?: boolean;
    search?: string;
  }) {
    const where: any = {};

    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId;
    }

    if (filters.decisionId) {
      where.decisions = {
        some: { decisionId: filters.decisionId },
      };
    }

    if (filters.status && filters.status !== "ALL") {
      if (filters.status === "UNTESTED") {
        where.status = { in: ["UNTESTED", "UNVERIFIED"] };
      } else if (filters.status === "SUPPORTED") {
        where.status = { in: ["SUPPORTED", "VALID"] };
      } else if (filters.status === "CHALLENGED") {
        where.status = { in: ["CHALLENGED", "QUESTIONABLE"] };
      } else if (filters.status === "INVALIDATED") {
        where.status = { in: ["INVALIDATED", "INVALID"] };
      } else if (filters.status === "CONFIRMED") {
        where.status = "CONFIRMED";
      } else {
        where.status = filters.status;
      }
    }

    if (filters.search && filters.search.trim().length > 0) {
      where.OR = [
        { statement: { contains: filters.search } },
        { explanation: { contains: filters.search } },
        { validationNotes: { contains: filters.search } },
      ];
    }

    const items = await prisma.assumption.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        decisions: {
          include: {
            decision: {
              select: { id: true, title: true, status: true },
            },
          },
        },
        evidenceLinks: {
          include: {
            evidence: { select: { id: true, title: true, type: true, source: true } },
          },
        },
      },
      orderBy: [{ reviewDate: "asc" }, { updatedAt: "desc" }],
    });

    const now = new Date();
    const enriched = items.map((a) => {
      const isResolved = ["CONFIRMED", "VALID", "INVALIDATED", "INVALID"].includes(a.status);
      const isOverdue = Boolean(a.reviewDate && new Date(a.reviewDate) < now && !isResolved);
      const isDueSoon = Boolean(
        a.reviewDate &&
          new Date(a.reviewDate) >= now &&
          new Date(a.reviewDate).getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000 &&
          !isResolved
      );

      const supporting = a.evidenceLinks.filter((e) => e.stance === "SUPPORTS" || !e.stance);
      const contradicting = a.evidenceLinks.filter((e) => e.stance === "CONTRADICTS");
      const inconclusive = a.evidenceLinks.filter((e) => e.stance === "INCONCLUSIVE");

      return {
        ...a,
        isOverdue,
        isDueSoon,
        supportingCount: supporting.length,
        contradictingCount: contradicting.length,
        inconclusiveCount: inconclusive.length,
      };
    });

    if (filters.isOverdue) {
      return enriched.filter((a) => a.isOverdue);
    }

    return enriched;
  }

  /**
   * Get workspace statistics for dashboard & metrics
   */
  static async getAssumptionStats(workspaceId?: string) {
    const where: any = workspaceId ? { workspaceId } : {};
    const assumptions = await prisma.assumption.findMany({
      where,
      select: {
        id: true,
        status: true,
        reviewDate: true,
      },
    });

    const now = new Date();
    let total = assumptions.length;
    let untested = 0;
    let supported = 0;
    let challenged = 0;
    let invalidated = 0;
    let confirmed = 0;
    let overdue = 0;
    let dueSoon = 0;

    for (const a of assumptions) {
      const isResolved = ["CONFIRMED", "VALID", "INVALIDATED", "INVALID"].includes(a.status);

      if (["UNTESTED", "UNVERIFIED"].includes(a.status)) {
        untested++;
      } else if (["SUPPORTED", "VALID"].includes(a.status)) {
        supported++;
      } else if (["CHALLENGED", "QUESTIONABLE"].includes(a.status)) {
        challenged++;
      } else if (["INVALIDATED", "INVALID"].includes(a.status)) {
        invalidated++;
      } else if (a.status === "CONFIRMED") {
        confirmed++;
      }

      if (a.reviewDate && !isResolved) {
        const rDate = new Date(a.reviewDate);
        if (rDate < now) {
          overdue++;
        } else if (rDate.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000) {
          dueSoon++;
        }
      }
    }

    return {
      total,
      untested,
      supported,
      challenged,
      invalidated,
      confirmed,
      overdue,
      dueSoon,
    };
  }
}
