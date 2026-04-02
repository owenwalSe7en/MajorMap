import { v5 as uuidv5 } from "uuid";

// Custom namespace for MajorMap deterministic UUIDs.
// Generated once via uuidv4(), hardcoded forever.
const MAJORMAP_NS = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

export function courseUuid(universitySlug: string, subjectCode: string, number: string): string {
  return uuidv5(`course:${universitySlug}:${subjectCode}:${number}`, MAJORMAP_NS);
}

export function programUuid(universitySlug: string, programSlug: string): string {
  return uuidv5(`program:${universitySlug}:${programSlug}`, MAJORMAP_NS);
}

export function departmentUuid(universitySlug: string, code: string): string {
  return uuidv5(`department:${universitySlug}:${code}`, MAJORMAP_NS);
}

export function universityUuid(slug: string): string {
  return uuidv5(`university:${slug}`, MAJORMAP_NS);
}
