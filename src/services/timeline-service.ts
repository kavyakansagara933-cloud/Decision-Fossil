import { prisma } from "@/lib/db";
import { TimelineCategory, EventType } from "@/types/decision";

export interface GetTimelineEventsOptions {
  decisionId?: string;
  workspaceId?: string;
  page?: number;
  pageSize?: number;
  order?: "asc" | "desc";
  category?: TimelineCategory;
  actorId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface RecordEventInput {
  decisionId: string;
  actorId?: string | null;
  eventType: EventType;
  title: string;
  detail?: string | null;
  metadata?: any;
  tx?: any; // Optional Prisma transaction client
}

const CATEGORY_EVENT_MAP: Record<TimelineCategory, string[]> = {
  ALL: [],
  DECISION: ["CREATED", "VERSION_CREATED", "SUPERSEDED"],
  ALTERNATIVE: ["ALTERNATIVE_ADDED", "ALTERNATIVE_UPDATED", "ALTERNATIVE_REMOVED"],
  ASSUMPTION: [
    "ASSUMPTION_ADDED",
    "ASSUMPTION_UPDATED",
    "ASSUMPTION_STATUS_CHANGED",
    "ASSUMPTION_EVIDENCE_LINKED",
    "ASSUMPTION_EVIDENCE_UNLINKED",
    "ASSUMPTION_REMOVED",
  ],
  EVIDENCE: [
    "EVIDENCE_ADDED",
    "EVIDENCE_UPDATED",
    "EVIDENCE_LINKED",
    "EVIDENCE_UNLINKED",
    "ASSUMPTION_EVIDENCE_LINKED",
    "ASSUMPTION_EVIDENCE_UNLINKED",
  ],
  OUTCOME: ["OUTCOME_RECORDED", "OUTCOME_UPDATED"],
  AI: ["AI_PROPOSALS_APPLIED", "CUSTOM"],
  STATUS: [
    "STATUS_CHANGED",
    "PROPOSED",
    "DECIDED",
    "REASSESSMENT_STARTED",
    "REASSESSMENT_COMPLETED",
  ],
};

export class TimelineService {
  /**
   * Determine the semantic category for an event
   */
  static categorizeEvent(eventType: string, title?: string, detail?: string): TimelineCategory {
    if (
      eventType === "AI_PROPOSALS_APPLIED" ||
      (eventType === "CUSTOM" &&
        (title?.toLowerCase().includes("ai") || detail?.toLowerCase().includes("ai")))
    ) {
      return "AI";
    }

    if (eventType.startsWith("ASSUMPTION_")) return "ASSUMPTION";
    if (eventType.startsWith("ALTERNATIVE_")) return "ALTERNATIVE";
    if (eventType.startsWith("EVIDENCE_")) return "EVIDENCE";
    if (eventType.startsWith("OUTCOME_")) return "OUTCOME";
    if (
      ["STATUS_CHANGED", "PROPOSED", "DECIDED", "REASSESSMENT_STARTED", "REASSESSMENT_COMPLETED"].includes(
        eventType
      )
    ) {
      return "STATUS";
    }
    if (["CREATED", "VERSION_CREATED", "SUPERSEDED"].includes(eventType)) {
      return "DECISION";
    }

    return "DECISION";
  }

  /**
   * Record a domain audit event, preventing rapid duplicate submissions
   */
  static async recordEvent(input: RecordEventInput) {
    const client = input.tx || prisma;
    const metadataString =
      input.metadata !== undefined
        ? typeof input.metadata === "string"
          ? input.metadata
          : JSON.stringify(input.metadata)
        : null;

    // Duplicate check: within the last 2 seconds, same decision, eventType, and title
    const recentDuplicate = await client.decisionEvent.findFirst({
      where: {
        decisionId: input.decisionId,
        eventType: input.eventType,
        title: input.title,
        occurredAt: {
          gte: new Date(Date.now() - 2000),
        },
      },
    });

    if (recentDuplicate) {
      return recentDuplicate;
    }

    return await client.decisionEvent.create({
      data: {
        decisionId: input.decisionId,
        actorId: input.actorId || null,
        eventType: input.eventType,
        title: input.title,
        detail: input.detail || null,
        metadata: metadataString,
      },
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Retrieve chronological timeline events with filtering, sorting, and pagination
   */
  static async getTimelineEvents(options: GetTimelineEventsOptions) {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 15));
    const skip = (page - 1) * pageSize;
    const order = options.order === "asc" ? "asc" : "desc";
    const category = options.category || "ALL";

    const where: any = {};

    if (options.decisionId) {
      where.decisionId = options.decisionId;
    }

    if (options.workspaceId) {
      where.decision = {
        workspaceId: options.workspaceId,
      };
    }

    if (options.actorId) {
      where.actorId = options.actorId;
    }

    if (options.startDate || options.endDate) {
      where.occurredAt = {};
      if (options.startDate) where.occurredAt.gte = new Date(options.startDate);
      if (options.endDate) where.occurredAt.lte = new Date(options.endDate);
    }

    if (options.search && options.search.trim().length > 0) {
      const term = options.search.trim();
      where.OR = [
        { title: { contains: term } },
        { detail: { contains: term } },
      ];
    }

    // Apply Category filtering
    if (category !== "ALL") {
      const targetEventTypes = CATEGORY_EVENT_MAP[category];
      if (category === "AI") {
        where.OR = [
          { eventType: "AI_PROPOSALS_APPLIED" },
          {
            AND: [
              { eventType: "CUSTOM" },
              {
                OR: [
                  { title: { contains: "AI" } },
                  { detail: { contains: "AI" } },
                ],
              },
            ],
          },
        ];
      } else if (targetEventTypes && targetEventTypes.length > 0) {
        where.eventType = { in: targetEventTypes };
      }
    }

    const [total, rawEvents] = await Promise.all([
      prisma.decisionEvent.count({ where }),
      prisma.decisionEvent.findMany({
        where,
        orderBy: { occurredAt: order },
        skip,
        take: pageSize,
        include: {
          actor: {
            select: { id: true, name: true, email: true },
          },
          decision: {
            select: {
              id: true,
              title: true,
              status: true,
              currentVersion: true,
              workspaceId: true,
            },
          },
        },
      }),
    ]);

    const events = rawEvents.map((e) => {
      let parsedMetadata: any = null;
      if (e.metadata) {
        try {
          parsedMetadata = JSON.parse(e.metadata);
        } catch {
          parsedMetadata = e.metadata;
        }
      }

      const category = this.categorizeEvent(e.eventType, e.title, e.detail || undefined);

      let actorType: "USER" | "AI" | "SYSTEM" = "SYSTEM";
      if (category === "AI" || e.title.includes("AI Extraction")) {
        actorType = "AI";
      } else if (e.actor) {
        actorType = "USER";
      }

      return {
        ...e,
        category,
        actorType,
        parsedMetadata,
      };
    });

    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      events,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasMore: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }
}
