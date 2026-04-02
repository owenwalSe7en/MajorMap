import type { CreditSummary } from "@major-map/planner";

interface CreditSidebarProps {
  credits: CreditSummary | null;
  totalPlanned: number;
  secondaryCredits?: CreditSummary | null;
  secondaryProgramName?: string;
}

function ProgressBar({ credits, label }: { credits: CreditSummary; label?: string }) {
  const total = credits.planned + credits.completed;
  const pct = credits.totalRequired > 0
    ? Math.min(100, Math.round((total / credits.totalRequired) * 100))
    : 0;
  const completedPct = credits.totalRequired > 0
    ? Math.min(100, Math.round((credits.completed / credits.totalRequired) * 100))
    : 0;

  return (
    <div className="space-y-2">
      {label && <h4 className="text-xs font-medium text-muted-foreground">{label}</h4>}
      <div className="space-y-1.5">
        {credits.completed > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Completed</span>
            <span className="font-medium text-green-600">{credits.completed}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Planned</span>
          <span className="font-medium">{credits.planned}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Remaining</span>
          <span className="font-medium">{credits.remaining}</span>
        </div>
        <div className="flex justify-between text-sm border-t pt-1.5">
          <span className="text-muted-foreground">Required</span>
          <span className="font-medium">{credits.totalRequired}</span>
        </div>
      </div>
      <div className="space-y-1">
        <div className="h-2 rounded-full bg-muted overflow-hidden flex">
          {credits.completed > 0 && (
            <div className="h-full bg-green-500 transition-all" style={{ width: `${completedPct}%` }} />
          )}
          <div className="h-full bg-primary transition-all" style={{ width: `${pct - completedPct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground text-center">{pct}%</p>
      </div>
    </div>
  );
}

export function CreditSidebar({ credits, totalPlanned, secondaryCredits, secondaryProgramName }: CreditSidebarProps) {
  if (credits) {
    return (
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <h3 className="text-sm font-medium">Credit Summary</h3>
        <ProgressBar credits={credits} label={secondaryCredits ? "Primary" : undefined} />
        {secondaryCredits && secondaryProgramName && (
          <>
            <div className="border-t" />
            <ProgressBar credits={secondaryCredits} label={secondaryProgramName} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <h3 className="text-sm font-medium">Credits</h3>
      <p className="text-2xl font-medium">{totalPlanned}</p>
      <p className="text-xs text-muted-foreground">credits planned</p>
    </div>
  );
}
