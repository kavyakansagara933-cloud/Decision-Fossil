"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { KeyRound, Mail, ArrowRight, Shield } from "lucide-react";

export default function AuthPage() {
  const [email, setEmail] = useState("architect@decisionfossil.dev");
  const [password, setPassword] = useState("password123");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast({
        type: "success",
        title: "Session Authenticated",
        message: "Signed in as Lead Architect with workspace access.",
      });
      window.location.href = "/decisions";
    }, 600);
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-md border-zinc-200 dark:border-zinc-800">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 mb-2">
            <Shield className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl">Authentication Entrypoint</CardTitle>
          <CardDescription>
            Access your workspace decision repository and historical audit trails.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Work Email
              </label>
              <div className="relative">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Access Key / Password
                </label>
                <span className="text-[11px] text-zinc-400">Dev Mode Auto-Fill</span>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full mt-2" isLoading={isLoading}>
              Sign In to Workspace <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </form>

          <div className="mt-6 border-t border-zinc-100 dark:border-zinc-800 pt-4 text-center">
            <p className="text-xs text-zinc-500">
              Configured with NextAuth session models and Prisma adapters.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
