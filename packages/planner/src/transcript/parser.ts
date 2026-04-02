// --- Grade types ---

const PASSING_GRADES = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "CR", "P", "S"] as const;
const FAILING_GRADES = ["W", "I", "E", "NC", "NP", "U"] as const;

export const ALL_GRADES = [...PASSING_GRADES, ...FAILING_GRADES] as const;
export type Grade = (typeof ALL_GRADES)[number];

export const PASSING_GRADE_SET = new Set<string>(PASSING_GRADES);

const GRADE_SET = new Set<string>(ALL_GRADES);

/** Higher number = better grade. Used to pick best attempt for repeated courses. */
export const GRADE_RANK: Record<string, number> = {
  A: 20, "A-": 19,
  "B+": 18, B: 17, "B-": 16,
  "C+": 15, C: 14, "C-": 13,
  "D+": 12, D: 11, "D-": 10,
  CR: 9, P: 8, S: 7,
  E: 6,
  NC: 5, NP: 4, U: 3,
  I: 2,
  W: 1,
};

// --- Types ---

export interface TranscriptCourse {
  subjectCode: string;
  number: string;
  title?: string;
  credits: number;
  grade: Grade;
}

export interface ParseResult {
  courses: TranscriptCourse[];
  totalCredits: number;
  skippedLines: number;
}

// --- Parsing ---

const MAX_LINE_LENGTH = 500;
const SUBJECT_CODE = /^[A-Z]{2,5}$/;
const COURSE_NUMBER = /^\d{4}[A-Z]?$/;
const CREDITS_PATTERN = /^\d+\.\d{2}$/;

function parseLine(line: string): TranscriptCourse | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > MAX_LINE_LENGTH) return null;

  // Split on 2+ whitespace (tabs or spaces). This avoids backtracking ReDoS.
  const fields = trimmed.split(/\s{2,}/);

  // Minimum: subject, number, credits, grade (4 fields)
  // With title: subject, number, title, credits, grade (5+ fields)
  if (fields.length < 4) return null;

  // Last field should be a grade
  const gradeStr = fields[fields.length - 1];
  if (!GRADE_SET.has(gradeStr)) return null;

  // Second-to-last field should be credits
  const creditsStr = fields[fields.length - 2];
  if (!CREDITS_PATTERN.test(creditsStr)) return null;
  const credits = parseFloat(creditsStr);
  if (credits > 12) return null;

  // Round to nearest 0.5
  const roundedCredits = Math.round(credits * 2) / 2;

  // First field: subject code, second field: course number
  if (!SUBJECT_CODE.test(fields[0]) || !COURSE_NUMBER.test(fields[1])) return null;

  // Title is everything between the number and credits
  const titleFields = fields.slice(2, fields.length - 2);
  const title = titleFields.length > 0 ? titleFields.join(" ") : undefined;

  return {
    subjectCode: fields[0],
    number: fields[1],
    title: title || undefined,
    credits: roundedCredits,
    grade: gradeStr as Grade,
  };
}

export function parseTranscript(text: string): ParseResult {
  if (!text.trim()) return { courses: [], totalCredits: 0, skippedLines: 0 };

  const lines = text.split("\n");
  const parsed: TranscriptCourse[] = [];
  let skippedLines = 0;

  for (const line of lines) {
    if (!line.trim()) continue; // Skip blank lines without counting as skipped

    const course = parseLine(line);
    if (course) {
      parsed.push(course);
    } else {
      skippedLines++;
    }
  }

  // Deduplicate: keep highest grade for repeated courses
  const best = new Map<string, TranscriptCourse>();
  for (const course of parsed) {
    const key = `${course.subjectCode} ${course.number}`;
    const existing = best.get(key);
    if (!existing || (GRADE_RANK[course.grade] ?? 0) > (GRADE_RANK[existing.grade] ?? 0)) {
      best.set(key, course);
    }
  }

  const courses = [...best.values()];
  const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);

  return { courses, totalCredits, skippedLines };
}
