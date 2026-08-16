import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import type { Issue } from "@/lib/tenders";

/**
 * What stands between this bid and a compliant submission.
 *
 * Blockers are things that get a bid thrown out before evaluation; warnings
 * cost points or are about to become blockers. Shown at the top of the tender
 * page because a bid with blockers should not be packed, let alone delivered.
 */
export function ReadinessPanel({ issues }: { issues: Issue[] }) {
  const blockers = issues.filter((i) => i.severity === "blocker");
  const warnings = issues.filter((i) => i.severity === "warning");

  if (!issues.length) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-600/30 bg-emerald-600/10 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="font-semibold">Ready to submit</p>
          <p className="text-sm text-muted-foreground">
            Every required document is attached and signed, certificates are
            valid at the closing date, and no compulsory briefing is outstanding.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {blockers.length ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <p className="mb-2 flex items-center gap-2 font-semibold text-destructive">
            <XCircle className="h-5 w-5" />
            {blockers.length} {blockers.length === 1 ? "blocker" : "blockers"} —
            this bid would be disqualified
          </p>
          <ul className="ml-7 list-disc space-y-1 text-sm">
            {blockers.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="mb-2 flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            {warnings.length} to check
          </p>
          <ul className="ml-7 list-disc space-y-1 text-sm">
            {warnings.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
