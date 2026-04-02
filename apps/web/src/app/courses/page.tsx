import { createClient } from "@/lib/supabase/server";
import { Navigation } from "@/components/landing/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Courses" };

interface Props {
  searchParams: Promise<{ q?: string; dept?: string }>;
}

export default async function CoursesPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("courses")
    .select("id, subject_code, number, title, credits_min, credits_max")
    .order("subject_code")
    .order("number");

  if (params.q) {
    const sanitized = params.q.slice(0, 100).replace(/[%_]/g, "");
    query = query.ilike("title", `%${sanitized}%`);
  }
  if (params.dept) {
    const dept = params.dept
      .slice(0, 6)
      .toUpperCase()
      .replace(/[^A-Z ]/g, "");
    query = query.eq("subject_code", dept);
  }

  const { data: courses } = await query.limit(50);

  return (
    <main className="min-h-screen noise-overlay">
      <Navigation />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 pt-32 pb-16">
        <div className="mb-12">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-4">
            <span className="w-8 h-px bg-foreground/30" />
            Search
          </span>
          <h1 className="text-4xl lg:text-6xl font-display tracking-tight">Courses</h1>
        </div>

        <form method="get" className="flex gap-3 mb-12">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              name="q"
              placeholder="Search by title..."
              defaultValue={params.q ?? ""}
              className="pl-10 h-12 rounded-full border-foreground/10"
            />
          </div>
          <Input
            name="dept"
            placeholder="Subject (e.g. CS)"
            defaultValue={params.dept ?? ""}
            className="w-36 h-12 rounded-full border-foreground/10"
          />
          <Button type="submit" className="h-12 px-6 rounded-full">
            Search
          </Button>
        </form>

        <div className="border border-foreground/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-foreground/10 bg-muted/50">
                <th className="text-left px-6 py-3 text-sm font-mono text-muted-foreground">
                  Code
                </th>
                <th className="text-left px-6 py-3 text-sm font-mono text-muted-foreground">
                  Title
                </th>
                <th className="text-right px-6 py-3 text-sm font-mono text-muted-foreground">
                  Credits
                </th>
              </tr>
            </thead>
            <tbody>
              {courses?.map((course) => (
                <tr
                  key={course.id}
                  className="border-b border-foreground/5 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-6 py-3">
                    <Link
                      href={`/courses/${course.subject_code}-${course.number}`}
                      className="font-mono text-sm text-primary hover:underline"
                    >
                      {course.subject_code} {course.number}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-sm">{course.title}</td>
                  <td className="px-6 py-3 text-sm text-right text-muted-foreground">
                    {course.credits_min === course.credits_max
                      ? course.credits_min
                      : `${course.credits_min}–${course.credits_max}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(!courses || courses.length === 0) && (
          <p className="text-center text-muted-foreground py-12">
            No courses found. Try a different search.
          </p>
        )}
      </div>
    </main>
  );
}
