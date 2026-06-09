import { Target, CalendarClock, Hourglass } from "lucide-react";
import { Card, Bar } from "@/components/primitives";
import { useStore } from "@/lib/store";
import { missionInfo } from "@/lib/mission";

/**
 * Reusable "Missão Principal" card shown on Home, stats and calendar areas.
 * Displays progress, percentage, deadline (prazo) and days remaining.
 */
export function MainMission({ className = "" }: { className?: string }) {
  const weekly = useStore((s) => s.weekly);
  if (!weekly) return null;
  const info = missionInfo(weekly);

  const daysColor = info.done
    ? "var(--primary)"
    : info.overdue
    ? "var(--danger)"
    : info.daysLeft <= 1
    ? "var(--warning)"
    : "var(--foreground)";

  return (
    <Card className={`relative overflow-hidden border-primary/40 bg-primary/5 ${className}`}>
      <div className="absolute left-0 top-0 h-full w-1.5 bg-primary" />
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
        <Target className="h-4 w-4" /> Missão Principal
      </div>
      <p className="mt-1 text-xl font-bold leading-tight">{weekly.label}</p>

      <div className="mt-3">
        <Bar pct={info.pct} />
        <div className="mt-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {weekly.current} / {weekly.target} {weekly.unit}
          </span>
          <span className="font-bold text-primary">{info.pct}%</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-2 text-xs">
          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Prazo</span>
          <span className="ml-auto font-semibold capitalize">{info.deadlineLabel}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-2 text-xs">
          <Hourglass className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Restam</span>
          <span className="ml-auto font-semibold" style={{ color: daysColor }}>
            {info.daysLeftLabel}
          </span>
        </div>
      </div>
    </Card>
  );
}
