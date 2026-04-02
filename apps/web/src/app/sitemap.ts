import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const { data: programs } = await supabase
    .from("programs")
    .select("slug, updated_at")
    .order("name");

  const programEntries: MetadataRoute.Sitemap = (programs ?? []).map((p) => ({
    url: `https://majormap.app/programs/${p.slug}`,
    lastModified: p.updated_at,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    {
      url: "https://majormap.app",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://majormap.app/programs",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://majormap.app/courses",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://majormap.app/compare",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...programEntries,
  ];
}
