import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { RelationshipService } from "./relationship-service";
import { DecisionService } from "./decision-service";
import {
  GET as getRelationshipsHandler,
  POST as postRelationshipHandler,
} from "@/app/api/decisions/[id]/relationships/route";
import { DELETE as deleteRelationshipHandler } from "@/app/api/decisions/[id]/relationships/[relId]/route";
import { GET as getGraphHandler } from "@/app/api/decisions/[id]/graph/route";

describe("Decision Relationship Graph & Cycle Engine (Unit & Integration)", () => {
  let testWorkspaceId: string;
  let testUserId: string;
  let decAId: string;
  let decBId: string;
  let decCId: string;

  beforeAll(async () => {
    // 1. Create test user
    const user = await prisma.user.create({
      data: {
        name: "Relationship Graph Auditor",
        email: `graph-test-${Date.now()}@decisionfossil.dev`,
      },
    });
    testUserId = user.id;

    // 2. Create test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: "Graph Testing Workspace",
        slug: `graph-ws-${Date.now()}`,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });
    testWorkspaceId = workspace.id;

    // 3. Create Decisions A, B, and C
    const decA = await DecisionService.createDecision({
      workspaceId: testWorkspaceId,
      creatorId: testUserId,
      title: "Decision A: Core Event Bus (Apache Kafka)",
      statement: "Adopt Kafka as company-wide asynchronous message backbone.",
      priority: "CRITICAL",
      status: "DECIDED",
    });
    decAId = decA.id;

    const decB = await DecisionService.createDecision({
      workspaceId: testWorkspaceId,
      creatorId: testUserId,
      title: "Decision B: CDC Ingestion via Debezium",
      statement: "Capture PostgreSQL transactional mutations into Kafka topics.",
      priority: "HIGH",
      status: "PROPOSED",
    });
    decBId = decB.id;

    const decC = await DecisionService.createDecision({
      workspaceId: testWorkspaceId,
      creatorId: testUserId,
      title: "Decision C: Real-Time Fraud Detection Consumer",
      statement: "Deploy Flink consumer listening to Debezium mutation topics.",
      priority: "HIGH",
      status: "PROPOSED",
    });
    decCId = decC.id;
  });

  afterAll(async () => {
    if (testWorkspaceId) {
      await prisma.workspace.delete({
        where: { id: testWorkspaceId },
      });
    }
    if (testUserId) {
      await prisma.user.delete({
        where: { id: testUserId },
      });
    }
  });

  it("creates a directional DEPENDS_ON relationship and records audit event", async () => {
    // Decision B depends on Decision A (CDC needs Kafka)
    const rel = await RelationshipService.addRelationship(
      {
        sourceDecisionId: decBId,
        targetDecisionId: decAId,
        type: "DEPENDS_ON",
        description: "Debezium connector requires running Kafka cluster",
      },
      testUserId
    );

    expect(rel.id).toBeDefined();
    expect(rel.sourceDecisionId).toBe(decBId);
    expect(rel.targetDecisionId).toBe(decAId);
    expect(rel.type).toBe("DEPENDS_ON");

    // Verify audit event
    const events = await prisma.decisionEvent.findMany({
      where: { decisionId: decBId, eventType: "RELATIONSHIP_ADDED" },
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].title).toContain('Linked relationship: DEPENDS_ON');
  });

  it("prevents self-referential relationship loop", async () => {
    await expect(
      RelationshipService.addRelationship({
        sourceDecisionId: decAId,
        targetDecisionId: decAId,
        type: "DEPENDS_ON",
      })
    ).rejects.toThrow("Cannot create a relationship between a decision and itself");
  });

  it("detects and blocks direct circular dependency (A depends on B, B depends on A)", async () => {
    // Currently B -> A exists.
    // Attempting A -> B (DEPENDS_ON) would create a cycle (A -> B -> A).
    await expect(
      RelationshipService.addRelationship({
        sourceDecisionId: decAId,
        targetDecisionId: decBId,
        type: "DEPENDS_ON",
      })
    ).rejects.toThrow("circular dependency detected");
  });

  it("detects and blocks indirect transitive circular dependency (C -> B -> A, then A -> C)", async () => {
    // Add C -> B
    await RelationshipService.addRelationship({
      sourceDecisionId: decCId,
      targetDecisionId: decBId,
      type: "DEPENDS_ON",
      description: "Fraud consumer needs Debezium topics",
    });

    // Now chain is: C -> B -> A.
    // Attempting A -> C (DEPENDS_ON) must be rejected because it would complete the cycle!
    await expect(
      RelationshipService.addRelationship({
        sourceDecisionId: decAId,
        targetDecisionId: decCId,
        type: "DEPENDS_ON",
      })
    ).rejects.toThrow("circular dependency detected");
  });

  it("transitions target decision status to SUPERSEDED when SUPERSEDES relationship is added", async () => {
    // Create an old decision that gets superseded
    const legacyDecision = await DecisionService.createDecision({
      workspaceId: testWorkspaceId,
      creatorId: testUserId,
      title: "Decision Legacy: RabbitMQ Broker",
      statement: "Use RabbitMQ for message bus.",
      priority: "LOW",
      status: "DECIDED",
    });

    // Decision A supersedes legacy decision
    await RelationshipService.addRelationship({
      sourceDecisionId: decAId,
      targetDecisionId: legacyDecision.id,
      type: "SUPERSEDES",
      description: "Kafka replaces RabbitMQ for event replay capability",
    });

    const updatedLegacy = await prisma.decision.findUnique({
      where: { id: legacyDecision.id },
    });
    expect(updatedLegacy?.status).toBe("SUPERSEDED");

    // Check audit event on superseded decision
    const statusEvents = await prisma.decisionEvent.findMany({
      where: { decisionId: legacyDecision.id, eventType: "STATUS_CHANGED" },
    });
    expect(statusEvents.length).toBeGreaterThanOrEqual(1);
    expect(statusEvents[0].title).toContain('Decision superseded by "Decision A');
  });

  it("retrieves relationships for a decision (incoming and outgoing)", async () => {
    const res = await RelationshipService.getRelationships(decBId);

    // B has outgoing to A, incoming from C
    expect(res.outgoing.length).toBeGreaterThanOrEqual(1);
    expect(res.incoming.length).toBeGreaterThanOrEqual(1);
    expect(res.total).toBe(res.outgoing.length + res.incoming.length);
    expect(res.outgoing[0].targetDecision.id).toBe(decAId);
    expect(res.incoming[0].sourceDecision.id).toBe(decCId);
  });

  it("builds a multi-hop decision graph with health score metadata", async () => {
    const graph = await RelationshipService.getDecisionGraph(decBId, 2);

    expect(graph.rootId).toBe(decBId);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(3);
    expect(graph.edges.length).toBeGreaterThanOrEqual(2);
    expect(graph.cyclesDetected).toBe(false);

    const nodeA = graph.nodes.find((n) => n.id === decAId);
    expect(nodeA).toBeDefined();
    expect(nodeA?.healthScore).toBeDefined();
    expect(nodeA?.healthStatus).toBeDefined();
  });

  it("removes a relationship and logs audit event", async () => {
    // Create temporary relationship to delete
    const tempRel = await RelationshipService.addRelationship({
      sourceDecisionId: decCId,
      targetDecisionId: decAId,
      type: "SUPPORTS",
    });

    const removed = await RelationshipService.removeRelationship(tempRel.id, testUserId);
    expect(removed.id).toBe(tempRel.id);

    const check = await prisma.decisionRelationship.findUnique({
      where: { id: tempRel.id },
    });
    expect(check).toBeNull();

    const removeEvents = await prisma.decisionEvent.findMany({
      where: { decisionId: decCId, eventType: "RELATIONSHIP_REMOVED" },
    });
    expect(removeEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("serves GET, POST and DELETE relationship API endpoints successfully", async () => {
    // 1. POST
    const postReq = new Request(`http://localhost:3000/api/decisions/${decAId}/relationships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetDecisionId: decCId,
        type: "RELATES_TO",
        description: "Kafka clusters feed Flink processors",
      }),
    });
    const postRes = await postRelationshipHandler(postReq, {
      params: Promise.resolve({ id: decAId }),
    });
    const postData = await postRes.json();
    expect(postRes.status).toBe(201);
    expect(postData.success).toBe(true);
    const createdRelId = postData.relationship.id;

    // 2. GET
    const getReq = new Request(`http://localhost:3000/api/decisions/${decAId}/relationships`);
    const getRes = await getRelationshipsHandler(getReq, {
      params: Promise.resolve({ id: decAId }),
    });
    const getData = await getRes.json();
    expect(getRes.status).toBe(200);
    expect(getData.success).toBe(true);
    expect(getData.total).toBeGreaterThan(0);

    // 3. GET Graph
    const graphReq = new Request(`http://localhost:3000/api/decisions/${decAId}/graph?depth=2`);
    const graphRes = await getGraphHandler(graphReq, {
      params: Promise.resolve({ id: decAId }),
    });
    const graphData = await graphRes.json();
    expect(graphRes.status).toBe(200);
    expect(graphData.success).toBe(true);
    expect(graphData.graph.nodes.length).toBeGreaterThanOrEqual(2);

    // 4. DELETE
    const delReq = new Request(
      `http://localhost:3000/api/decisions/${decAId}/relationships/${createdRelId}`,
      { method: "DELETE" }
    );
    const delRes = await deleteRelationshipHandler(delReq, {
      params: Promise.resolve({ id: decAId, relId: createdRelId }),
    });
    const delData = await delRes.json();
    expect(delRes.status).toBe(200);
    expect(delData.success).toBe(true);
  });
});
