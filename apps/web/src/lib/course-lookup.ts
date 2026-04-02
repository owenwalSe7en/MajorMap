import { createClient } from "@/lib/supabase/client";

export interface CourseDisplay {
  id: string;
  code: string;
  title: string;
  credits: number;
}

export async function fetchCoursesByIds(ids: string[]): Promise<Map<string, CourseDisplay>> {
  if (ids.length === 0) return new Map();

  const supabase = createClient();
  const { data } = await supabase
    .from("courses")
    .select("id, code, title, credits")
    .in("id", ids);

  const map = new Map<string, CourseDisplay>();
  for (const course of data ?? []) {
    map.set(course.id, course);
  }
  return map;
}
