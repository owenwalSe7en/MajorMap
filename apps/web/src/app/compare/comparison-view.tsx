"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { OverlapResult } from "@major-map/planner";

interface ComparisonViewProps {
  overlap: OverlapResult;
  programAName: string;
  programBName: string;
  courseMap: Map<string, { code: string; title: string; credits: number }>;
}

export function ComparisonView({ overlap, programAName, programBName, courseMap }: ComparisonViewProps) {
  const getCourse = (id: string) => courseMap.get(id) ?? { code: id, title: "Unknown", credits: 0 };

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Shared:</span>{" "}
            <span className="font-medium text-green-600">{overlap.shared.length} courses ({overlap.sharedCredits} cr)</span>
          </div>
          <div>
            <span className="text-muted-foreground">Only {programAName}:</span>{" "}
            <span className="font-medium">{overlap.onlyA.length} courses</span>
          </div>
          <div>
            <span className="text-muted-foreground">Only {programBName}:</span>{" "}
            <span className="font-medium">{overlap.onlyB.length} courses</span>
          </div>
          <div>
            <span className="text-muted-foreground">Combined total:</span>{" "}
            <span className="font-medium">{overlap.combinedUniqueCredits} credits</span>
          </div>
        </div>
      </Card>

      {/* Side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Program A */}
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-medium">{programAName}</h3>
          <div className="space-y-1">
            {[...overlap.shared, ...overlap.onlyA].map((id) => {
              const course = getCourse(id);
              const isShared = overlap.shared.includes(id);
              return (
                <div
                  key={id}
                  className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                    isShared ? "bg-green-50 dark:bg-green-950/20" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground">{course.code}</span>
                    <span className="truncate">{course.title}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-muted-foreground">{course.credits}cr</span>
                    {isShared && <Badge variant="secondary" className="text-[9px] px-1">Shared</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Program B */}
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-medium">{programBName}</h3>
          <div className="space-y-1">
            {[...overlap.shared, ...overlap.onlyB].map((id) => {
              const course = getCourse(id);
              const isShared = overlap.shared.includes(id);
              return (
                <div
                  key={id}
                  className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                    isShared ? "bg-green-50 dark:bg-green-950/20" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground">{course.code}</span>
                    <span className="truncate">{course.title}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-muted-foreground">{course.credits}cr</span>
                    {isShared && <Badge variant="secondary" className="text-[9px] px-1">Shared</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
