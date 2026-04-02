import type { ReactNode } from "react";
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
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
