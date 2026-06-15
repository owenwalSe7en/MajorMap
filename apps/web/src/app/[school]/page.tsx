import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { resolveSchool, SITE_URL } from "@/lib/school";

interface Props {
  params: Promise<{ school: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { school } = await params;
  const ref = resolveSchool(school);
  if (!ref) return { title: "School Not Found" };
  return {
    title: ref.name,
    alternates: { canonical: `${SITE_URL}/${ref.slug}` },
  };
}

export default async function SchoolPage({ params }: Props) {
  const { school } = await params;
  const ref = resolveSchool(school);
  if (!ref) notFound();

  return (
    <main className="min-h-screen noise-overlay">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 pt-8 pb-16">
        <div className="mb-12">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-4">
            <span className="w-8 h-px bg-foreground/30" />
            School
          </span>
          <h1 className="text-4xl lg:text-6xl font-display tracking-tight">{ref.name}</h1>
        </div>
        <div className="flex gap-3">
          <Button asChild>
            <Link href={`/${ref.slug}/programs`}>Browse programs</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/${ref.slug}/courses`}>Browse courses</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
