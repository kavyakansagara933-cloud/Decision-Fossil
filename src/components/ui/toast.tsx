"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  toast: (options: { type?: ToastType; title: string; message?: string }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = ({ type = "info", title, message }: { type?: ToastType; title: string; message?: string }) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const remove = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border p-3.5 shadow-lg backdrop-blur-md transition-all text-xs",
              t.type === "success" && "bg-white dark:bg-zinc-900 border-emerald-500/30 text-zinc-900 dark:text-zinc-100",
              t.type === "error" && "bg-white dark:bg-zinc-900 border-red-500/30 text-zinc-900 dark:text-zinc-100",
              t.type === "warning" && "bg-white dark:bg-zinc-900 border-amber-500/30 text-zinc-900 dark:text-zinc-100",
              t.type === "info" && "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
            )}
          >
            {t.type === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />}
            {t.type === "error" && <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
            {t.type === "warning" && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />}
            {t.type === "info" && <Info className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="font-medium">{t.title}</p>
              {t.message && <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">{t.message}</p>}
            </div>
            <button onClick={() => remove(t.id)} className="text-zinc-400 hover:text-zinc-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
};
