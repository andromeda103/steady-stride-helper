import { Target, ArrowRight, ListChecks, Dumbbell, BookOpen, Sparkles, CloudRain } from "lucide-react";
import { Card } from "@/components/primitives";
import {
  useStore,
  pendingTasks,
  isDoneToday,
  type Task,
} from "@/lib/store";
import { isHabitDoneOn } from "@/lib/habits";
import { todayKey } from "@/lib/dates";
import { missionInfo } from "@/lib/mission";

interface Priority {
  icon: typeof Target;
  label: string;
  done: boolean;
}

/**
 * "Prioridades de Hoje" — direct, scannable summary of what matters today:
 * 1. Missão principal  2. Próxima ação  3. Até 3 prioridades essenciais.
 * In "dia ruim" mode it collapses to a single minimal-viable next action.
 */
export function TodayPriorities() {
  const tasks = useStore((s) => s.tasks);
  const habits = useStore((s) => s.habits);
  const weekly = useStore((s) => s.weekly);
  const workoutLog = useStore((s) => s.workoutLog);
  const badDay = useStore((s) => s.badDay);

  const today = todayKey();
  const pend = pendingTasks(tasks, !!badDay);
  const nextAction: Task | undefined = pend[0];

  const workoutDone = workoutLog.includes(today);
  const essentialHabits = habits.filter((h) => h.essential ?? false);
  const habitsPool = essentialHabits.length > 0 ? essentialHabits : habits;
  const habitsDone = habitsPool.filter((h) => isHabitDoneOn(h)).length;
  const habitsTotal = habitsPool.length;

  // -------- Dia ruim: mínimo viável --------
  if (badDay) {
    return (
      <Card className="border-warning/40" style={{ borderColor: "color-mix(in oklab, var(--warning) 45%, transparent)", background: "color-mix(in oklab, var(--warning) 8%, transparent)" }}>
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--warning)" }}>
          <CloudRain className="h-4 w-4" /> Dia ruim · mínimo viável
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Hoje é mínimo viável. Faça só o básico para não abandonar.
        </p>
        <div className="mt-3 rounded-xl bg-secondary p-3">
          <p className="text-xs text-muted-foreground">Sua única próxima ação</p>
          <p className="mt-0.5 text-lg font-bold leading-tight">
            {nextAction ? nextAction.name : "Beber água e respirar 💧"}
          </p>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <li>• Escovar os dentes</li>
          <li>• Tomar creatina</li>
          <li>• Beber água</li>
          <li>• Estudar 30 minutos</li>
        </ul>
      </Card>
    );
  }

  // -------- Dia normal --------
  const priorities: Priority[] = [];
  if (weekly) {
    const info = missionInfo(weekly);
    priorities.push({ icon: Target, label: `${weekly.label} (${info.pct}%)`, done: info.done });
  }
  if (habitsTotal > 0) {
    priorities.push({
      icon: ListChecks,
      label: `Cumprir hábitos essenciais (${habitsDone}/${habitsTotal})`,
      done: habitsDone >= habitsTotal,
    });
  }
  priorities.push({ icon: Dumbbell, label: "Treinar", done: workoutDone });
  const top3 = priorities.slice(0, 3);

  return (
    <Card>
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
        <Sparkles className="h-4 w-4" /> Prioridades de hoje
      </div>

      {/* Missão principal */}
      {weekly && (
        <div className="mt-3 flex items-start gap-2">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Missão principal</p>
            <p className="truncate text-sm font-bold">{weekly.label}</p>
          </div>
        </div>
      )}

      {/* Próxima ação */}
      <div className="mt-3 flex items-start gap-2">
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Próxima ação</p>
          <p className="truncate text-sm font-bold">
            {nextAction ? nextAction.name : "Tudo feito por agora ✨"}
          </p>
        </div>
      </div>

      {/* 3 prioridades */}
      {top3.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs text-muted-foreground">Prioridades</p>
          {top3.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg bg-secondary px-2.5 py-2"
                style={p.done ? { opacity: 0.6 } : undefined}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: p.done ? "var(--primary)" : "var(--muted-foreground)" }} />
                <span className={`min-w-0 flex-1 truncate text-sm ${p.done ? "line-through" : "font-medium"}`}>{p.label}</span>
                {p.done && <span className="shrink-0 text-xs font-bold text-primary">✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
