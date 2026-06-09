import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Check, X, RotateCcw, Minus, Flame, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  useStore,
  sortTasks,
  isDoneToday,
  CATEGORIES,
  PRIORITIES,
  CATEGORY_VAR,
  type Category,
  type Priority,
  type HabitMode,
} from "@/lib/store";
import { Card, PageTitle, Dot } from "@/components/primitives";
import { daysBetween } from "@/lib/dates";
import {
  habitProgress,
  isHabitDoneOn,
  habitPct,
  formatHabitProgress,
  habitStep,
  habitStats,
  HABIT_TEMPLATES,
} from "@/lib/habits";

export const Route = createFileRoute("/rotina")({
  head: () => ({ meta: [{ title: "Rotina — LevelUp" }] }),
  component: Rotina,
});

const TABS = ["Tarefas", "Hábitos", "Anti-hábitos"] as const;
type Tab = (typeof TABS)[number];

const PRIORITY_COLOR: Record<Priority, string> = {
  Alta: "var(--danger)",
  Média: "var(--warning)",
  Baixa: "var(--muted-foreground)",
};

function Rotina() {
  const [tab, setTab] = useState<Tab>("Tarefas");
  return (
    <main className="px-4 pt-6">
      <PageTitle title="Rotina" subtitle="Organize o seu dia sem complicação." />
      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="no-tap flex-1 rounded-lg py-2 text-sm font-semibold transition-colors"
            style={tab === t ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { color: "var(--muted-foreground)" }}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Tarefas" && <TasksTab />}
      {tab === "Hábitos" && <HabitsTab />}
      {tab === "Anti-hábitos" && <AntiTab />}
    </main>
  );
}

