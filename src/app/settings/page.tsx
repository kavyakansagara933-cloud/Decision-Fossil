import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Database, Sliders, ShieldCheck } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
          Workspace Settings
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Manage system configurations, environment connectivity, and historical preservation rules.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Database &amp; Engine
          </h3>
          <p className="text-xs text-zinc-500">
            Configure underlying persistent relational storage.
          </p>
        </div>

        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Active Storage Provider</CardTitle>
                <Badge variant="success" size="sm">Connected</Badge>
              </div>
              <CardDescription>
                Zero-config SQLite active for local development. Production supports PostgreSQL.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 text-xs font-mono text-zinc-500">
              Provider: SQLite (Portable to PostgreSQL) <br />
              Prisma Client: v6.4.1
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Audit Policies
          </h3>
          <p className="text-xs text-zinc-500">
            Non-destructive retention rules for assumptions and decisions.
          </p>
        </div>

        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Historical Immutability</CardTitle>
                <Badge variant="neutral" size="sm">Enforced</Badge>
              </div>
              <CardDescription>
                State changes on assumptions and decisions generate immutable event logs.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <p className="text-xs text-zinc-500 leading-relaxed">
                Modifications to existing records always append to version snapshots and validation histories.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
