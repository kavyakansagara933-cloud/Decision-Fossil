# Decision Fossil — System Architecture

## 1. System Overview

**Decision Fossil** is an architectural and strategic decision-intelligence engine designed to record and validate the reasoning behind complex technical choices.

Unlike conventional documentation or issue tracking tools, Decision Fossil treats decisions as dynamic entities whose underlying assumptions and evidence must be actively monitored and reassessed over time.

---

## 2. Layered Architecture

```
┌────────────────────────────────────────────────────────┐
│                        UI Layer                        │
│   (Server & Client Components, Reusable UI Primitives) │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    API / Route Handlers                │
│    (Next.js App Router API Routes, HTTP Serialization) │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   Domain Services Layer                │
│ (DecisionService, WorkspaceService, Lifecycle State)   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                 Data Access & ORM Layer                │
│           (Prisma ORM, SQLite / PostgreSQL)            │
└────────────────────────────────────────────────────────┘
```

### Architectural Separation
1. **UI Layer (`src/components/`, `src/app/`)**:
   - Houses presentation components with developer-tool ergonomics.
   - Never accesses the database directly; communicates via API routes and server actions.
2. **Domain Service Layer (`src/services/`)**:
   - Contains business logic, lifecycle transition validation, snapshot generation, and audit logging.
   - Enforces referential consistency and historical preservation.
3. **Data Access Layer (`src/lib/db.ts`, `prisma/`)**:
   - Manages connection lifecycle and relational models with Prisma ORM.
4. **Validation Layer (`src/types/`)**:
   - Strong schema validation powered by Zod for both client and server boundaries.

---

## 3. Domain Model & Entities

| Entity | Purpose & Justification |
|---|---|
| **User** | Represents architects and team members who propose, evaluate, or reassess decisions. |
| **Workspace** | Multi-tenant organization unit grouping architectural projects and repositories. |
| **WorkspaceMember** | Role-based membership (Owner, Admin, Member, Viewer). |
| **Decision** | The central root entity encapsulating title, statement, priority, status, and lifecycle dates. |
| **DecisionVersion** | Immutable snapshot preserving statement, context, and reasoning diffs across iterations. |
| **Alternative** | Candidate options considered (e.g., Kafka vs RabbitMQ), with pros, cons, and selection rationale. |
| **Assumption** | Foundational premises upon which decisions rest (e.g. throughput requirements, team size). |
| **AssumptionValidationHistory** | **Crucial entity**: Appends historical logs of every status reassessment without overwriting initial baselines. |
| **Evidence** | Quantitative or qualitative artifacts (benchmarks, URLs, docs) supporting rationale and assumptions. |
| **Outcome** | Tracks real-world impact comparing initial expectations against observed measurements. |
| **DecisionEvent** | Append-only audit stream tracking all state changes, additions, and mutations. |
| **Tag** | Categorical labels for indexing decisions across domains. |

---

## 4. Decision Lifecycle

```
[DRAFT]
   │
   ▼
[PROPOSED]
   │
   ▼
[DECIDED] ────► [MONITORING]
                    │
                    ▼
              [REASSESSING]
               │     │     │
         ┌─────┘     │     └─────┐
         ▼           ▼           ▼
    [VALIDATED]  [REJECTED]  [SUPERSEDED]
```

### Lifecycle Rules
- State transitions require explicit justification and log an immutable `DecisionEvent`.
- Transitioning to `DECIDED` records the `decidedAt` milestone.
- When an attached `Assumption` transitions to `INVALID`, the decision automatically surfaces in the monitoring dashboard as requiring review.

---

## 5. Non-Destructive Historical Preservation

A core thesis of Decision Fossil is that engineering reasoning should never be silently rewritten.

### Pattern:
```typescript
// 1. Assumption baseline remains preserved
originalState: "Under 100k decisions per workspace"

// 2. Current observed status is updated
currentState: "Read/Write ratio measured at 92:8 in Q3 audit"

// 3. New historical entry is appended into AssumptionValidationHistory
await tx.assumptionValidationHistory.create({
  data: {
    assumptionId,
    previousStatus,
    newStatus,
    previousState,
    newState,
    reason: "Telemetry audit revealed changed distribution",
    actorId,
  }
});
```

---

## 6. Future AI Intelligence Integration

The architecture is explicitly constructed to enable future AI functionality without rewriting core domain entities:
- **Assumption Drift Detector**: An agentic background job can inspect production telemetry or GitHub PR diffs against registered assumptions and alert when an assumption is in jeopardy.
- **Decision Fossil Synthesizer**: LLMs can summarize long architectural threads into formalized Decision, Alternative, and Assumption records.
- **Impact Querying**: Embeddings can be indexed on Decision and Evidence entities to allow semantic queries like *"Why did we choose Kafka over SQS in 2024?"*.
