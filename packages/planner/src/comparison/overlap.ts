export interface ProgramRequirements {
  programId: string;
  programName: string;
  totalCredits: number;
  courseIds: Set<string>;
}

export interface OverlapResult {
  shared: string[];
  onlyA: string[];
  onlyB: string[];
  sharedCredits: number;
  combinedUniqueCredits: number;
}

export function computeOverlap(
  programA: ProgramRequirements,
  programB: ProgramRequirements,
  courseCreditMap: Map<string, number>,
): OverlapResult {
  const shared: string[] = [];
  const onlyA: string[] = [];
  const onlyB: string[] = [];

  for (const id of programA.courseIds) {
    if (programB.courseIds.has(id)) {
      shared.push(id);
    } else {
      onlyA.push(id);
    }
  }

  for (const id of programB.courseIds) {
    if (!programA.courseIds.has(id)) {
      onlyB.push(id);
    }
  }

  const sumCredits = (ids: string[]) =>
    ids.reduce((sum, id) => sum + (courseCreditMap.get(id) ?? 0), 0);

  const sharedCredits = sumCredits(shared);
  const combinedUniqueCredits = sharedCredits + sumCredits(onlyA) + sumCredits(onlyB);

  return { shared, onlyA, onlyB, sharedCredits, combinedUniqueCredits };
}
