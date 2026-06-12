"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeOverlap } from "@major-map/planner";
import type { OverlapResult, ProgramRequirements } from "@major-map/planner";
import { ProgramSelector } from "./program-selector";
import { ComparisonView } from "./comparison-view";
import { WhatIfView } from "./what-if-view";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Program {
  id: string;
  name: string;
  degree_type: string;
  total_credits: number | null;
}

interface CourseInfo {
  id: string;
  code: string;
  title: string;
  credits: number;
}

type Tab = "compare" | "whatif";

export default function ComparePage() {
  const [programA, setProgramA] = useState<Program | null>(null);
  const [programB, setProgramB] = useState<Program | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("compare");
  const [loading, setLoading] = useState(false);
  const [overlap, setOverlap] = useState<OverlapResult | null>(null);
  const [courseMap, setCourseMap] = useState<Map<string, CourseInfo>>(new Map());
  const [programBReqs, setProgramBReqs] = useState<ProgramRequirements | null>(null);

  // What-if state
  const [userCourseIds, setUserCourseIds] = useState<Set<string>>(new Set());

  const fetchRequirements = useCallback(
    async (programId: string): Promise<{ courseIds: Set<string>; courses: CourseInfo[] }> => {
      const supabase = createClient();

      // Get active requirement set
      const { data: reqSet } = await supabase
        .from("requirement_sets")
        .select("id")
        .eq("program_id", programId)
        .eq("is_active", true)
        .single();

      if (!reqSet) return { courseIds: new Set(), courses: [] };

      // Get requirement items with course_id
      const { data: items } = await supabase
        .from("requirement_items")
        .select("course_id")
        .eq("requirement_set_id", reqSet.id)
        .not("course_id", "is", null);

      const courseIds = new Set((items ?? []).map((i) => i.course_id as string));

      // Fetch course details
      const ids = [...courseIds];
      if (ids.length === 0) return { courseIds, courses: [] };

      const { data: courses } = await supabase
        .from("courses")
        .select("id, code, title, credits")
        .in("id", ids);

      return { courseIds, courses: (courses ?? []) as CourseInfo[] };
    },
    [],
  );

  async function handleCompare() {
    if (!programA || !programB) return;
    setLoading(true);

    const [reqsA, reqsB] = await Promise.all([
      fetchRequirements(programA.id),
      fetchRequirements(programB.id),
    ]);

    const allCourses = new Map<string, CourseInfo>();
    for (const c of [...reqsA.courses, ...reqsB.courses]) {
      allCourses.set(c.id, c);
    }

    const creditMap = new Map([...allCourses].map(([id, c]) => [id, c.credits]));

    const progA: ProgramRequirements = {
      programId: programA.id,
      programName: programA.name,
      totalCredits: programA.total_credits ?? 0,
      courseIds: reqsA.courseIds,
    };
    const progB: ProgramRequirements = {
      programId: programB.id,
      programName: programB.name,
      totalCredits: programB.total_credits ?? 0,
      courseIds: reqsB.courseIds,
    };

    const result = computeOverlap(progA, progB, creditMap);

    setProgramBReqs(progB);
    setOverlap(result);
    setCourseMap(allCourses);
    setLoading(false);
  }

  // Fetch user's courses for what-if (once on mount)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("plan_courses")
        .select("course_id")
        .eq("user_id", user.id)
        .then(({ data }) => {
          if (data) setUserCourseIds(new Set(data.map((r) => r.course_id)));
        });
    });
  }, []);

  // Compute what-if data
  const whatIfData = programBReqs
    ? (() => {
        const matching = [...programBReqs.courseIds]
          .filter((id) => userCourseIds.has(id))
          .map((id) => courseMap.get(id))
          .filter((c): c is CourseInfo => !!c);
        const remaining = [...programBReqs.courseIds]
          .filter((id) => !userCourseIds.has(id))
          .map((id) => courseMap.get(id))
          .filter((c): c is CourseInfo => !!c);
        const notMatching = [...userCourseIds]
          .filter((id) => !programBReqs.courseIds.has(id))
          .map((id) => courseMap.get(id))
          .filter((c): c is CourseInfo => !!c);
        const toWhatIf = (c: CourseInfo) => ({
          courseId: c.id,
          code: c.code,
          title: c.title,
          credits: c.credits,
        });
        return {
          matching: matching.map(toWhatIf),
          remaining: remaining.map(toWhatIf),
          notMatching: notMatching.map(toWhatIf),
        };
      })()
    : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-display tracking-tight mb-6">Compare Programs</h1>

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <ProgramSelector
          label="Program A"
          selectedId={programA?.id ?? null}
          onSelect={setProgramA}
          excludeId={programB?.id ?? null}
        />
        <ProgramSelector
          label="Program B"
          selectedId={programB?.id ?? null}
          onSelect={setProgramB}
          excludeId={programA?.id ?? null}
        />
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Button onClick={handleCompare} disabled={!programA || !programB || loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Compare
        </Button>

        {overlap && (
          <div className="flex gap-1">
            <button
              className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                activeTab === "compare"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              }`}
              onClick={() => setActiveTab("compare")}
            >
              Side by Side
            </button>
            <button
              className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                activeTab === "whatif"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              }`}
              onClick={() => setActiveTab("whatif")}
            >
              What If?
            </button>
          </div>
        )}
      </div>

      {overlap && activeTab === "compare" && programA && programB && (
        <ComparisonView
          overlap={overlap}
          programAName={programA.name}
          programBName={programB.name}
          courseMap={courseMap}
        />
      )}

      {overlap && activeTab === "whatif" && programB && whatIfData && (
        <WhatIfView
          programName={programB.name}
          matching={whatIfData.matching}
          notMatching={whatIfData.notMatching}
          remaining={whatIfData.remaining}
          totalRequired={programBReqs?.totalCredits ?? 0}
        />
      )}

      {!overlap && !loading && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">
            Select two programs above and click Compare to see overlapping courses.
          </p>
        </div>
      )}
    </main>
  );
}
