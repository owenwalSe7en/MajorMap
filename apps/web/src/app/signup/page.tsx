import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Sign Up" };

export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/plans");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-display tracking-tight">Create an account</h1>
          <p className="text-sm text-muted-foreground">Start planning your degree with Major Map</p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
