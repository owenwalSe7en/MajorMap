import type { MajorId } from "@major-map/shared";

export function helloPlanner(id: MajorId): string {
  return `planner:${id}`;
}
