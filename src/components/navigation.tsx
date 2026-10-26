import React from "react";
import Link from "next/link";
import { GitBranch, Shield, Compass, BookOpen, Layers, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Navigation: React.FC = () => {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 font-mono text-sm font-bold shadow-xs">
              DF
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
                Decision Fossil
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <Link
              href="/dashboard"
              className="hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/decisions"
              className="hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors"
            >
              Decisions
            </Link>
            <Link
              href="/decisions/extract"
              className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Extract</span>
            </Link>
            <Link
              href="/settings"
              className="hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors"
            >
              Settings
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>ws: core-engineering</span>
          </div>

          <Link href="/auth">
            <Button variant="outline" size="sm" className="text-xs">
              Sign In
            </Button>
          </Link>
          <Link href="/decisions">
            <Button size="sm" className="text-xs">
              Open Workspace
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};
