# Decision Fossil

> **Decision-Intelligence System** — Preserving and analyzing the reasoning behind critical engineering and architectural decisions.

---

## 1. Problem Being Solved

Traditional version control systems (like Git and GitHub) record **WHAT** changed in code (diffs, commit hashes, line additions/deletions). However, they almost never preserve **WHY** decisions were made:
- What constraints existed at the time?
- What alternatives were evaluated and why were they rejected?
- What operational and scale assumptions justified the choice?
- What evidence or benchmarks supported the decision?
- **Most critically:** Do those foundational assumptions still hold true 6 months or 2 years later?

**Decision Fossil** establishes a dedicated decision graph capturing the reasoning, alternatives, assumptions, evidence, and non-destructive validation history behind engineering choices.

---

## 2. Core Concept & Principles

```
Decision
├── Versions (Snapshot history)
├── Alternatives (Considered, Selected, Rejected with rationale)
├── Assumptions (With non-destructive validation & reassessment history)
├── Evidence (Benchmarks, documents, URLs, datasets)
├── Timeline Events (Immutable audit log)
└── Outcomes (Expectation vs. Reality tracking)
```

### Key Principles
1. **Historical Preservation (Non-Destructive Updates)**: When real-world conditions diverge (e.g., traffic exceeds 1M req/sec), assumptions are not simply overwritten. Instead, every status reassessment appends to an immutable validation history log.
2. **First-Class Lifecycle**: Decisions transition through `Draft` → `Proposed` → `Decided` → `Monitoring` → `Reassessing` → `Validated` / `Rejected` / `Superseded`.
3. **Decoupled Architecture**: Logic is cleanly segregated across UI primitives, domain services, type validators, and database access layers, preparing the foundation for future AI inference without restructuring.

---

## 3. Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack, React 19)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (strict mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Database ORM**: [Prisma ORM 6](https://www.prisma.io/)
- **Database Engine**: SQLite for portable zero-config dev/testing; seamlessly switchable to PostgreSQL via `DATABASE_URL`
- **Validation**: [Zod](https://zod.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Testing**: [Vitest](https://vitest.dev/)

---

## 4. Project Structure

```
decision-fossil/
├── docs/
│   └── architecture.md         # Detailed architectural design & domain documentation
├── prisma/
│   ├── schema.prisma           # Relational domain model with Prisma ORM
│   └── seed.ts                 # Realistic foundational seed data
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── decisions/      # Decision REST API routes & reassessment endpoints
│   │   ├── auth/               # Authentication entry point
│   │   ├── dashboard/          # Metric overview & audit stream
│   │   ├── decisions/          # Decision repository & detail view
│   │   ├── settings/           # Workspace & audit policy configurations
│   │   ├── layout.tsx          # Root shell layout with toast notifications
│   │   └── page.tsx            # Product landing page & developer-tool concept
│   ├── components/
│   │   ├── ui/                 # Reusable UI primitives (Button, Input, Badge, Card, etc.)
│   │   └── navigation.tsx      # Main application header & workspace selector
│   ├── lib/
│   │   ├── db.ts               # Prisma singleton client
│   │   └── utils.ts            # Class merging utility
│   ├── services/
│   │   ├── decision-service.ts # Domain logic for decisions, versions, & reassessments
│   │   └── workspace-service.ts# Workspace management & member associations
│   └── types/
│       ├── decision.ts         # Zod schemas & TypeScript type definitions
│       └── decision.test.ts    # Unit test suite for domain schemas
├── .env.example                # Example environment variables
└── README.md                   # Project documentation
```

---

## 5. Local Setup & Quickstart

### Prerequisites
- Node.js >= 18 (recommended: Node 20+)
- npm or pnpm

### Installation

1. **Clone and enter repository**:
   ```bash
   cd decision-fossil
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   *(By default, `.env` points to `file:./dev.db` for zero-friction local execution).*

4. **Initialize database schema**:
   ```bash
   npm run db:push
   ```

5. **Seed foundational data**:
   ```bash
   npm run db:seed
   ```

6. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js development server with Turbopack |
| `npm run build` | Compile optimized production build and verify type safety |
| `npm run start` | Start production server |
| `npm test` | Run unit test suite with Vitest |
| `npm run lint` | Run ESLint check |
| `npm run db:push` | Sync Prisma schema with SQLite/Postgres database |
| `npm run db:seed` | Populate database with realistic decision fossils |
| `npm run db:studio`| Launch Prisma Studio visual database browser |

---

## 7. Quality Control Checklist

- [x] TypeScript strict type checks pass (`tsc --noEmit`)
- [x] Next.js production build succeeds (`npm run build`)
- [x] Vitest unit test suite passes (`npm test`)
- [x] Zero hardcoded secrets; `.env` is gitignored
- [x] Complete non-destructive history pattern implemented in domain layer
