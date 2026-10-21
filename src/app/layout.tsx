import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "Decision Fossil — Decision-Intelligence Architecture",
  description:
    "Preserve and analyze the reasoning, assumptions, alternatives, and validation history behind engineering decisions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased font-sans">
        <ToastProvider>
          <Navigation />
          <div className="flex-1">{children}</div>
        </ToastProvider>
      </body>
    </html>
  );
}
