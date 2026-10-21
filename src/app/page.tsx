import Link from "next/link";
import {
  GitCommit,
  History,
  Layers,
  ArrowRight,
  ShieldCheck,
  Compass,
  FileCode,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full max-w-5xl px-6 pt-20 pb-16 md:pt-28 md:pb-24 text-center sm:text-left">
        <div className="flex flex-col items-start gap-4">
          <Badge variant="outline" className="font-mono text-xs px-3 py-1 bg-white dark:bg-zinc-900">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
            Decision-Intelligence Architecture
          </Badge>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 max-w-3xl leading-[1.15]">
            GitHub records <span className="underline decoration-zinc-400 underline-offset-8">what</span> changed. <br />
            Decision Fossil captures <span className="text-zinc-500 dark:text-zinc-400">why</span>.
          </h1>

          <p className="mt-2 max-w-2xl text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Preserve the architectural reasoning, alternatives considered, evidence gathered, and foundational assumptions behind critical decisions. Track whether your assumptions still hold true over time.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/decisions">
              <Button size="lg" className="gap-2">
                Explore Decisions <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/auth">
              <Button variant="outline" size="lg">
                Sign In / Access Workspace
              </Button>
            </Link>
          </div>
        </div>

        {/* Conceptual Comparison Card */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-3">
              <GitCommit className="h-4 w-4 text-zinc-400" />
              <span>TRADITIONAL VCS (e.g. Git)</span>
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-2">
              Code & Diff Mutation
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
              Records file alterations, commit timestamps, and line diffs. Does not record the unchosen architectural paths, disputed constraints, or ephemeral operational assumptions.
            </p>
            <div className="rounded bg-zinc-100 dark:bg-zinc-950 p-3 text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
              git commit -m &quot;feat: switch cache layer to Redis cluster&quot;
            </div>
          </div>

          <div className="rounded-lg border border-zinc-900 dark:border-zinc-700 bg-zinc-950 text-zinc-50 p-6 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-3">
              <History className="h-4 w-4" />
              <span>DECISION FOSSIL ENTITY GRAPH</span>
            </div>
            <h3 className="font-semibold text-white text-sm mb-2">
              Persistent Reasoning & Reassessment
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Preserves the full decision context: Alternatives (Memcached vs DynamoDB), Assumptions (&quot;Throughput &lt; 50k RPS&quot;), and triggers alerts when real-world conditions diverge.
            </p>
            <div className="rounded bg-zinc-900 p-3 text-[11px] font-mono text-emerald-300">
              [FOSSIL-01] Validated: Assumption held for 6 months • Reassessment scheduled
            </div>
          </div>
        </div>
      </section>

      {/* Core Principles */}
      <section className="w-full border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/30 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-2">
            Engineered for High-Stakes Architecture
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-8 max-w-xl">
            Cleanly separates domain entities to guarantee non-destructive historical preservation.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2 p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <Layers className="h-5 w-5 text-zinc-800 dark:text-zinc-200 mb-1" />
              <h4 className="font-semibold text-sm">Non-Destructive History</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                When assumptions are challenged or invalidated, original historical records are never overwritten. Every revision creates an audit timeline.
              </p>
            </div>

            <div className="flex flex-col gap-2 p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <Compass className="h-5 w-5 text-zinc-800 dark:text-zinc-200 mb-1" />
              <h4 className="font-semibold text-sm">Lifecycles Over Statuses</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Decisions traverse Draft → Proposed → Decided → Monitoring → Reassessing → Validated/Superseded with explicit justification triggers.
              </p>
            </div>

            <div className="flex flex-col gap-2 p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <ShieldCheck className="h-5 w-5 text-zinc-800 dark:text-zinc-200 mb-1" />
              <h4 className="font-semibold text-sm">Evidence & Assumption Anchors</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Link benchmarks, metrics, customer feedback, and documentation directly into the decision model to substantiate rationale.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
