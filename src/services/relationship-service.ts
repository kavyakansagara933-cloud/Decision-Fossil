import { prisma } from "@/lib/db";
import { TimelineService } from "./timeline-service";
import { HealthService } from "./health-service";
import {
  CreateRelationshipInput,
  DecisionGraph,
  GraphEdge,
  GraphNode,
  RelationshipType,
} from "@/types/decision";

export class RelationshipService {
  /**
   * Add a directional relationship between two decisions with cycle detection.
   */
  static async addRelationship(input: CreateRelationshipInput, actorId?: string) {
    const { sourceDecisionId, targetDecisionId, type, description } = input;

    if (sourceDecisionId === targetDecisionId) {
      throw new Error("Cannot create a relationship between a decision and itself");
    }

    // Verify both decisions exist
    const [source, target] = await Promise.all([
      prisma.decision.findUnique({
        where: { id: sourceDecisionId },
        select: { id: true, title: true, status: true },
      }),
      prisma.decision.findUnique({
        where: { id: targetDecisionId },
        select: { id: true, title: true, status: true },
      }),
    ]);

    if (!source) {
      throw new Error(`Source decision with ID "${sourceDecisionId}" not found`);
    }
    if (!target) {
      throw new Error(`Target decision with ID "${targetDecisionId}" not found`);
    }

    // Cycle detection for dependency and hierarchy relationship types
    if (type === "DEPENDS_ON" || type === "SUPERSEDES") {
      const wouldCycle = await this.detectCycle(sourceDecisionId, targetDecisionId, type);
      if (wouldCycle) {
        throw new Error(
          `Cannot create ${type} relationship: circular dependency detected between "${source.title}" and "${target.title}"`
        );
      }
    }

    // Create relationship in transaction and log audit events
    return await prisma.$transaction(async (tx) => {
      const relationship = await tx.decisionRelationship.create({
        data: {
          sourceDecisionId,
          targetDecisionId,
          type,
          description,
        },
      });

      // If SUPERSEDES, transition target decision status to SUPERSEDED
      if (type === "SUPERSEDES" && target.status !== "SUPERSEDED") {
        await tx.decision.update({
          where: { id: targetDecisionId },
          data: { status: "SUPERSEDED" },
        });

        await tx.decisionEvent.create({
          data: {
            decisionId: targetDecisionId,
            actorId: actorId || null,
            eventType: "STATUS_CHANGED",
            title: `Decision superseded by "${source.title}"`,
            detail: description || `Superseded by decision ${source.id}`,
            metadata: JSON.stringify({ supersedingDecisionId: source.id }),
          },
        });
      }

      // Log event on source decision
      await tx.decisionEvent.create({
        data: {
          decisionId: sourceDecisionId,
          actorId: actorId || null,
          eventType: "RELATIONSHIP_ADDED",
          title: `Linked relationship: ${type} "${target.title}"`,
          detail: description || undefined,
          metadata: JSON.stringify({
            relationshipId: relationship.id,
            targetDecisionId,
            type,
          }),
        },
      });

      return relationship;
    });
  }

  /**
   * Remove an existing relationship between decisions.
   */
  static async removeRelationship(relationshipId: string, actorId?: string) {
    const relationship = await prisma.decisionRelationship.findUnique({
      where: { id: relationshipId },
      include: {
        sourceDecision: { select: { id: true, title: true } },
        targetDecision: { select: { id: true, title: true } },
      },
    });

    if (!relationship) {
      throw new Error(`Decision relationship with ID "${relationshipId}" not found`);
    }

    return await prisma.$transaction(async (tx) => {
      await tx.decisionRelationship.delete({
        where: { id: relationshipId },
      });

      // Record audit event
      await tx.decisionEvent.create({
        data: {
          decisionId: relationship.sourceDecisionId,
          actorId: actorId || null,
          eventType: "RELATIONSHIP_REMOVED",
          title: `Removed relationship: ${relationship.type} "${relationship.targetDecision.title}"`,
          metadata: JSON.stringify({
            relationshipId,
            targetDecisionId: relationship.targetDecisionId,
            type: relationship.type,
          }),
        },
      });

      return relationship;
    });
  }

  /**
   * Retrieve all incoming and outgoing relationships for a decision.
   */
  static async getRelationships(decisionId: string) {
    const [outgoing, incoming] = await Promise.all([
      prisma.decisionRelationship.findMany({
        where: { sourceDecisionId: decisionId },
        include: {
          targetDecision: {
            select: {
              id: true,
              title: true,
              statement: true,
              status: true,
              priority: true,
              updatedAt: true,
            },
          },
        },
      }),
      prisma.decisionRelationship.findMany({
        where: { targetDecisionId: decisionId },
        include: {
          sourceDecision: {
            select: {
              id: true,
              title: true,
              statement: true,
              status: true,
              priority: true,
              updatedAt: true,
            },
          },
        },
      }),
    ]);

    return {
      outgoing,
      incoming,
      total: outgoing.length + incoming.length,
    };
  }

