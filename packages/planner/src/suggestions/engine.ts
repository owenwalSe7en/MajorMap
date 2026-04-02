import { prerequisiteCheck } from "../prerequisite-check.js";
import type { PrereqRule } from "../types.js";

// --- Types ---

export interface RequirementItem {
  id: string;
  courseId: string | null;
  label: string;
  parentId: string | null;
  parentLabel: string;
}

export interface CourseCatalogEntry {
  id: string;
  code: string;
  title: string;
  credits: number;
}

export interface SuggestedCourse {
  courseId: string;
  code: string;
  title: string;
  credits: number;
  reason: string;
  priority: number;
  category: string;
  unlockCount: number;
}

// --- Engine ---

const MAX_SUGGESTIONS = 20;

/**
 * Computes unlock count: how many remaining required courses
 * would become unblocked if this course were completed.
 */
function computeUnlockCounts(
  candidateIds: Set<string>,
  completedIds: Set<string>,
  prereqRules: PrereqRule[],
): Map<string, number> {
  const counts = new Map<string, number>();

  // For each candidate, check if it is a prerequisite for other remaining courses
  for (const candidateId of candidateIds) {
    // Simulate completing this candidate
    const simulatedCompleted = new Set(completedIds);
    simulatedCompleted.add(candidateId);

    let unlocked = 0;
    for (const otherId of candidateIds) {
      if (otherId === candidateId) continue;
      // Check if other course's prereqs would be met with this candidate completed
      const withoutResult = prerequisiteCheck(otherId, completedIds, prereqRules);
      const withResult = prerequisiteCheck(otherId, simulatedCompleted, prereqRules);
      if (!withoutResult.met && withResult.met) {
        unlocked++;
      }
    }
    counts.set(candidateId, unlocked);
  }

  return counts;
}

export function suggestCourses(
  planCourses: Array<{ courseId: string; status?: string }>,
  requirementItems: RequirementItem[],
  prereqRules: PrereqRule[],
  courseCatalog: CourseCatalogEntry[],
): SuggestedCourse[] {
  // Build sets for quick lookup
  const planCourseIds = new Set(planCourses.map((c) => c.courseId));
  const completedIds = new Set(
    planCourses.filter((c) => c.status === "completed").map((c) => c.courseId),
  );

  // Get required course IDs from leaf requirement items (non-null courseId)
  const requiredItems = requirementItems.filter(
    (ri) => ri.courseId !== null && !planCourseIds.has(ri.courseId),
  );

  if (requiredItems.length === 0) return [];

  // Build catalog lookup
  const catalogMap = new Map(courseCatalog.map((c) => [c.id, c]));

  // Filter to courses whose prereqs are met
  const candidateIds = new Set<string>();
  const candidateItems: Array<{ item: RequirementItem; catalog: CourseCatalogEntry }> = [];

  for (const item of requiredItems) {
    const courseId = item.courseId!;
    const catalog = catalogMap.get(courseId);
    if (!catalog) continue;

    const result = prerequisiteCheck(courseId, completedIds, prereqRules);
    if (result.met) {
      candidateIds.add(courseId);
      candidateItems.push({ item, catalog });
    }
  }

  if (candidateItems.length === 0) return [];

  // Compute unlock counts
  const remainingIds = new Set(requiredItems.map((ri) => ri.courseId!));
  const unlockCounts = computeUnlockCounts(remainingIds, completedIds, prereqRules);

  // Score and build suggestions
  const suggestions: SuggestedCourse[] = candidateItems.map(({ item, catalog }) => {
    const courseId = item.courseId!;
    const unlockCount = unlockCounts.get(courseId) ?? 0;
    const priority = 100 + unlockCount * 10;

    const reason = unlockCount > 0
      ? `Required — unlocks ${unlockCount} course${unlockCount > 1 ? "s" : ""}`
      : "Required for degree";

    return {
      courseId,
      code: catalog.code,
      title: catalog.title,
      credits: catalog.credits,
      reason,
      priority,
      category: item.parentLabel || "Requirements",
      unlockCount,
    };
  });

  // Sort by priority descending, then by code ascending for stability
  suggestions.sort((a, b) => b.priority - a.priority || a.code.localeCompare(b.code));

  return suggestions.slice(0, MAX_SUGGESTIONS);
}
