import type { ReactNode } from "react";
import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import "./globals.css";

export const metadata = {
  title: {
    default: "Major Map",
    template: "%s | Major Map",
  },
  description: "Plan your degree, your way. Browse programs, plan semesters, and track progress.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="font-display text-lg tracking-tight">
              Major Map
            </Link>
            <nav className="flex items-center gap-6">
              <Link
                href="/programs"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Programs
              </Link>
              <Link
                href="/courses"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Courses
              </Link>
              <Link
                href="/plans"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Plan
              </Link>
              <AccountMenu />
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
