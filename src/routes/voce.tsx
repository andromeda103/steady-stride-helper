import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { Zap, Trophy, CheckCircle2, BookOpen, Dumbbell, Utensils, Bell, ChevronRight, Palette, Download, Upload, Cloud, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useStore, levelInfo, isDoneToday, type DarkMode } from "@/lib/store";
import { Card, PageTitle, Bar, SectionLabel } from "@/components/primitives";
import { todayKey, formatHours } from "@/lib/dates";
import { PRIMARY_PRESETS, SECONDARY_PRESETS } from "@/lib/theme";
import { exportBackup, importBackup } from "@/lib/backup";
import { useAuth } from "@/hooks/useAuth";
import { SyncBadge } from "@/components/SyncBadge";
import { syncNow } from "@/lib/sync";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/voce")({
  head: () => ({ meta: [{ title: "Você — LevelUp" }] }),
  component: Voce,
});

function Voce() {
  const xp = useStore((s) => s.xp);
  const tasks = useStore((s) => s.tasks);
  const habits = useStore((s) => s.habits);
  const studyLog = useStore((s) => s.studyLog);
  const workoutLog = useStore((s) => s.workoutLog);
  const diet = useStore((s) => s.diet);
  const history = useStore((s) => s.history);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const lvl = levelInfo(xp);
  const today = todayKey();

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast("Você saiu", { description: "Os dados continuam neste aparelho." });
    navigate({ to: "/voce" });
  }

  async function handleSyncNow() {
    const status = await syncNow();
    if (status === "synced") toast("Tudo sincronizado");
    else if (status === "offline") toast("Sem internet", { description: "Vamos sincronizar quando voltar." });
    else if (status === "error") toast("Erro ao sincronizar", { description: "Tente novamente." });
  }


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

  const DARK_MODES: { id: DarkMode; label: string }[] = [
    { id: "default", label: "Dark padrão" },
    { id: "amoled", label: "Dark AMOLED" },
    { id: "gray", label: "Dark cinza" },
  ];

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      await importBackup(f);
      toast("Backup importado", { description: "Seus dados foram restaurados." });
    } catch {
      toast("Falha ao importar", { description: "Arquivo de backup inválido." });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }


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
      <Link to="/notificacoes" className="no-tap block">
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <Bell className="h-5 w-5 text-primary" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">Diagnóstico de notificações</p>
            <p className="text-xs text-muted-foreground">Status, testes e registros detalhados</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Card>
      </Link>

      {/* Personalização */}
      <SectionLabel>Personalização</SectionLabel>
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Tema</span>
        </div>
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Cor primária</p>
          <div className="flex flex-wrap gap-2">
            {PRIMARY_PRESETS.map((c) => (
              <button
                key={c.value}
                onClick={() => setSettings({ primaryColor: c.value })}
                className="no-tap h-9 w-9 rounded-full border-2"
                style={{ background: c.value, borderColor: settings.primaryColor === c.value ? "var(--foreground)" : "transparent" }}
                aria-label={c.name}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Cor secundária</p>
          <div className="flex flex-wrap gap-2">
            {SECONDARY_PRESETS.map((c) => (
              <button
                key={c.value}
                onClick={() => setSettings({ secondaryColor: c.value })}
                className="no-tap h-9 w-9 rounded-full border-2"
                style={{ background: c.value, borderColor: settings.secondaryColor === c.value ? "var(--foreground)" : "transparent" }}
                aria-label={c.name}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Modo escuro</p>
          <div className="grid grid-cols-3 gap-2">
            {DARK_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setSettings({ darkMode: m.id })}
                className="no-tap rounded-xl border py-2 text-xs font-semibold"
                style={settings.darkMode === m.id ? { borderColor: "var(--primary)", color: "var(--primary)" } : { borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Backup */}
      <SectionLabel>Backup</SectionLabel>
      <Card className="space-y-2">
        <p className="text-xs text-muted-foreground">Salve ou restaure todos os seus dados em um arquivo JSON.</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              exportBackup();
              toast("Backup exportado");
            }}
            className="no-tap flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
          >
            <Download className="h-4 w-4" /> Exportar
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="no-tap flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-bold"
          >
            <Upload className="h-4 w-4" /> Importar
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImport} />
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
