import type { MetadataRoute } from "next";
import { SCHOOLS } from "@major-map/shared";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/school";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/compare`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  for (const school of SCHOOLS) {
    entries.push(
      {
        url: `${SITE_URL}/${school.slug}/programs`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.9,
      },
      {
        url: `${SITE_URL}/${school.slug}/courses`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      },
    );

    const { data: programs } = await supabase
      .from("programs")
      .select("slug, updated_at")
      .eq("university_id", school.universityId)
      .eq("is_discontinued", false)
      .order("name");

    for (const p of programs ?? []) {
      entries.push({
        url: `${SITE_URL}/${school.slug}/programs/${p.slug}`,
        lastModified: p.updated_at,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  }

  return entries;
}
