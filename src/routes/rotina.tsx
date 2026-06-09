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

function HabitsTab() {
  const habits = useStore((s) => s.habits);
  const toggleHabit = useStore((s) => s.toggleHabit);
  return (
    <div className="space-y-2">
      {habits.map((h) => {
        const ok = isDoneToday(h.lastDone);
        return (
          <button
            key={h.id}
            onClick={() => toggleHabit(h.id)}
            className="no-tap flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left active:scale-[0.99]"
            style={ok ? { borderColor: "var(--primary)" } : { borderColor: "var(--border)" }}
          >
            <span className="text-3xl">{h.icon}</span>
            <div className="flex-1">
              <p className="font-semibold">{h.name}</p>
              <p className="text-xs" style={{ color: ok ? "var(--primary)" : "var(--muted-foreground)" }}>
                {ok ? "Concluído hoje ✓" : "Toque para concluir"}
              </p>
            </div>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full border-2"
              style={ok ? { background: "var(--primary)", borderColor: "var(--primary)" } : { borderColor: "var(--border)" }}
            >
              {ok && <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
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
