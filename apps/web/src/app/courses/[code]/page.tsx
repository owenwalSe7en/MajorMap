import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { code } = await params;
  const [subjectCode, number] = code.split("-");
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("title, subject_code, number")
    .eq("subject_code", subjectCode)
    .eq("number", number)
    .single();
  if (!course) return { title: "Course Not Found" };
  return { title: `${course.subject_code} ${course.number} — ${course.title}` };
}

export default async function CourseDetailPage({ params }: Props) {
  const { code } = await params;
  const [subjectCode, number] = code.split("-");
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("subject_code", subjectCode)
    .eq("number", number)
    .single();

  if (!course) notFound();

  const { data: prereqs } = await supabase
    .from("course_prerequisites")
    .select(
      "prerequisite_course_id, group_operator, condition, min_grade, is_corequisite, description_override",
    )
    .eq("course_id", course.id);

  let prereqCourses: { id: string; subject_code: string; number: string; title: string }[] = [];
  if (prereqs && prereqs.length > 0) {
    const prereqIds = prereqs
      .map((p) => p.prerequisite_course_id)
      .filter((id): id is string => id !== null);
    if (prereqIds.length > 0) {
      const { data } = await supabase
        .from("courses")
        .select("id, subject_code, number, title")
        .in("id", prereqIds);
      prereqCourses = data ?? [];
    }
  }

  const credits =
    course.credits_min === course.credits_max
      ? `${course.credits_min}`
      : `${course.credits_min}–${course.credits_max}`;

  return (
    <main className="min-h-screen noise-overlay">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 pt-8 pb-16">
        <div className="mb-8">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-4">
            <span className="w-8 h-px bg-foreground/30" />
            Course Detail
          </span>
          <h1 className="text-4xl lg:text-6xl font-display tracking-tight mb-2">
            {course.subject_code} {course.number}
          </h1>
          <p className="text-xl text-muted-foreground mb-4">{course.title}</p>
          <div className="flex items-center gap-2">
            <Badge>{credits} credits</Badge>
            {course.typically_offered?.map((term: string) => (
              <Badge key={term} variant="outline">
                {term}
              </Badge>
            ))}
          </div>
        </div>

        {course.description && (
          <div className="border border-foreground/10 rounded-xl p-6 mb-8 max-w-3xl">
            <h2 className="text-lg font-semibold mb-3">Description</h2>
            <p className="text-muted-foreground leading-relaxed">{course.description}</p>
          </div>
        )}

        {prereqs && prereqs.length > 0 && (
          <div className="border border-foreground/10 rounded-xl p-6 max-w-3xl">
            <h2 className="text-lg font-semibold mb-3">Prerequisites</h2>
            <ul className="space-y-2">
              {prereqCourses.map((pc) => (
                <li key={pc.id}>
                  <Link
                    href={`/courses/${pc.subject_code}-${pc.number}`}
                    className="text-primary hover:underline font-mono text-sm"
                  >
                    {pc.subject_code} {pc.number}
                  </Link>
                  <span className="text-muted-foreground ml-2">— {pc.title}</span>
                </li>
              ))}
              {prereqs
                .filter((p) => p.description_override)
                .map((p, i) => (
                  <li key={`override-${i}`} className="text-muted-foreground text-sm">
                    {p.description_override}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
