import { notFound } from "next/navigation";
import { resolveSchool } from "@/lib/school";

// NOTE: do not add generateStaticParams here — every child page is
// request-dynamic via the Supabase cookie client, and static params would add
// a build-time data dependency for no caching benefit.
export default async function SchoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ school: string }>;
}) {
  const { school } = await params;
  if (!resolveSchool(school)) notFound();
  return <>{children}</>;
}
