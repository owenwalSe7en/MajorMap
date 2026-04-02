"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";

interface WhatIfCourse {
  courseId: string;
  code: string;
  title: string;
  credits: number;
}

interface WhatIfViewProps {
  programName: string;
  matching: WhatIfCourse[];
  notMatching: WhatIfCourse[];
  remaining: WhatIfCourse[];
  totalRequired: number;
}

export function WhatIfView({ programName, matching, notMatching, remaining, totalRequired }: WhatIfViewProps) {
  const matchingCredits = matching.reduce((s, c) => s + c.credits, 0);
  const remainingCredits = remaining.reduce((s, c) => s + c.credits, 0);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-2">What if you pursued {programName}?</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Courses that apply:</span>{" "}
            <span className="font-medium text-green-600">{matching.length} ({matchingCredits} cr)</span>
          </div>
          <div>
            <span className="text-muted-foreground">Still needed:</span>{" "}
            <span className="font-medium text-amber-600">{remaining.length} ({remainingCredits} cr)</span>
          </div>
          {totalRequired > 0 && (
            <div>
              <span className="text-muted-foreground">Progress:</span>{" "}
              <span className="font-medium">
                {Math.round((matchingCredits / totalRequired) * 100)}%
              </span>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Matching courses */}
        <Card className="p-4 space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Courses that apply ({matching.length})
          </h4>
          <div className="space-y-1">
            {matching.map((course) => (
              <div key={course.courseId} className="flex items-center justify-between rounded bg-green-50 dark:bg-green-950/20 px-2 py-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{course.code}</span>
                  <span className="truncate">{course.title}</span>
                </div>
                <span className="text-muted-foreground shrink-0">{course.credits}cr</span>
              </div>
            ))}
            {matching.length === 0 && (
              <p className="text-xs text-muted-foreground">None of your courses apply to this program.</p>
            )}
          </div>
        </Card>

        {/* Remaining requirements */}
        <Card className="p-4 space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-amber-500" />
            Still needed ({remaining.length})
          </h4>
          <div className="space-y-1">
            {remaining.map((course) => (
              <div key={course.courseId} className="flex items-center justify-between rounded px-2 py-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{course.code}</span>
                  <span className="truncate">{course.title}</span>
                </div>
                <span className="text-muted-foreground shrink-0">{course.credits}cr</span>
              </div>
            ))}
            {remaining.length === 0 && (
              <p className="text-xs text-muted-foreground">You have all required courses!</p>
            )}
          </div>
        </Card>
      </div>

      {notMatching.length > 0 && (
        <Card className="p-4 space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground">
            Your courses that don&apos;t count toward {programName} ({notMatching.length})
          </h4>
          <div className="flex flex-wrap gap-1">
            {notMatching.map((course) => (
              <Badge key={course.courseId} variant="outline" className="text-[10px]">
                {course.code}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
