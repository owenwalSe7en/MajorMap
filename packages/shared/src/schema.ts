import { z } from "zod";

export const MajorSchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceUrl: z.string().url().optional()
});

export type Major = z.infer<typeof MajorSchema>;

export const CourseSchema = z.object({
  code: z.string(),
  title: z.string(),
  credits: z.number().multipleOf(0.5),
  url: z.string().url().optional()
});

export type Course = z.infer<typeof CourseSchema>;

export const RequirementSetSchema = z.object({
  id: z.string().uuid(),
  majorId: z.string(),
  versionLabel: z.string(),
  capturedAt: z.string().datetime(),
  sourceUrls: z.array(z.string().url()),
  data: z.object({}).catchall(z.unknown())
});

export type RequirementSet = z.infer<typeof RequirementSetSchema>;

export const EvaluationStateSchema = z.object({
  completed: z.record(z.string(), z.boolean()),
  notes: z.record(z.string(), z.string()).optional()
});

export type EvaluationState = z.infer<typeof EvaluationStateSchema>;

export const EvaluationSchema = z.object({
  id: z.string().uuid(),
  majorId: z.string(),
  requirementSetId: z.string().uuid(),
  state: EvaluationStateSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type Evaluation = z.infer<typeof EvaluationSchema>;

export function parseMajor(input: unknown): Major {
  return MajorSchema.parse(input);
}

export function parseCourse(input: unknown): Course {
  return CourseSchema.parse(input);
}

export function parseRequirementSet(input: unknown): RequirementSet {
  return RequirementSetSchema.parse(input);
}

export function parseEvaluation(input: unknown): Evaluation {
  return EvaluationSchema.parse(input);
}