  /**
   * Traverse graph neighborhood up to max depth and return nodes, edges, and health scores.
   */
  static async getDecisionGraph(decisionId: string, depth: number = 2): Promise<DecisionGraph> {
    const maxDepth = Math.min(depth, 4);
    const visitedNodeIds = new Set<string>();
    const nodeQueue: { id: string; currentDepth: number }[] = [{ id: decisionId, currentDepth: 0 }];
    const edgesMap = new Map<string, GraphEdge>();
    const nodesMap = new Map<string, any>();

    while (nodeQueue.length > 0) {
      const { id: currentId, currentDepth } = nodeQueue.shift()!;
      if (visitedNodeIds.has(currentId)) continue;
      visitedNodeIds.add(currentId);

      const decision = await prisma.decision.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          currentVersion: true,
        },
      });

      if (decision) {
        nodesMap.set(decision.id, decision);
      }

      if (currentDepth >= maxDepth) continue;

      // Fetch outgoing and incoming edges for current decision
      const [outgoing, incoming] = await Promise.all([
        prisma.decisionRelationship.findMany({
          where: { sourceDecisionId: currentId },
          select: { id: true, sourceDecisionId: true, targetDecisionId: true, type: true, description: true },
        }),
        prisma.decisionRelationship.findMany({
          where: { targetDecisionId: currentId },
          select: { id: true, sourceDecisionId: true, targetDecisionId: true, type: true, description: true },
        }),
      ]);

      for (const rel of outgoing) {
        edgesMap.set(rel.id, {
          id: rel.id,
          source: rel.sourceDecisionId,
          target: rel.targetDecisionId,
          type: rel.type as RelationshipType,
          description: rel.description,
        });
        if (!visitedNodeIds.has(rel.targetDecisionId)) {
          nodeQueue.push({ id: rel.targetDecisionId, currentDepth: currentDepth + 1 });
        }
      }

      for (const rel of incoming) {
        edgesMap.set(rel.id, {
          id: rel.id,
          source: rel.sourceDecisionId,
          target: rel.targetDecisionId,
          type: rel.type as RelationshipType,
          description: rel.description,
        });
        if (!visitedNodeIds.has(rel.sourceDecisionId)) {
          nodeQueue.push({ id: rel.sourceDecisionId, currentDepth: currentDepth + 1 });
        }
      }
    }

    // Attach health scores to nodes
    const nodes: GraphNode[] = await Promise.all(
      Array.from(nodesMap.values()).map(async (n) => {
        try {
          const health = await HealthService.calculateDecisionHealth(n.id);
          return {
            id: n.id,
            title: n.title,
            status: n.status,
            priority: n.priority,
            healthScore: health.score,
            healthStatus: health.status,
            currentVersion: n.currentVersion,
          };
        } catch {
          return {
            id: n.id,
            title: n.title,
            status: n.status,
            priority: n.priority,
            currentVersion: n.currentVersion,
          };
        }
      })
    );

    const edges = Array.from(edgesMap.values());
    const cyclesDetected = this.hasAnyCycle(edges);

    return {
      rootId: decisionId,
      nodes,
      edges,
      cyclesDetected,
    };
  }

  /**
   * Check if a proposed edge sourceId -> targetId of a given type creates a cycle using DFS.
   */
  private static async detectCycle(
    sourceId: string,
    targetId: string,
    type: RelationshipType
  ): Promise<boolean> {
    const visited = new Set<string>();
    const stack = [targetId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === sourceId) {
        return true; // Reached source from target -> cycle!
      }

      if (!visited.has(current)) {
        visited.add(current);
        const nextRelationships = await prisma.decisionRelationship.findMany({
          where: {
            sourceDecisionId: current,
            type,
          },
          select: { targetDecisionId: true },
        });

        for (const next of nextRelationships) {
          stack.push(next.targetDecisionId);
        }
      }
    }

    return false;
  }

  /**
   * Simple cycle detector for a collection of graph edges.
   */
  private static hasAnyCycle(edges: GraphEdge[]): boolean {
    const adj = new Map<string, string[]>();
    for (const edge of edges) {
      if (edge.type === "DEPENDS_ON" || edge.type === "SUPERSEDES") {
        if (!adj.has(edge.source)) adj.set(edge.source, []);
        adj.get(edge.source)!.push(edge.target);
      }
    }

    const visited = new Set<string>();
    const inStack = new Set<string>();

    const dfs = (node: string): boolean => {
      visited.add(node);
      inStack.add(node);

      const neighbors = adj.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (inStack.has(neighbor)) {
          return true;
        }
      }

      inStack.delete(node);
      return false;
    };

    for (const node of adj.keys()) {
      if (!visited.has(node)) {
        if (dfs(node)) return true;
      }
    }

    return false;
  }
}
