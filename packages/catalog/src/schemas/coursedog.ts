import { z } from "zod";

// Coursedog API response schemas — validate external API shape exactly.
// These use .passthrough() to allow extra fields without breaking validation.

export const CoursedogCreditsSchema = z.object({
  numberOfCredits: z.number(),
  creditHours: z.object({ min: z.number(), max: z.number() }),
  repeatable: z.boolean(),
});

export const CoursedogCourseSchema = z
  .object({
    _id: z.string().min(1),
    code: z.string().min(1),
    subjectCode: z.string().min(1),
    courseNumber: z.string().min(1),
    name: z.string().min(1),
    longName: z.string().optional(),
    description: z.string().default(""),
    credits: CoursedogCreditsSchema,
    departments: z.array(z.string()),
    college: z.string().default(""),
    career: z.string().default(""),
    institutionId: z.string(),
    courseGroupId: z.string(),
    requisites: z.record(z.unknown()).default({}),
  })
  .passthrough();

export const CoursedogProgramSchema = z
  .object({
    _id: z.string().min(1),
    code: z.string().min(1),
    catalogDisplayName: z.string().min(1),
    catalogDescription: z.string().default(""),
    catalogFullDescription: z.string().default(""),
    college: z.string().default(""),
    departments: z.array(z.string()).default([]),
    level: z.string().default(""),
    type: z.string().default(""),
    programLengthValue: z.number().nullable().default(null),
    requisites: z.record(z.unknown()).default({}),
    degreeMaps: z.array(z.unknown()).default([]),
  })
  .passthrough();

export const CoursedogPageSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    listLength: z.number(),
    data: z.array(itemSchema),
  });

export type CoursedogCourse = z.infer<typeof CoursedogCourseSchema>;
export type CoursedogProgram = z.infer<typeof CoursedogProgramSchema>;
