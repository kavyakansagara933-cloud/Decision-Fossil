import { prisma } from "../src/lib/db";
import { DecisionService } from "../src/services/decision-service";
import { WorkspaceService } from "../src/services/workspace-service";

async function main() {
  console.log("🌱 Seeding Decision Fossil foundational data...");

  // 1. Ensure Workspace and Lead Architect exist
  const workspace = await WorkspaceService.getOrCreateDefaultWorkspace();
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user found");

  // 2. Check if decisions already seeded
  const existing = await prisma.decision.findFirst({
    where: { workspaceId: workspace.id },
  });

  if (existing) {
    console.log("✅ Seed data already present.");
    return;
  }

  // 3. Create canonical architectural decision: "Adopt SQLite/PostgreSQL Dual-Engine Strategy"
  const decision1 = await DecisionService.createDecision({
    workspaceId: workspace.id,
    creatorId: user.id,
    title: "Standardize on Relational Database with Prisma for Decision Fossils",
    statement:
      "Use PostgreSQL for production and SQLite for local development via Prisma ORM to preserve rich relational decision graphs.",
    priority: "HIGH",
    status: "DECIDED",
    context:
      "Decision intelligence requires querying deep relations (Decisions -> Versions -> Assumptions -> Evidence -> History). A relational model with strict schema enforcement is required.",
    reasoning:
      "Document/NoSQL databases make strict audit trails and version graph integrity difficult to enforce across relationships. Prisma ensures type-safe schema migrations.",
    reviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  });

  // 4. Add Alternative Considerations
  await DecisionService.addAlternative({
    decisionId: decision1.id,
    name: "MongoDB / Document Database",
    description: "Store entire decision records as single embedded JSON documents",
    pros: "Flexible schema, quick to start",
    cons: "Poor relational integrity across shared assumptions, difficult historical diffing",
    selectionReason: "Rejected due to lack of cross-decision assumption tracking and audit constraints",
    status: "REJECTED",
    chosen: false,
  });

  await DecisionService.addAlternative({
    decisionId: decision1.id,
    name: "PostgreSQL with Prisma ORM",
    description: "Normalized relational schema with immutable event tables and version snapshots",
    pros: "ACID transactions, rich relational joins, strong typing, battle-tested",
    cons: "Requires migrations on schema alterations",
    selectionReason: "Selected because Decision Fossil relies on referential integrity across assumptions and events",
    status: "SELECTED",
    chosen: true,
  });

  // 5. Add Assumptions (The Core Product Principle!)
  const { assumption: assump1 } = await DecisionService.addAssumption({
    decisionId: decision1.id,
    workspaceId: workspace.id,
    statement: "Decision count per workspace will stay under 100,000 in Year 1",
    importance: "HIGH",
    confidence: "HIGH",
    status: "VALID",
    originalState: "Under 100k decisions per workspace",
    impactNote: "Fits comfortably within single-node database capacity without sharding",
  });

  const { assumption: assump2 } = await DecisionService.addAssumption({
    decisionId: decision1.id,
    workspaceId: workspace.id,
    statement: "Average decision mutation frequency is low (read-heavy, append-only history)",
    importance: "HIGH",
    confidence: "MEDIUM",
    status: "VALID",
    originalState: "Read/Write ratio estimated at 95:5",
    impactNote: "Heavy caching and snapshotting strategies remain effective",
  });

  // Simulate a historical reassessment of assump2 to showcase non-destructive history
  await DecisionService.validateAssumption(assump2.id, decision1.id, {
    newStatus: "VALID",
    currentState: "Read/Write ratio measured at 92:8 in Q3 audit",
    reason: "Quarterly metrics confirm assumption holds within margin of error",
    actorId: user.id,
  });

  // 6. Add Supporting Evidence
  await DecisionService.addEvidence({
    decisionId: decision1.id,
    workspaceId: workspace.id,
    title: "Prisma v6 Performance & Type-Safety Benchmark",
    type: "BENCHMARK",
    source: "https://www.prisma.io/benchmarks",
    description: "Internal spike verified query speeds under 5ms for 4-level deep relational joins.",
    note: "Validated join latency for decision version extraction",
  });

  // 7. Add Expected Outcome
  await DecisionService.addOutcome({
    decisionId: decision1.id,
    expectedOutcome: "Zero data corruption on version rollback and instant audit log generation",
    status: "ACHIEVED",
    actualOutcome: "100% of state transitions captured in immutable event log",
    measurement: "Zero schema divergence observed in integration test suite",
    notes: "Verified in test suite",
  });

  console.log(`✅ Seeded decision fossil: ${decision1.id} (${decision1.title})`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
