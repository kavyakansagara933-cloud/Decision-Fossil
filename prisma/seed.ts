import { prisma } from "../src/lib/db";
import { DecisionService } from "../src/services/decision-service";

async function main() {
  console.log("🌱 Populating Decision Fossil realistic multi-workspace seed data...");

  // Reset existing records for fresh, clean state
  await prisma.decisionEvent.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.outcome.deleteMany();
  await prisma.evidenceAssumption.deleteMany();
  await prisma.decisionEvidence.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.assumptionValidationHistory.deleteMany();
  await prisma.decisionAssumption.deleteMany();
  await prisma.assumption.deleteMany();
  await prisma.alternative.deleteMany();
  await prisma.decisionVersion.deleteMany();
  await prisma.decisionTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  // ─── 1. Users ─────────────────────────────────────────────────────────────
  const elena = await prisma.user.create({
    data: {
      name: "Dr. Elena Rostova",
      email: "elena@decisionfossil.dev",
      role: "ADMIN",
    },
  });

  const marcus = await prisma.user.create({
    data: {
      name: "Marcus Vance",
      email: "marcus@decisionfossil.dev",
      role: "USER",
    },
  });

  const sophia = await prisma.user.create({
    data: {
      name: "Sophia Chen",
      email: "sophia@decisionfossil.dev",
      role: "USER",
    },
  });

  const devon = await prisma.user.create({
    data: {
      name: "Devon Reed",
      email: "devon@decisionfossil.dev",
      role: "USER",
    },
  });

  console.log("✓ Created 4 team members");

  // ─── 2. Workspaces ────────────────────────────────────────────────────────
  const wsCore = await prisma.workspace.create({
    data: {
      name: "Core Platform & Infrastructure",
      slug: "core-engineering",
      description: "Primary backend, database, and distributed systems architecture repository",
      members: {
        create: [
          { userId: elena.id, role: "OWNER" },
          { userId: marcus.id, role: "ADMIN" },
          { userId: sophia.id, role: "MEMBER" },
        ],
      },
    },
  });

  const wsData = await prisma.workspace.create({
    data: {
      name: "Data Platform & Streaming",
      slug: "data-streaming",
      description: "Real-time pipelines, ingestion systems, and warehouse modeling",
      members: {
        create: [
          { userId: marcus.id, role: "OWNER" },
          { userId: devon.id, role: "MEMBER" },
        ],
      },
    },
  });

  const wsSecurity = await prisma.workspace.create({
    data: {
      name: "Security & Governance",
      slug: "security-governance",
      description: "Identity, audit controls, cryptography, and compliance frameworks",
      members: {
        create: [
          { userId: sophia.id, role: "OWNER" },
          { userId: elena.id, role: "ADMIN" },
        ],
      },
    },
  });

  console.log("✓ Created 3 realistic engineering workspaces");

  // ─── Decision 1: Relational Schema & Prisma (Core WS) ─────────────────────
  const dec1 = await DecisionService.createDecision({
    workspaceId: wsCore.id,
    creatorId: elena.id,
    title: "Standardize on Relational Database with Prisma for Decision Graphs",
    statement: "Adopt PostgreSQL for production and SQLite for local development via Prisma ORM to preserve rich relational decision graphs.",
    priority: "HIGH",
    status: "DECIDED",
    context: "Decision intelligence requires querying deep relations (Decisions -> Versions -> Assumptions -> Evidence -> History). A relational model with strict referential integrity is necessary.",
    reasoning: "Document/NoSQL datastores make cross-entity audit trails and multi-version integrity difficult to enforce without bespoke application layers.",
    reviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  });

  await DecisionService.addAlternative({
    decisionId: dec1.id,
    name: "MongoDB / Document Store",
    description: "Store entire decision records as single embedded JSON documents",
    pros: "Flexible schema, quick prototyping",
    cons: "Poor relational integrity across shared assumptions, difficult historical diffing",
    selectionReason: "Rejected due to lack of cross-decision assumption tracking and referential integrity",
    status: "REJECTED",
    chosen: false,
  });

  await DecisionService.addAlternative({
    decisionId: dec1.id,
    name: "PostgreSQL with Prisma ORM",
    description: "Normalized relational schema with immutable event tables and version snapshots",
    pros: "ACID transactions, rich relational joins, strong typing, battle-tested",
    cons: "Requires migrations on schema alterations",
    selectionReason: "Selected because Decision Fossil relies on referential integrity across assumptions and events",
    status: "SELECTED",
    chosen: true,
  });

  const { assumption: d1a1 } = await DecisionService.addAssumption({
    decisionId: dec1.id,
    workspaceId: wsCore.id,
    statement: "Decision count per workspace will stay under 100,000 in Year 1",
    importance: "HIGH",
    confidence: "HIGH",
    status: "VALID",
    originalState: "Under 100k decisions per workspace",
    impactNote: "Fits comfortably within single-node database capacity without sharding",
  });

  const { assumption: d1a2 } = await DecisionService.addAssumption({
    decisionId: dec1.id,
    workspaceId: wsCore.id,
    statement: "Average decision mutation frequency is low (read-heavy, append-only history)",
    importance: "HIGH",
    confidence: "MEDIUM",
    status: "VALID",
    originalState: "Read/Write ratio estimated at 95:5",
    impactNote: "Heavy caching and snapshotting strategies remain effective",
  });

  await DecisionService.validateAssumption(d1a2.id, dec1.id, {
    newStatus: "VALID",
    currentState: "Read/Write ratio measured at 92:8 in Q3 audit",
    reason: "Quarterly telemetry confirms assumption holds within margin of error",
    actorId: elena.id,
  });

  await DecisionService.addEvidence({
    decisionId: dec1.id,
    workspaceId: wsCore.id,
    title: "Prisma v6 Performance & Type-Safety Benchmark",
    type: "BENCHMARK",
    source: "https://www.prisma.io/benchmarks",
    description: "Internal spike verified query speeds under 5ms for 4-level deep relational joins.",
    note: "Validated join latency for decision version extraction",
    assumptionIds: [d1a1.id],
  });

  await DecisionService.addOutcome({
    decisionId: dec1.id,
    expectedOutcome: "Zero data corruption on version rollback and instant audit log generation",
    status: "ACHIEVED",
    actualOutcome: "100% of state transitions captured in immutable event log",
    measurement: "Zero schema divergence observed in integration test suite",
    notes: "Verified in automated test runs",
  });

  // ─── Decision 2: Streaming Architecture with INVALIDATED ASSUMPTION (Data WS) ─
  const dec2 = await DecisionService.createDecision({
    workspaceId: wsData.id,
    creatorId: marcus.id,
    title: "Deploy Single-Node RabbitMQ Cluster for Real-time Event Ingestion",
    statement: "Deploy RabbitMQ as the central message bus for async event ingestion between edge workers and database processors.",
    priority: "CRITICAL",
    status: "REASSESSING",
    context: "Initial ingestion pipeline required lightweight broker with fast setup and low operational overhead.",
    reasoning: "Team had prior expertise with AMQP; estimated peak load did not initially justify Apache Kafka cluster management.",
    reviewDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  });

  await DecisionService.addAlternative({
    decisionId: dec2.id,
    name: "Apache Kafka / Confluent",
    description: "Distributed commit log with partition-based consumer horizontal scaling",
    pros: "Virtually unlimited throughput, event replayability",
    cons: "High memory footprint, ZooKeeper/KRaft cluster complexity",
    selectionReason: "Deferred due to operational overhead for a 2-person team",
    status: "CONSIDERED",
    chosen: false,
  });

  await DecisionService.addAlternative({
    decisionId: dec2.id,
    name: "RabbitMQ Cluster",
    description: "AMQP broker with exchange routing and lightweight Erlang processes",
    pros: "Rich routing, native message acknowledgments, simple UI management",
    cons: "Difficult queue sharding when consumers lag",
    selectionReason: "Chosen for operational simplicity and fast dev velocity",
    status: "SELECTED",
    chosen: true,
  });

  // Assumption that gets invalidated!
  const { assumption: d2a1 } = await DecisionService.addAssumption({
    decisionId: dec2.id,
    workspaceId: wsData.id,
    statement: "Peak incoming event ingestion rate will not exceed 8,000 events/second",
    importance: "CRITICAL",
    confidence: "MEDIUM",
    status: "INVALID",
    originalState: "Peak ingestion <= 8k msgs/sec",
    impactNote: "Single queue throughput threshold before memory pressure and queue backpressure occur",
  });

  // Step 1: Invalidate assumption non-destructively
  await DecisionService.validateAssumption(d2a1.id, dec2.id, {
    newStatus: "INVALID",
    currentState: "Sustained ingest spike reached 38,000 events/sec during mobile launch",
    reason: "Erlang node ran out of RAM, forced broker into flow-control throttling, dropping consumer messages",
    actorId: marcus.id,
  });

  await DecisionService.addEvidence({
    decisionId: dec2.id,
    workspaceId: wsData.id,
    title: "Grafana Broker Memory & Message Lag Dashboard",
    type: "DATASET",
    source: "https://monitoring.internal/dashboards/rabbitmq-lag-incident",
    description: "Exported prometheus metrics proving unacknowledged message queue reached 1.2M messages during traffic spike.",
    note: "Definitive evidence that single-node AMQP failed the load threshold",
    assumptionIds: [d2a1.id],
  });

  // ─── Decision 3: NEGATIVE OUTCOME Case (Core WS) ───────────────────────────
  const dec3 = await DecisionService.createDecision({
    workspaceId: wsCore.id,
    creatorId: devon.id,
    title: "Client-Side In-Memory Search without Elastic/Meilisearch Index",
    statement: "Perform decision search by downloading workspace index to browser memory and filtering with client-side regex.",
    priority: "MEDIUM",
    status: "VALIDATED", // was decided, then validated or reconsidered
    context: "Avoid running an external search container or paying for managed search SaaS in early stages.",
    reasoning: "Decisions count was small, JSON payload was < 500KB over wire.",
    reviewDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  await DecisionService.addAlternative({
    decisionId: dec3.id,
    name: "Meilisearch Sidecar",
    description: "Dedicated lightweight typo-tolerant search engine",
    pros: "Sub-50ms search, facet filtering, typo tolerance",
    cons: "Additional service container to deploy and monitor",
    selectionReason: "Rejected to prevent infrastructure sprawl",
    status: "REJECTED",
    chosen: false,
  });

  await DecisionService.addAlternative({
    decisionId: dec3.id,
    name: "Client In-Memory Filtering",
    description: "Fetch workspace manifest into React state and filter locally",
    pros: "Zero infrastructure cost, zero network roundtrips after load",
    cons: "High payload on slow networks, client RAM usage",
    selectionReason: "Selected as good-enough baseline",
    status: "SELECTED",
    chosen: true,
  });

  const { assumption: d3a1 } = await DecisionService.addAssumption({
    decisionId: dec3.id,
    workspaceId: wsCore.id,
    statement: "Workspace decision manifest payload will remain under 1MB compressed",
    importance: "MEDIUM",
    confidence: "LOW",
    status: "QUESTIONABLE",
    originalState: "Bundle payload <= 1MB",
    impactNote: "Above 1MB, initial page load degrades severely on cellular connections",
  });

  // Negative Outcome!
  await DecisionService.addOutcome({
    decisionId: dec3.id,
    expectedOutcome: "Instantaneous search responsiveness with zero backend server overhead",
    actualOutcome: "Initial page load LCP ballooned to 4.2 seconds on mobile devices as decision payload grew to 6.8MB",
    status: "FAILED",
    measurement: "LCP = 4.2s (Good target: < 2.5s), Network transfer = 6.8MB uncompressed",
    notes: "Directly violated Core Web Vitals threshold. Search must be moved to server-side Postgres full-text query.",
  });

  // ─── Decision 4: Token-Based Session Architecture (Security WS) ───────────
  const dec4 = await DecisionService.createDecision({
    workspaceId: wsSecurity.id,
    creatorId: sophia.id,
    title: "Implement Stateless JWTs with HttpOnly Refresh Cookies for Workspace Auth",
    statement: "Authenticate API requests using short-lived JWT access tokens accompanied by rotating HttpOnly refresh tokens stored in PostgreSQL.",
    priority: "HIGH",
    status: "MONITORING",
    context: "Need secure API authorization across Next.js server actions and future external CLI tooling.",
    reasoning: "Mitigates XSS attack surface while allowing rapid session revocation via refresh token invalidation in database.",
    reviewDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  });

  await DecisionService.addAlternative({
    decisionId: dec4.id,
    name: "Pure Server Sessions (Redis/Postgres on every request)",
    description: "Database lookup on each API endpoint",
    pros: "Instant revocation, simple mental model",
    cons: "Every read request adds database latency roundtrip",
    selectionReason: "Rejected to protect API read throughput",
    status: "CONSIDERED",
    chosen: false,
  });

  await DecisionService.addAlternative({
    decisionId: dec4.id,
    name: "Hybrid JWT + Database Refresh Token",
    description: "15-minute stateless JWT + database-backed refresh rotation",
    pros: "Low read latency, secure refresh rotation, revokable",
    cons: "Revocation delay up to 15 mins for active tokens",
    selectionReason: "Optimal balance of performance and security audit posture",
    status: "SELECTED",
    chosen: true,
  });

  const { assumption: d4a1 } = await DecisionService.addAssumption({
    decisionId: dec4.id,
    workspaceId: wsSecurity.id,
    statement: "15-minute revocation window is acceptable under enterprise security compliance",
    importance: "HIGH",
    confidence: "HIGH",
    status: "VALID",
    originalState: "15m token expiration window compliant with SOC2 Type II audit",
    impactNote: "If SOC2 auditor requires immediate session kill, must introduce token blacklist cache",
  });

  await DecisionService.addEvidence({
    decisionId: dec4.id,
    workspaceId: wsSecurity.id,
    title: "OWASP Session Management Cheat Sheet v4.2",
    type: "DOCUMENT",
    source: "https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html",
    description: "Industry guidelines recommending short-lived bearer tokens combined with secure refresh token rotation.",
    assumptionIds: [d4a1.id],
  });

  await DecisionService.addOutcome({
    decisionId: dec4.id,
    expectedOutcome: "Zero token leakage incidents and successful penetration testing pass",
    status: "ACHIEVED",
    actualOutcome: "Internal security review approved auth flow with zero findings",
    measurement: "Passed 100% of automated OWASP ZAP security test scenarios",
    notes: "Currently monitoring for edge case cookie handling on cross-origin webhooks",
  });

  // ─── Decision 5: Monorepo vs Polyrepo Architecture (Core WS) ──────────────
  const dec5 = await DecisionService.createDecision({
    workspaceId: wsCore.id,
    creatorId: elena.id,
    title: "Consolidate Decision Fossil Web, Services, and Workers into Single Monorepo",
    statement: "Maintain frontend, domain services, migration scripts, and test suites in a single unified TypeScript repository.",
    priority: "MEDIUM",
    status: "DECIDED",
    context: "Evaluating whether to split backend API and frontend Next.js app into separate GitHub repositories.",
    reasoning: "End-to-end type safety between database schema, domain services, and UI components saves enormous development cycles during rapid iteration.",
    reviewDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
  });

  await DecisionService.addAlternative({
    decisionId: dec5.id,
    name: "Independent Repositories (Polyrepo)",
    description: "Separate GitHub repos for UI, Backend API, and Database migrations",
    pros: "Independent deployment pipelines, small git checkout size",
    cons: "Schema drift, double-PR friction for single features, version synchronization overhead",
    selectionReason: "Rejected due to coordination friction for a high-velocity team",
    status: "REJECTED",
    chosen: false,
  });

  await DecisionService.addAlternative({
    decisionId: dec5.id,
    name: "Single Unified TypeScript Repository",
    description: "Shared tsconfig, schema, and domain layers in one repo",
    pros: "Atomic pull requests, refactorings update types across entire application instantly",
    cons: "Build times scale with repo size",
    selectionReason: "Selected because atomic schema-to-UI refactoring is paramount",
    status: "SELECTED",
    chosen: true,
  });

  const { assumption: d5a1 } = await DecisionService.addAssumption({
    decisionId: dec5.id,
    workspaceId: wsCore.id,
    statement: "Next.js Turbopack and Vitest build times will remain under 30 seconds",
    importance: "MEDIUM",
    confidence: "HIGH",
    status: "VALID",
    originalState: "CI test + build pipeline <= 30s",
    impactNote: "Ensures rapid developer feedback loops without complex remote caching",
  });

  await DecisionService.addOutcome({
    decisionId: dec5.id,
    expectedOutcome: "Zero cross-boundary type mismatches across full application stack",
    status: "ACHIEVED",
    actualOutcome: "TypeScript build time measured at 4.3s with zero type errors",
    measurement: "CI pipeline execution time = 14s total",
    notes: "Verified on Windows and Linux runners",
  });

  // ─── Decision 6: Decision Version Evolution showcase (Core WS) ────────────
  const dec6 = await DecisionService.createDecision({
    workspaceId: wsCore.id,
    creatorId: marcus.id,
    title: "Define Non-Destructive Assumption Versioning Policy",
    statement: "Mandate that no operational assumption can be modified via destructive SQL UPDATE without writing an append-only historical log entry.",
    priority: "CRITICAL",
    status: "DECIDED",
    context: "Teams often alter initial assumptions silently after failure, destroying the audit trail of why bad decisions happened.",
    reasoning: "Preserving historical failure context is the core value proposition of Decision Fossil.",
  });

  // Demonstrate updating this decision to create Version 2 and Version 3!
  await DecisionService.updateDecision(dec6.id, {
    title: "Enforce Non-Destructive Assumption Versioning Policy with Audit Signatures",
    statement: "Mandate that every assumption status change requires actor attribution, timestamp, and explicit validation reasoning before committing.",
    changeSummary: "Added actor attribution and reasoning enforcement to prevent anonymous status flipping",
    actorId: elena.id,
  });

  await DecisionService.updateDecision(dec6.id, {
    statement: "Mandate cryptographic signing and immutable audit records for all assumption reassessments across production workspaces.",
    changeSummary: "Prepared data model for enterprise cryptographic verification compliance",
    actorId: marcus.id,
  });

  console.log("✓ Seeded 6 comprehensive decision fossils demonstrating:");
  console.log("  • Normal decided choices with alternatives and benchmarks");
  console.log("  • Invalidated assumptions and non-destructive validation trails");
  console.log("  • Failed negative outcomes comparing Expectation vs Reality");
  console.log("  • Multi-version historical evolution across 3 workspaces");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
