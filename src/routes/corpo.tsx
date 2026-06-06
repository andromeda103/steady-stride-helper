import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Check, Droplet, Flame, Beef, Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Card, PageTitle, Bar, SectionLabel } from "@/components/primitives";
import { todayKey } from "@/lib/dates";

export const Route = createFileRoute("/corpo")({
  head: () => ({ meta: [{ title: "Corpo — LevelUp" }] }),
  component: Corpo,
});

const TABS = ["Treino", "Dieta"] as const;
type Tab = (typeof TABS)[number];

function Corpo() {
  const [tab, setTab] = useState<Tab>("Treino");
  return (
    <main className="px-4 pt-6">
      <PageTitle title="Corpo" subtitle="Treino e dieta, sem complicação." />
      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="no-tap flex-1 rounded-lg py-2 text-sm font-semibold"
            style={tab === t ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { color: "var(--muted-foreground)" }}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Treino" ? <Treino /> : <Dieta />}
    </main>
  );
}

function Treino() {
  const exercises = useStore((s) => s.exercises);
  const workoutLog = useStore((s) => s.workoutLog);
  const addExercise = useStore((s) => s.addExercise);
  const deleteExercise = useStore((s) => s.deleteExercise);
  const toggleWorkoutToday = useStore((s) => s.toggleWorkoutToday);

  const [name, setName] = useState("");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);

  const today = todayKey();
  const doneToday = workoutLog.includes(today);

  // last 7 days strip
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = todayKey(d);
    return { key, label: ["D", "S", "T", "Q", "Q", "S", "S"][d.getDay()], done: workoutLog.includes(key) };
  });
  const weekCount = days.filter((d) => d.done).length;

  return (
    <div className="space-y-3">
      <Card style={doneToday ? { borderColor: "var(--primary)" } : undefined}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Treino de hoje</p>
            <p className="font-display text-xl font-bold">{doneToday ? "Concluído 💪" : "Pendente"}</p>
          </div>
          <button
            onClick={() => {
              toggleWorkoutToday();
              if (!doneToday) toast("Treino registrado! +20 XP");
            }}
            className="no-tap flex items-center gap-2 rounded-xl px-4 py-2.5 font-bold"
            style={doneToday ? { background: "var(--secondary)" } : { background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            <Check className="h-5 w-5" strokeWidth={3} /> {doneToday ? "Desfazer" : "Concluir"}
          </button>
        </div>
        <div className="mt-4 flex justify-between">
          {days.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
                style={d.done ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { background: "var(--muted)", color: "var(--muted-foreground)" }}
              >
                {d.done ? <Dumbbell className="h-4 w-4" /> : d.label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">{weekCount} treinos nos últimos 7 dias</p>
      </Card>

      <SectionLabel>Exercícios</SectionLabel>
      <Card className="space-y-2 p-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do exercício"
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <div className="flex gap-2">
          <NumIn label="Séries" value={sets} onChange={setSets} />
          <NumIn label="Reps" value={reps} onChange={setReps} />
          <button
            onClick={() => {
              if (!name.trim()) return;
              addExercise({ name: name.trim(), sets, reps });
              setName("");
            }}
            className="no-tap mt-auto rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </Card>

      <div className="space-y-2">
        {exercises.map((e) => (
          <Card key={e.id} className="flex items-center gap-3 p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "color-mix(in oklab, var(--cat-treino) 22%, transparent)" }}>
              <Dumbbell className="h-4 w-4" style={{ color: "var(--cat-treino)" }} />
            </span>
            <div className="flex-1">
              <p className="font-semibold">{e.name}</p>
              <p className="text-xs text-muted-foreground">{e.sets} × {e.reps}</p>
            </div>
            <button onClick={() => deleteExercise(e.id)} className="no-tap p-1 text-muted-foreground">
              <Trash2 className="h-4 w-4" />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NumIn({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex-1">
      <label className="mb-1 block text-[11px] text-muted-foreground">{label}</label>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value)))}
        className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}

function Dieta() {
  const diet = useStore((s) => s.diet);
  const logMeal = useStore((s) => s.logMeal);
  const deleteMeal = useStore((s) => s.deleteMeal);
  const addWater = useStore((s) => s.addWater);
  const addMealPreset = useStore((s) => s.addMealPreset);
  const deleteMealPreset = useStore((s) => s.deleteMealPreset);
  const setDietGoals = useStore((s) => s.setDietGoals);

  const today = todayKey();
  const meals = diet.meals.filter((m) => m.date === today);
  const cal = meals.reduce((a, b) => a + b.calories, 0);
  const prot = meals.reduce((a, b) => a + b.protein, 0);
  const water = diet.waterByDay[today] || 0;

  const [showGoals, setShowGoals] = useState(false);
  const [mName, setMName] = useState("");
  const [mCal, setMCal] = useState(0);
  const [mProt, setMProt] = useState(0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <MetricCard icon={<Flame className="h-4 w-4" />} label="Calorias" value={cal} goal={diet.calorieGoal} color="var(--cat-treino)" unit="" />
        <MetricCard icon={<Beef className="h-4 w-4" />} label="Proteína" value={prot} goal={diet.proteinGoal} color="var(--cat-dieta)" unit="g" />
        <MetricCard icon={<Droplet className="h-4 w-4" />} label="Água" value={water} goal={diet.waterGoal} color="var(--cat-saude)" unit="ml" />
      </div>

      <Card className="text-center">
        <p className="text-sm text-muted-foreground">Calorias restantes</p>
        <p className="font-display text-3xl font-bold text-primary">{Math.max(0, diet.calorieGoal - cal)}</p>
        <button onClick={() => setShowGoals((v) => !v)} className="no-tap mt-1 text-xs text-muted-foreground underline">
          Editar metas
        </button>
      </Card>

      {showGoals && (
        <Card className="space-y-2">
          <GoalRow label="Meta de calorias" value={diet.calorieGoal} onChange={(v) => setDietGoals({ calorieGoal: v, waterGoal: diet.waterGoal, proteinGoal: diet.proteinGoal })} />
          <GoalRow label="Meta de proteína (g)" value={diet.proteinGoal} onChange={(v) => setDietGoals({ calorieGoal: diet.calorieGoal, waterGoal: diet.waterGoal, proteinGoal: v })} />
          <GoalRow label="Meta de água (ml)" value={diet.waterGoal} onChange={(v) => setDietGoals({ calorieGoal: diet.calorieGoal, waterGoal: v, proteinGoal: diet.proteinGoal })} />
        </Card>
      )}

      <div className="flex gap-2">
        {[250, 500].map((ml) => (
          <button key={ml} onClick={() => addWater(ml)} className="no-tap flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold">
            <Droplet className="h-4 w-4" style={{ color: "var(--cat-saude)" }} /> +{ml}ml
          </button>
        ))}
        <button onClick={() => addWater(-250)} className="no-tap rounded-xl border border-border bg-card px-4 text-sm font-semibold text-muted-foreground">
          -250
        </button>
      </div>

      <SectionLabel>Refeições rápidas</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {diet.presets.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              logMeal({ name: p.name, calories: p.calories, protein: p.protein });
              toast(`${p.name} registrado`);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              deleteMealPreset(p.id);
            }}
            className="no-tap rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold"
          >
            + {p.name} <span className="text-muted-foreground">{p.calories}kcal</span>
          </button>
        ))}
      </div>

      <SectionLabel>Registrar refeição</SectionLabel>
      <Card className="space-y-2 p-3">
        <input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Nome da refeição" className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
        <div className="flex gap-2">
          <NumIn label="Calorias" value={mCal} onChange={setMCal} />
          <NumIn label="Proteína (g)" value={mProt} onChange={setMProt} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (!mName.trim()) return;
              logMeal({ name: mName.trim(), calories: mCal, protein: mProt });
              toast("Refeição registrada");
              setMName(""); setMCal(0); setMProt(0);
            }}
            className="no-tap flex-1 rounded-xl bg-primary py-2.5 font-bold text-primary-foreground"
          >
            Registrar
          </button>
          <button
            onClick={() => {
              if (!mName.trim()) return;
              addMealPreset({ name: mName.trim(), calories: mCal, protein: mProt });
              toast("Salvo como refeição rápida");
            }}
            className="no-tap rounded-xl border border-border px-4 text-sm font-semibold"
          >
            Salvar fixa
          </button>
        </div>
      </Card>

      {meals.length > 0 && (
        <>
          <SectionLabel>Hoje</SectionLabel>
          <div className="space-y-2">
            {meals.map((m) => (
              <Card key={m.id} className="flex items-center gap-3 p-3">
                <div className="flex-1">
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.calories} kcal · {m.protein}g proteína</p>
                </div>
                <button onClick={() => deleteMeal(m.id)} className="no-tap p-1 text-muted-foreground">
                  <Trash2 className="h-4 w-4" />
                </button>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, goal, color, unit }: { icon: React.ReactNode; label: string; value: number; goal: number; color: string; unit: string }) {
  const pct = goal ? Math.round((value / goal) * 100) : 0;
  return (
    <Card className="p-3">
      <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground" style={{ color }}>
        {icon} {label}
      </div>
      <p className="font-display text-lg font-bold leading-none">{value}{unit}</p>
      <p className="mb-2 text-[10px] text-muted-foreground">/ {goal}{unit}</p>
      <Bar pct={pct} color={color} />
    </Card>
  );
}

function GoalRow({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
        className="w-24 rounded-lg border border-input bg-background px-2 py-1.5 text-right text-sm outline-none focus:border-primary"
      />
    </div>
  );
}
