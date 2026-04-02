import type { CoursedogProgram } from "../schemas/coursedog.js";
import { programUuid } from "../uuid.js";

export interface NormalizedProgram {
  id: string;
  university_id: string;
  slug: string;
  name: string;
  degree_type: string;
  description: string;
  total_credits: number | null;
  source_url: string | null;
  raw_data: Record<string, unknown>;
}

function slugify(code: string, name: string, degreeType: string): string {
  const base = name || code;
  const suffix = degreeType ? `-${degreeType.toLowerCase()}` : "";
  return (
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + suffix
  );
}

export function normalizeProgram(
  raw: CoursedogProgram,
  universitySlug: string,
  universityId: string,
): NormalizedProgram {
  const name = raw.catalogDisplayName || raw.code;
  const degreeType = raw.catalogDescription || raw.level || raw.type || "Unknown";
  const slug = slugify(raw.code, name, degreeType);

  return {
    id: programUuid(universitySlug, slug),
    university_id: universityId,
    slug,
    name,
    degree_type: degreeType,
    description: raw.catalogFullDescription || "",
    total_credits: raw.programLengthValue,
    source_url: null,
    raw_data: raw as unknown as Record<string, unknown>,
  };
}
