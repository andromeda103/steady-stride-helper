import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Play, Pause, Square, Minus } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Card, PageTitle, SectionLabel } from "@/components/primitives";
import { ProgressRing } from "@/components/ProgressRing";
import { formatClock, formatHours, todayKey, startOfWeekKey } from "@/lib/dates";
import { fireNotification } from "@/lib/notify";

export const Route = createFileRoute("/estudos")({
  head: () => ({ meta: [{ title: "Estudos — LevelUp" }] }),
  component: Estudos,
});

function Estudos() {
  const subjects = useStore((s) => s.subjects);
  const studyLog = useStore((s) => s.studyLog);
  const pomodoro = useStore((s) => s.pomodoro);
  const setPomodoro = useStore((s) => s.setPomodoro);
  const logStudy = useStore((s) => s.logStudy);
  const addSubject = useStore((s) => s.addSubject);
  const deleteSubject = useStore((s) => s.deleteSubject);

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string>(subjects[0]?.id ?? "");
  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(pomodoro.focusMin * 60);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const today = todayKey();
  const weekStart = startOfWeekKey();
  const todaySec = studyLog.filter((e) => e.date === today).reduce((a, b) => a + b.seconds, 0);
  const weekSec = studyLog.filter((e) => e.date >= weekStart).reduce((a, b) => a + b.seconds, 0);

  const phaseTotal = (phase === "focus" ? pomodoro.focusMin : pomodoro.breakMin) * 60;
  const pct = phaseTotal ? Math.round(((phaseTotal - left) / phaseTotal) * 100) : 0;

  useEffect(() => {
    if (running) {
      tick.current = setInterval(() => setLeft((l) => l - 1), 1000);
      return () => {
        if (tick.current) clearInterval(tick.current);
      };
    }
  }, [running]);

  useEffect(() => {
    if (left > 0) return;
    if (phase === "focus") {
      const subj = subjects.find((s) => s.id === selected);
      logStudy(selected, pomodoro.focusMin * 60);
      fireNotification("Foco concluído!", `+${pomodoro.focusMin}min em ${subj?.name ?? "estudo"}. Hora do descanso.`);
      setPhase("break");
      setLeft(pomodoro.breakMin * 60);
    } else {
      fireNotification("Descanso terminou", "Pronto para mais um ciclo de foco?");
      setPhase("focus");
      setLeft(pomodoro.focusMin * 60);
      setRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  function start() {
    if (!selected) {
      toast("Selecione uma matéria");
      return;
    }
    setRunning(true);
  }
  function stop() {
    setRunning(false);
    setPhase("focus");
    setLeft(pomodoro.focusMin * 60);
  }
  function adjust(which: "focus" | "break", delta: number) {
    const f = which === "focus" ? Math.max(5, pomodoro.focusMin + delta) : pomodoro.focusMin;
    const b = which === "break" ? Math.max(5, pomodoro.breakMin + delta) : pomodoro.breakMin;
    setPomodoro(f, b);
    if (!running) setLeft((phase === "focus" ? f : b) * 60);
  }

  return (
    <main className="px-4 pt-6">
      <PageTitle title="Estudos" subtitle="Concurso, foco e constância." />

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-xs text-muted-foreground">Estudado hoje</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{formatHours(todaySec)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-muted-foreground">Na semana</p>
          <p className="mt-1 font-display text-2xl font-bold">{formatHours(weekSec)}</p>
        </Card>
      </div>

      <SectionLabel>Pomodoro</SectionLabel>
      <Card className="flex flex-col items-center">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="mb-4 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary"
        >
          {subjects.length === 0 && <option>Cadastre uma matéria</option>}
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <ProgressRing pct={pct} size={180} stroke={12} color={phase === "focus" ? "var(--primary)" : "var(--cat-saude)"}>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {phase === "focus" ? "Foco" : "Descanso"}
          </span>
          <span className="font-display text-4xl font-bold tabular-nums">{formatClock(Math.max(0, left))}</span>
        </ProgressRing>

        <div className="mt-5 flex w-full gap-3">
          {!running ? (
            <button onClick={start} className="no-tap flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground">
              <Play className="h-5 w-5" /> Começar agora
            </button>
          ) : (
            <button onClick={() => setRunning(false)} className="no-tap flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary py-3 font-bold">
              <Pause className="h-5 w-5" /> Pausar
            </button>
          )}
          <button onClick={stop} className="no-tap flex items-center justify-center rounded-xl border border-border px-4">
            <Square className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid w-full grid-cols-2 gap-3">
          <Stepper label="Foco (min)" value={pomodoro.focusMin} onMinus={() => adjust("focus", -5)} onPlus={() => adjust("focus", 5)} />
          <Stepper label="Descanso (min)" value={pomodoro.breakMin} onMinus={() => adjust("break", -5)} onPlus={() => adjust("break", 5)} />
        </div>
      </Card>

      <SectionLabel>Matérias</SectionLabel>
      <div className="mb-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Informática"
          className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => {
            if (!name.trim()) return;
            addSubject(name.trim());
            setName("");
          }}
          className="no-tap rounded-xl bg-primary px-4 font-bold text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2">
        {subjects.map((s) => (
          <Card key={s.id} className="flex items-center gap-3 p-3">
            <div className="flex-1">
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs text-muted-foreground">
                {s.sessions} sessões · {formatHours(s.totalSeconds)}
              </p>
            </div>
            <button
              onClick={() => {
                deleteSubject(s.id);
                if (selected === s.id) setSelected("");
              }}
              className="no-tap p-1 text-muted-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </Card>
        ))}
      </div>
    </main>
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: number; onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="rounded-xl border border-border p-2">
      <p className="mb-1 text-center text-[11px] text-muted-foreground">{label}</p>
      <div className="flex items-center justify-between">
        <button onClick={onMinus} className="no-tap rounded-lg bg-muted p-1.5">
          <Minus className="h-4 w-4" />
        </button>
        <span className="font-display text-lg font-bold">{value}</span>
        <button onClick={onPlus} className="no-tap rounded-lg bg-muted p-1.5">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
