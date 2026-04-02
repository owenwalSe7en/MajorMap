import type { ReactNode } from "react";
import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "MajorMap — Free Degree Planner",
    template: "%s | MajorMap",
  },
  description: "Plan your degree, your way. Browse programs, plan semesters, track progress, and import transcripts — free for University of Utah students.",
  metadataBase: new URL("https://majormap.app"),
  openGraph: {
    type: "website",
    siteName: "MajorMap",
    title: "MajorMap — Free Degree Planner",
    description: "Plan your degree, your way. Browse programs, plan semesters, track progress.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="font-display text-lg tracking-tight hover:opacity-80 transition-opacity">
              Major Map
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/programs"
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Programs
              </Link>
              <Link
                href="/courses"
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Courses
              </Link>
              <Link
                href="/plans"
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Plan
              </Link>
              <Link
                href="/compare"
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Compare
              </Link>
              <div className="ml-2 pl-3 border-l border-border">
                <AccountMenu />
              </div>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
