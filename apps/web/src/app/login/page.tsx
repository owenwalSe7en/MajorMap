import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign In" };

export default async function LoginPage() {
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
          <h1 className="text-2xl font-display tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to your Major Map account</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
