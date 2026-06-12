import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { fetchProgramsPage } from "@/lib/catalog-browse";
import { pageHref, sanitizePage } from "@/lib/browse";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";

export const metadata = { title: "Programs" };

interface Props {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}

export default async function ProgramsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();

  const page = sanitizePage(params.page);
  const result = await fetchProgramsPage(supabase, { page, q: params.q, type: params.type });

  if (result.outOfRange) {
    redirect(pageHref("/programs", { q: params.q, type: params.type }, result.lastPage));
  }

  const filterParams = { q: params.q, type: params.type };

  return (
    <main className="min-h-screen noise-overlay">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 pt-8 pb-16">
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
          {result.rows.map((program) => (
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

        {result.rows.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            No programs found. Try a different search.
          </p>
        )}

        {result.count > 0 && (
          <Pagination
            basePath="/programs"
            page={result.page}
            lastPage={result.lastPage}
            params={filterParams}
            totalCount={result.count}
            pageSize={result.pageSize}
          />
        )}
      </div>
    </main>
  );
}
