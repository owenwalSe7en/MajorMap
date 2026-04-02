"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loadGuestPlan, clearGuestPlan } from "@/lib/guest-plan";
import { migrateGuestPlan } from "./actions";

export function MigrationTrigger() {
  const router = useRouter();
  const migrationInProgress = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (migrationInProgress.current) return;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      const guestPlan = loadGuestPlan();
      if (!guestPlan) return;
      if (guestPlan.semesters.length === 0) {
        // Empty plan — just clear it
        clearGuestPlan();
        return;
      }

      migrationInProgress.current = true;

      migrateGuestPlan(guestPlan).then((result) => {
        if ("success" in result && result.success) {
          clearGuestPlan();
          router.push(`/plans/${result.planId}`);
        } else {
          migrationInProgress.current = false;
          setError("error" in result ? result.error ?? "Migration failed" : "Migration failed");
        }
      });
    });
  }, [router]);

  if (!error) return null;

  return (
    <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
      Failed to import your guest plan: {error}. Your plan is still saved locally.
    </div>
  );
}