function TasksTab() {
  const tasks = useStore((s) => s.tasks);
  const toggleTask = useStore((s) => s.toggleTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const addTask = useStore((s) => s.addTask);
  const [open, setOpen] = useState(false);

  const sorted = sortTasks(tasks);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen(true)}
        className="no-tap flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-muted-foreground"
      >
        <Plus className="h-4 w-4" /> Nova tarefa
      </button>
      {sorted.map((t) => {
        const ok = isDoneToday(t.lastDone);
        return (
          <Card key={t.id} className="flex items-center gap-3 p-3">
            <button
              onClick={() => toggleTask(t.id)}
              className="no-tap flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2"
              style={ok ? { background: "var(--primary)", borderColor: "var(--primary)" } : { borderColor: "var(--border)" }}
            >
              {ok && <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-semibold ${ok ? "text-muted-foreground line-through" : ""}`}>{t.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Dot color={CATEGORY_VAR[t.category]} /> {t.category} · {t.time || "qualquer hora"}
                <span style={{ color: PRIORITY_COLOR[t.priority] }}>· {t.priority}</span>
              </p>
            </div>
            <button onClick={() => deleteTask(t.id)} className="no-tap p-1 text-muted-foreground">
              <Trash2 className="h-4 w-4" />
            </button>
          </Card>
        );
      })}
      {open && <AddTaskSheet onClose={() => setOpen(false)} onAdd={addTask} />}
    </div>
  );
}

function AddTaskSheet({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (t: { name: string; time: string; category: Category; priority: Priority; essential: boolean }) => void;
}) {
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [category, setCategory] = useState<Category>("Estudos");
  const [priority, setPriority] = useState<Priority>("Média");
  const [essential, setEssential] = useState(false);

  function submit() {
    if (!name.trim()) {
      toast("Dê um nome à tarefa");
      return;
    }
    onAdd({ name: name.trim(), time, category, priority, essential });
    toast("Tarefa criada");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border-t border-border bg-card p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Nova tarefa</h3>
          <button onClick={onClose} className="no-tap rounded-full bg-muted p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          <Field label="Nome">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Estudar Direito Penal"
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label="Horário (opcional)">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label="Categoria">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Chip key={c} active={category === c} color={CATEGORY_VAR[c]} onClick={() => setCategory(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Prioridade">
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <Chip key={p} active={priority === p} color={PRIORITY_COLOR[p]} onClick={() => setPriority(p)}>
                  {p}
                </Chip>
              ))}
            </div>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={essential} onChange={(e) => setEssential(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            Essencial (mantida no modo dia ruim)
          </label>
          <button onClick={submit} className="no-tap w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground">
            Criar tarefa
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Chip({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="no-tap rounded-full border px-3 py-1.5 text-xs font-semibold"
      style={active ? { borderColor: color, background: `color-mix(in oklab, ${color} 18%, transparent)`, color } : { borderColor: "var(--border)", color: "var(--muted-foreground)" }}
    >
      {children}
    </button>
  );
}

const EMOJI_OPTIONS = ["🦷", "💧", "💊", "📚", "🍅", "✍️", "🏋️", "🥩", "🧘", "🚶", "🌙", "☀️", "❤️", "🔁", "🧠", "🛏️", "🚭", "🙏", "✅"];

function HabitsTab() {
  const habits = useStore((s) => s.habits);
  const addHabit = useStore((s) => s.addHabit);
  const addHabitsFromTemplate = useStore((s) => s.addHabitsFromTemplate);
  const [open, setOpen] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setOpen(true)}
          className="no-tap flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-muted-foreground"
        >
          <Plus className="h-4 w-4" /> Novo hábito
        </button>
        <button
          onClick={() => setShowTemplates((v) => !v)}
          className="no-tap flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-muted-foreground"
        >
          ✨ Templates
        </button>
      </div>

      {showTemplates && (
        <Card className="space-y-2">
          <p className="text-xs text-muted-foreground">Adicione um conjunto pronto de hábitos.</p>
          {HABIT_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => {
                addHabitsFromTemplate(tpl.items);
                toast(`${tpl.name}: ${tpl.items.length} hábitos adicionados`);
                setShowTemplates(false);
              }}
              className="no-tap flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left"
            >
              <span className="text-2xl">{tpl.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{tpl.name}</p>
                <p className="text-xs text-muted-foreground">{tpl.desc} · {tpl.items.length} hábitos</p>
              </div>
              <Plus className="h-4 w-4 text-primary" />
            </button>
          ))}
        </Card>
      )}

      {habits.map((h) => (
        <HabitCard key={h.id} id={h.id} />
      ))}

      {open && <AddHabitSheet onClose={() => setOpen(false)} onAdd={addHabit} />}
    </div>
  );
}

function HabitCard({ id }: { id: string }) {
  const habit = useStore((s) => s.habits.find((h) => h.id === id));
  const incHabit = useStore((s) => s.incHabit);
  const deleteHabit = useStore((s) => s.deleteHabit);
  if (!habit) return null;

  const done = isHabitDoneOn(habit);
  const pct = habitPct(habit);
  const step = habitStep(habit);
  const stats = habitStats(habit);
  const accent = CATEGORY_VAR[habit.category];

  return (
    <Card style={{ borderColor: done ? "var(--primary)" : "var(--border)" }}>
      <div className="flex items-start gap-3">
        <span className="text-3xl">{habit.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{habit.name}</p>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Dot color={accent} /> {habit.category}
            {habit.mode === "time" && <span>· por tempo</span>}
            {habit.pomodoroLinked && <span>· 🍅 Pomodoro</span>}
            {habit.times.length > 0 && (
              <span className="inline-flex items-center gap-1">
                · <Clock className="h-3 w-3" /> {habit.times.join(" · ")}
              </span>
            )}
          </p>
        </div>
        <button onClick={() => deleteHabit(habit.id)} className="no-tap p-1 text-muted-foreground">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="font-semibold" style={{ color: done ? "var(--primary)" : undefined }}>
          {formatHabitProgress(habit)} {done && "✓"}
        </span>
        <span className="text-xs text-muted-foreground">{pct}%</span>
      </div>

      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: done ? "var(--primary)" : accent }} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => incHabit(habit.id, -step)}
          className="no-tap flex h-10 flex-1 items-center justify-center rounded-xl border border-border font-bold active:scale-95"
        >
          <Minus className="h-4 w-4" />
          {step > 1 && <span className="ml-1 text-xs">{step}</span>}
        </button>
        <span className="min-w-[64px] text-center font-display text-lg font-bold">{formatHabitProgress(habit)}</span>
        <button
          onClick={() => incHabit(habit.id, step)}
          className="no-tap flex h-10 flex-1 items-center justify-center rounded-xl font-bold text-primary-foreground active:scale-95"
          style={{ background: "var(--primary)" }}
        >
          <Plus className="h-4 w-4" />
          {step > 1 && <span className="ml-1 text-xs">{step}</span>}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3 text-center">
        <Stat label="Sequência" value={`${stats.streak}d`} icon={<Flame className="h-3 w-3 text-primary" />} />
        <Stat label="Semana" value={`${stats.weeklyAvgPct}%`} />
        <Stat label="Mês" value={`${stats.monthlyAvgPct}%`} />
        <Stat label="Conclusão" value={`${stats.completionRate}%`} />
      </div>
    </Card>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center justify-center gap-1 font-display text-base font-bold">{icon}{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function AddHabitSheet({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (h: { name: string; icon: string; category: Category; mode: HabitMode; target: number; times: string[]; pomodoroLinked: boolean }) => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("✅");
  const [category, setCategory] = useState<Category>("Saúde");
  const [mode, setMode] = useState<HabitMode>("count");
  const [target, setTarget] = useState(1);
  const [times, setTimes] = useState<string[]>([]);
  const [newTime, setNewTime] = useState("");
  const [pomodoroLinked, setPomodoroLinked] = useState(false);

  function addTime() {
    if (!newTime || times.includes(newTime)) return;
    setTimes([...times, newTime].sort());
    setNewTime("");
  }

  function submit() {
    if (!name.trim()) {
      toast("Dê um nome ao hábito");
      return;
    }
    onAdd({
      name: name.trim(),
      icon,
      category,
      mode,
      target: Math.max(1, target),
      times,
      pomodoroLinked: mode === "time" && pomodoroLinked,
    });
    toast("Hábito criado");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Novo hábito</h3>
          <button onClick={onClose} className="no-tap rounded-full bg-muted p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          <Field label="Nome">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Escovar os dentes"
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label="Ícone">
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => setIcon(e)}
                  className="no-tap flex h-9 w-9 items-center justify-center rounded-lg border text-xl"
                  style={icon === e ? { borderColor: "var(--primary)", background: "color-mix(in oklab, var(--primary) 14%, transparent)" } : { borderColor: "var(--border)" }}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Categoria">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Chip key={c} active={category === c} color={CATEGORY_VAR[c]} onClick={() => setCategory(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Tipo de meta">
            <div className="flex gap-2">
              <Chip active={mode === "count"} color="var(--primary)" onClick={() => setMode("count")}>
                Quantidade
              </Chip>
              <Chip active={mode === "time"} color="var(--primary)" onClick={() => setMode("time")}>
                Tempo (min)
              </Chip>
            </div>
          </Field>
          <Field label={mode === "time" ? "Meta diária (minutos)" : "Meta diária (vezes)"}>
            <div className="flex items-center gap-2">
              <button onClick={() => setTarget((t) => Math.max(1, t - (mode === "time" ? 5 : 1)))} className="no-tap flex h-10 w-10 items-center justify-center rounded-xl border border-border">
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                value={target}
                onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 1))}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-center text-sm outline-none focus:border-primary"
              />
              <button onClick={() => setTarget((t) => t + (mode === "time" ? 5 : 1))} className="no-tap flex h-10 w-10 items-center justify-center rounded-xl border border-border">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </Field>
          {mode === "time" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={pomodoroLinked} onChange={(e) => setPomodoroLinked(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              Somar tempo do Pomodoro automaticamente 🍅
            </label>
          )}
          <Field label="Horários e lembretes">
            <div className="flex gap-2">
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <button onClick={addTime} className="no-tap rounded-xl bg-primary px-4 font-bold text-primary-foreground">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {times.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {times.map((t) => (
                  <span key={t} className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold">
                    <Clock className="h-3 w-3" /> {t}
                    <button onClick={() => setTimes(times.filter((x) => x !== t))} className="no-tap text-muted-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>
          <button onClick={submit} className="no-tap w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground">
            Criar hábito
          </button>
        </div>
      </div>
    </div>
  );
}


function AntiTab() {
  const antiHabits = useStore((s) => s.antiHabits);
  const failAntiHabit = useStore((s) => s.failAntiHabit);
  const addAntiHabit = useStore((s) => s.addAntiHabit);
  const deleteAntiHabit = useStore((s) => s.deleteAntiHabit);
  const [name, setName] = useState("");

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Dias sem xingar"
          className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => {
            if (!name.trim()) return;
            addAntiHabit(name.trim());
            setName("");
          }}
          className="no-tap rounded-xl bg-primary px-4 font-bold text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {antiHabits.map((a) => {
        const streak = daysBetween(a.since);
        return (
          <Card key={a.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{a.name}</p>
                <p className="text-xs text-muted-foreground">Recorde: {Math.max(a.best, streak)} dias</p>
              </div>
              <button onClick={() => deleteAntiHabit(a.id)} className="no-tap p-1 text-muted-foreground">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <span className="font-display text-4xl font-bold text-primary">{streak}</span>
                <span className="ml-1 text-sm text-muted-foreground">dias limpos</span>
              </div>
              <button
                onClick={() => {
                  failAntiHabit(a.id);
                  toast("Contador reiniciado. Recomeçar faz parte.");
                }}
                className="no-tap flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold"
                style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
              >
                <RotateCcw className="h-4 w-4" /> Eu falhei
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
