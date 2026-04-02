import { createClient } from "@/lib/supabase/server";
import { Navigation } from "@/components/landing/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Search } from "lucide-react";

export const metadata = { title: "Programs" };

interface Props {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function ProgramsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("programs")
    .select("id, slug, name, degree_type, total_credits, description")
    .order("name");

  if (params.q) {
    const sanitized = params.q.slice(0, 100).replace(/[%_]/g, "");
    query = query.ilike("name", `%${sanitized}%`);
  }
  if (params.type) {
    query = query.eq("degree_type", params.type);
  }

  const { data: programs } = await query.limit(100);

  return (
    <main className="min-h-screen noise-overlay">
      <Navigation />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 pt-32 pb-16">
        <div className="mb-12">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-4">
            <span className="w-8 h-px bg-foreground/30" />
            Browse
          </span>
          <h1 className="text-4xl lg:text-6xl font-display tracking-tight">Programs</h1>
        </div>

        <form method="get" className="flex gap-3 mb-12">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              name="q"
              placeholder="Search programs..."
              defaultValue={params.q ?? ""}
              className="pl-10 h-12 rounded-full border-foreground/10"
            />
          </div>
          <select
            name="type"
            defaultValue={params.type ?? ""}
            className="h-12 px-4 rounded-full border border-foreground/10 bg-background text-sm"
          >
            <option value="">All Types</option>
            <option value="Bachelor of Science">BS</option>
            <option value="Bachelor of Arts">BA</option>
            <option value="Minor">Minor</option>
            <option value="Graduate Certificate">Certificate</option>
            <option value="Master of Science">MS</option>
            <option value="Doctor of Philosophy">PhD</option>
          </select>
          <Button type="submit" className="h-12 px-6 rounded-full">
            Search
          </Button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs?.map((program) => (
            <Link
              key={program.id}
              href={`/programs/${program.slug}`}
              className="group block p-6 rounded-xl border border-foreground/10 hover:border-foreground/20 transition-all duration-300 hover:-translate-y-1"
            >
              <h3 className="text-lg font-semibold mb-2 group-hover:translate-x-1 transition-transform duration-300">
                {program.name}
              </h3>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {program.degree_type}
                </Badge>
                {program.total_credits && (
                  <span className="text-sm text-muted-foreground">
                    {program.total_credits} credits
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {(!programs || programs.length === 0) && (
          <p className="text-center text-muted-foreground py-12">
            No programs found. Try a different search.
          </p>
        )}
      </div>
    </main>
  );
}
