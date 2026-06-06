import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, BellRing, Zap, Trophy, CheckCircle2, BookOpen, Dumbbell, Utensils } from "lucide-react";
import { toast } from "sonner";
import { useStore, levelInfo, isDoneToday } from "@/lib/store";
import { Card, PageTitle, Bar, SectionLabel } from "@/components/primitives";
import { todayKey, formatHours } from "@/lib/dates";
import { currentPermission, requestNotificationPermission, fireNotification } from "@/lib/notify";

export const Route = createFileRoute("/voce")({
  head: () => ({ meta: [{ title: "Você — LevelUp" }] }),
  component: Voce;
});

function Voce() {
  const xp = useStore((s) => s.xp);
  const tasks = useStore((s) => s.tasks);
  const habits = useStore((s) => s.habits);
  const studyLog = useStore((s) => s.studyLog);
  const workoutLog = useStore((s) => s.workoutLog);
  const diet = useStore((s) => s.diet);
  const history = useStore((s) => s.history);
  const setNotifPermission = useStore((s) => s.setNotifPermission);

  const lvl = levelInfo(xp);
  const today = todayKey();

  const tasksDone = tasks.filter((t) => isDoneToday(t.lastDone)).length;
  const habitsDone = habits.filter((h) => isDoneToday(h.lastDone)).length;
  const studyToday = studyLog.filter((e) => e.date === today).reduce((a, b) => a + b.seconds, 0);
  const workoutDone = workoutLog.includes(today);
  const calToday = diet.meals.filter((m) => m.date === today).reduce((a, b) => a + b.calories, 0);
  const taskPct = tasks.length ? Math.round((tasksDone / tasks.length) * 100) : 0;

  const feedback =
    taskPct >= 100
      ? "Dia perfeito. Você dominou a rotina hoje. 🏆"
      : taskPct >= 60
      ? "Bom trabalho! Constância vale mais que perfeição."
      : taskPct > 0
      ? "Você começou — e começar já é vitória."
      : "Ainda dá tempo. Comece com uma coisa só.";

  // notifications
  const [perm, setPerm] = useState<string>("default");
  useEffect(() => {
    const p = currentPermission();
    setPerm(p);
    if (p !== "unsupported") setNotifPermission(p as NotificationPermission);
  }, [setNotifPermission]);

  async function ask() {
    const r = await requestNotificationPermission();
    setPerm(r);
    if (r === "granted") {
      setNotifPermission("granted");
      fireNotification("Notificações ativadas!", "Vou te lembrar das tarefas no horário.");
    } else if (r === "denied") {
      toast("Permissão negada", { description: "Ative nas configurações do navegador/celular." });
    }
  }

  const permLabel =
    perm === "granted" ? "Ativadas" : perm === "denied" ? "Bloqueadas" : perm === "unsupported" ? "Não suportadas" : "Não solicitadas";
  const permColor = perm === "granted" ? "var(--primary)" : perm === "denied" ? "var(--danger)" : "var(--warning)";

  return (
    <main className="px-4 pt-6">
      <PageTitle title="Você" subtitle="Progresso, resumo e ajustes." />

      {/* Level */}
      <Card className="relative overflow-hidden">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
            <Trophy className="h-7 w-7 text-primary" />
          </span>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Nível atual</p>
            <p className="font-display text-3xl font-bold">Nível {lvl.level}</p>
          </div>
          <div className="text-right">
            <p className="flex items-center gap-1 text-sm font-bold text-primary">
              <Zap className="h-4 w-4" /> {xp} XP
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Bar pct={lvl.pct} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {lvl.inLevel} / {lvl.need} XP para o nível {lvl.level + 1}
          </p>
        </div>
      </Card>

      {/* Notifications */}
      <SectionLabel>Notificações</SectionLabel>
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" style={{ color: permColor }} />
            <span className="text-sm font-semibold">Status</span>
          </div>
          <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: `color-mix(in oklab, ${permColor} 18%, transparent)`, color: permColor }}>
            {permLabel}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          {perm !== "granted" && perm !== "unsupported" && (
            <button onClick={ask} className="no-tap flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">
              Permitir notificações
            </button>
          )}
          <button
            onClick={() => fireNotification("Teste de notificação ✅", "Se você viu isso, está funcionando!")}
            className="no-tap flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-bold"
          >
            <BellRing className="h-4 w-4" /> Testar notificação
          </button>
        </div>
        {perm === "denied" && (
          <p className="mt-2 text-xs text-muted-foreground">
            As notificações estão bloqueadas. Ative nas permissões do site no seu navegador para receber lembretes.
          </p>
        )}
      </Card>

      {/* Resumo do dia */}
      <SectionLabel>Resumo do dia</SectionLabel>
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Summary icon={<CheckCircle2 className="h-4 w-4" />} label="Tarefas" value={`${tasksDone}/${tasks.length}`} />
          <Summary icon={<BookOpen className="h-4 w-4" />} label="Estudo" value={formatHours(studyToday)} />
          <Summary icon={<Dumbbell className="h-4 w-4" />} label="Treino" value={workoutDone ? "Feito ✓" : "—"} />
          <Summary icon={<Utensils className="h-4 w-4" />} label="Dieta" value={`${calToday} kcal`} />
        </div>
        <div className="mt-3 rounded-xl bg-secondary p-3 text-sm font-medium">
          Hábitos: {habitsDone}/{habits.length} · {feedback}
        </div>
      </Card>

      {/* Calendar */}
      <SectionLabel>Calendário</SectionLabel>
      <CalendarView history={history} liveTodayPct={taskPct} />
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <Legend color="var(--primary)" label="Concluído" />
        <Legend color="var(--warning)" label="Parcial" />
        <Legend color="var(--danger)" label="Falho" />
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        LevelUp · seus dados ficam salvos neste aparelho.
      </p>
    </main>
  );
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon} {label}</div>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded" style={{ background: color }} /> {label}
    </span>
  );
}

function CalendarView({ history, liveTodayPct }: { history: Record<string, number>; liveTodayPct: number }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay(); // 0 sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayKey();
  const monthName = first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function colorFor(day: number): string {
    const key = todayKey(new Date(year, month, day));
    const pct = key === today ? liveTodayPct : history[key];
    if (pct === undefined) return "var(--muted)";
    if (pct >= 100) return "var(--primary)";
    if (pct > 0) return "var(--warning)";
    return "color-mix(in oklab, var(--danger) 55%, transparent)";
  }

  return (
    <Card>
      <p className="mb-3 text-center text-sm font-bold capitalize">{monthName}</p>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <span key={i} className="text-[10px] font-semibold text-muted-foreground">{d}</span>
        ))}
        {cells.map((d, i) =>
          d === null ? (
            <span key={i} />
          ) : (
            <div
              key={i}
              className="flex aspect-square items-center justify-center rounded-lg text-xs font-semibold"
              style={{
                background: colorFor(d),
                color: history[todayKey(new Date(year, month, d))] === undefined && todayKey(new Date(year, month, d)) !== today ? "var(--muted-foreground)" : "var(--background)",
                outline: todayKey(new Date(year, month, d)) === today ? "2px solid var(--foreground)" : "none",
              }}
            >
              {d}
            </div>
          ),
        )}
      </div>
    </Card>
  );
}
