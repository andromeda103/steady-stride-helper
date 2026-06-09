import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Zap, CloudRain, Coffee, ArrowRight, Flame } from "lucide-react";
import { toast } from "sonner";
import {
  useStore,
  pendingTasks,
  levelInfo,
  isDoneToday,
  CATEGORY_VAR,
  type Task,
} from "@/lib/store";
import { ProgressRing } from "@/components/ProgressRing";
import { MainMission } from "@/components/MainMission";
import { Card, SectionLabel } from "@/components/primitives";
import { formatClock } from "@/lib/dates";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LevelUp — O que fazer agora" },
      { name: "description", content: "Veja imediatamente a próxima coisa importante a fazer." },
    ],
  }),
  component: Home,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function Home() {
  const tasks = useStore((s) => s.tasks);
  const habits = useStore((s) => s.habits);
  const xp = useStore((s) => s.xp);
  const badDay = useStore((s) => s.badDay);
  const focus = useStore((s) => s.focus);
  
  const toggleTask = useStore((s) => s.toggleTask);
  const toggleHabit = useStore((s) => s.toggleHabit);
  const setBadDay = useStore((s) => s.setBadDay);
  const startFocus = useStore((s) => s.startFocus);
  const clearFocus = useStore((s) => s.clearFocus);

  const lvl = levelInfo(xp);
  const pend = useMemo(() => pendingTasks(tasks, !!badDay), [tasks, badDay]);
  const done = tasks.filter((t) => isDoneToday(t.lastDone)).length;
  const total = tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // focus timer ticking
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!focus) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [focus]);

  const focusTask = focus ? tasks.find((t) => t.id === focus.taskId) : undefined;
  const focusLeft = focus ? Math.max(0, Math.round((focus.endsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (focus && focusLeft === 0) {
      toast("Tempo! Você conseguiu começar 💪", { description: "Marque como concluída se terminou." });
    }
  }, [focus, focusLeft]);

  const next: Task | undefined = focusTask ?? pend[0];

  function handleNoBrain() {
    const simple = pendingTasks(tasks, false).filter((t) => t.priority !== "Alta");
    const pick = simple[0] ?? pendingTasks(tasks, false)[0];
    if (!pick) {
      toast("Tudo feito por agora ✨");
      return;
    }
    startFocus(pick.id, 5);
    toast("Só faça isso por 5 minutos.", { description: pick.name });
  }

  return (
    <main className="px-4 pt-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{greeting()}</p>
          <h1 className="text-2xl font-bold">Próxima ação</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
          <Flame className="h-4 w-4 text-primary" />
          <div className="text-right leading-none">
            <div className="text-sm font-bold">Nível {lvl.level}</div>
            <div className="mt-1 h-1 w-14 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${lvl.pct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Missão Principal — prioridade máxima */}
      <MainMission className="mb-4" />


      {/* Focus mode banner */}
      {focus && focusTask && (
        <Card className="mb-4 border-primary/40 bg-primary/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Modo foco · 5 min</p>
              <p className="mt-1 text-lg font-bold">{focusTask.name}</p>
              <p className="text-sm text-muted-foreground">Só faça isso por 5 minutos.</p>
            </div>
            <div className="font-display text-3xl font-bold tabular-nums">{formatClock(focusLeft)}</div>
          </div>
          <button
            onClick={clearFocus}
            className="mt-3 w-full rounded-xl border border-border py-2 text-sm font-medium text-muted-foreground"
          >
            Sair do modo foco
          </button>
        </Card>
      )}

      {/* Próxima ação hero */}
      {next ? (
        <Card className="relative overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full w-1.5"
            style={{ background: CATEGORY_VAR[next.category] }}
          />
          <p className="text-xs font-medium text-muted-foreground">
            {next.time ? `às ${next.time}` : "a qualquer hora"} · {next.category}
            {next.priority === "Alta" && " · Prioridade alta"}
          </p>
          <p className="mt-1 text-2xl font-bold leading-tight">{next.name}</p>
          <button
            onClick={() => {
              toggleTask(next.id);
              if (focus) clearFocus();
              toast("Feito! +10 XP 🔥");
            }}
            className="no-tap mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-primary-foreground active:scale-[0.99]"
          >
            <Check className="h-5 w-5" strokeWidth={3} />
            Concluir agora
          </button>
        </Card>
      ) : (
        <Card className="text-center">
          <p className="text-lg font-bold">Tudo concluído 🎉</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {badDay ? "Modo dia ruim ativo — só o essencial." : "Sem tarefas pendentes agora."}
          </p>
        </Card>
      )}

      {/* Mode buttons */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          onClick={handleNoBrain}
          className="no-tap flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold active:scale-[0.99]"
        >
          <Coffee className="h-4 w-4 text-primary" />
          Não quero nada
        </button>
        <button
          onClick={() => {
            setBadDay(!badDay);
            toast(badDay ? "Modo normal" : "Modo dia ruim ativado", {
              description: badDay ? undefined : "Mantendo só o essencial.",
            });
          }}
          className="no-tap flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold active:scale-[0.99]"
          style={
            badDay
              ? { borderColor: "var(--warning)", background: "color-mix(in oklab, var(--warning) 14%, transparent)" }
              : { borderColor: "var(--border)", background: "var(--card)" }
          }
        >
          <CloudRain className="h-4 w-4" style={{ color: "var(--warning)" }} />
          {badDay ? "Dia ruim ativo" : "Dia ruim"}
        </button>
      </div>





      {/* Painel do dia */}
      <SectionLabel>Painel do dia</SectionLabel>
      <Card className="flex items-center gap-4">
        <ProgressRing pct={pct} size={92} stroke={9}>
          <span className="text-xl font-bold">{pct}%</span>
        </ProgressRing>
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Concluídas</span>
            <span className="font-bold text-primary">{done}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Faltam</span>
            <span className="font-bold">{Math.max(0, total - done)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total do dia</span>
            <span className="font-bold">{total}</span>
          </div>
        </div>
      </Card>

      {/* Próximas tarefas */}
      {pend.length > 1 && (
        <>
          <SectionLabel>Próximas tarefas</SectionLabel>
          <div className="space-y-2">
            {pend.slice(1, 5).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  toggleTask(t.id);
                  toast("Feito! +10 XP");
                }}
                className="no-tap flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left active:scale-[0.99]"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `color-mix(in oklab, ${CATEGORY_VAR[t.category]} 22%, transparent)` }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_VAR[t.category] }} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.time || "a qualquer hora"} · {t.category}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </>
      )}

      {/* Hábitos do dia */}
      <SectionLabel>Hábitos do dia</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        {habits.map((h) => {
          const ok = isHabitDoneOn(h);
          const pct = habitPct(h);
          return (
            <div
              key={h.id}
              className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5"
              style={ok ? { borderColor: "var(--primary)" } : { borderColor: "var(--border)" }}
            >
              <span className="text-2xl">{h.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{h.name}</p>
                <p className="text-xs" style={{ color: ok ? "var(--primary)" : "var(--muted-foreground)" }}>
                  {formatHabitProgress(h)} {ok && "✓"}
                </p>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ok ? "var(--primary)" : CATEGORY_VAR[h.category] }} />
                </div>
              </div>
              <button
                onClick={() => incHabit(h.id, habitStep(h))}
                className="no-tap flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-primary-foreground active:scale-90"
                style={{ background: "var(--primary)" }}
                aria-label={`Registrar ${h.name}`}
              >
                <Check className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>
          );
        })}
      </div>


      <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Zap className="h-3.5 w-3.5 text-primary" />
        {xp} XP acumulado
      </div>
    </main>
  );
}
