import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GuestPlanner } from "./guest-planner";
import { MigrationTrigger } from "./migration-trigger";

export const metadata = { title: "Plan" };

export default async function PlansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Authenticated: find or create plan, then redirect to it
    const { data: plans } = await supabase
      .from("semester_plans")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (plans && plans.length > 0) {
      redirect(`/plans/${plans[0].id}`);
    }

    // No plan exists — create one
    const { data: newPlan } = await supabase
      .from("semester_plans")
      .insert({ user_id: user.id, name: "My Plan" })
      .select("id")
      .single();

    if (newPlan) {
      redirect(`/plans/${newPlan.id}`);
    }
  }

  // Guest mode
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-display tracking-tight">My Plan</h1>
      </div>
      <MigrationTrigger />
      <GuestPlanner />
    </main>
  );
}
