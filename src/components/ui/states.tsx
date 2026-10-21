import React from "react";
import { cn } from "@/lib/utils";
import { FolderGit2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "./button";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 mb-3">
        {icon || <FolderGit2 className="h-6 w-6" />}
      </div>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" variant="outline" className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export const LoadingState: React.FC<{ message?: string; className?: string }> = ({
  message = "Loading artifact fossils...",
  className,
}) => {
  return (
    <div className={cn("flex min-h-[220px] flex-col items-center justify-center p-8", className)}>
      <Loader2 className="h-6 w-6 animate-spin text-zinc-400 mb-2" />
      <p className="text-xs text-zinc-500 font-mono tracking-tight">{message}</p>
    </div>
  );
};

export const ErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}> = ({ title = "Failed to load", message, onRetry, className }) => {
  return (
    <div
      className={cn(
        "flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/20 p-8 text-center",
        className
      )}
    >
      <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
      <h3 className="text-sm font-semibold text-red-900 dark:text-red-300">{title}</h3>
      <p className="mt-1 text-xs text-red-600 dark:text-red-400 max-w-sm">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} size="sm" variant="outline" className="mt-4 border-red-300 text-red-700">
          Retry
        </Button>
      )}
    </div>
  );
};
