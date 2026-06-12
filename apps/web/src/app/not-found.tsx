import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen noise-overlay">
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <Compass className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-2">
          <p className="text-sm font-mono text-muted-foreground">404</p>
          <h1 className="text-2xl font-display tracking-tight">Page not found</h1>
          <p className="text-sm text-muted-foreground max-w-md">
            The page you&apos;re looking for doesn&apos;t exist — it may have moved, or the link is
            out of date.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/programs">Browse programs</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/courses">Browse courses</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
