import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PiggyBank, Target, Gift, Trash2, Check, Plus, Trophy, CalendarCheck, Coins } from "lucide-react";
import { toast } from "sonner";
import { useStore, isDoneToday } from "@/lib/store";
import { Card, PageTitle, Bar, SectionLabel } from "@/components/primitives";
import { todayKey, endOfWeekKey } from "@/lib/dates";
import { missionInfo } from "@/lib/mission";

export const Route = createFileRoute("/cofrinho")({
  head: () => ({ meta: [{ title: "Cofrinho — LevelUp" }] }),
  component: Cofrinho,
});

const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

function Cofrinho() {
  const habits = useStore((s) => s.habits);
  const cofrinho = useStore((s) => s.cofrinho);
  const weekly = useStore((s) => s.weekly);
  const setDailyAmount = useStore((s) => s.setDailyAmount);
  const toggleRequiredHabit = useStore((s) => s.toggleRequiredHabit);
  const recomputeCofrinho = useStore((s) => s.recomputeCofrinho);
  const addRewardGoal = useStore((s) => s.addRewardGoal);
  const deleteRewardGoal = useStore((s) => s.deleteRewardGoal);
  const redeemReward = useStore((s) => s.redeemReward);
  const setWeekly = useStore((s) => s.setWeekly);
  const setWeeklyProgress = useStore((s) => s.setWeeklyProgress);

  // keep today's earning in sync (e.g. day changed)
  useEffect(() => {
    recomputeCofrinho();
  }, [recomputeCofrinho]);

  const today = todayKey();
  const month = today.slice(0, 7);
  const earnedMonth = Object.entries(cofrinho.earnedByDay)
    .filter(([d]) => d.startsWith(month))
    .reduce((a, [, v]) => a + v, 0);

  const required = habits.filter((h) => cofrinho.requiredHabitIds.includes(h.id));
  const doneCount = required.filter((h) => isDoneToday(h.lastDone)).length;
  const todayPerfect = required.length > 0 && doneCount === required.length;

  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");

  function addGoal() {
    const t = parseFloat(goalTarget.replace(",", "."));
    if (!goalName.trim() || !t || t <= 0) {
      toast("Preencha nome e meta válida");
      return;
    }
    addRewardGoal(goalName.trim(), t);
    setGoalName("");
    setGoalTarget("");
    toast("Meta criada 🎯");
  }

  function redeem(name: string, amount: number) {
    if (amount > cofrinho.balance) {
      toast("Saldo insuficiente", { description: "Continue acumulando dias perfeitos." });
      return;
    }
    redeemReward(name, amount);
    toast("Recompensa resgatada! 🎁", { description: `${name} · ${brl(amount)}` });
  }

  return (
    <main className="px-4 pt-6">
      <PageTitle title="Cofrinho" subtitle="Transforme disciplina em recompensas reais." />

      {/* Saldo */}
      <Card className="relative overflow-hidden">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
            <PiggyBank className="h-7 w-7 text-primary" />
          </span>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Saldo acumulado</p>
            <p className="font-display text-3xl font-bold">{brl(cofrinho.balance)}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-secondary p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Coins className="h-4 w-4" /> Ganho no mês</div>
            <p className="mt-1 font-display text-lg font-bold">{brl(earnedMonth)}</p>
          </div>
          <div className="rounded-xl bg-secondary p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarCheck className="h-4 w-4" /> Dias perfeitos</div>
            <p className="mt-1 font-display text-lg font-bold">{cofrinho.perfectDays.length}</p>
          </div>
        </div>
      </Card>

      {/* Valor diário */}
      <SectionLabel>Valor por dia perfeito</SectionLabel>
      <Card className="flex items-center gap-3">
        <span className="text-sm font-semibold">R$</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={cofrinho.dailyAmount}
          onChange={(e) => setDailyAmount(parseFloat(e.target.value) || 0)}
          className="w-24 rounded-xl border border-border bg-transparent px-3 py-2 text-base font-bold"
        />
        <span className="text-sm text-muted-foreground">por dia</span>
      </Card>

      {/* Missões obrigatórias */}
      <SectionLabel>Missões obrigatórias</SectionLabel>
      <Card>
        <p className="mb-3 text-xs text-muted-foreground">
          Marque os hábitos obrigatórios. Só ganha o valor quando <b>todos</b> forem concluídos no dia.
        </p>
        <div className="space-y-2">
          {habits.map((h) => {
            const req = cofrinho.requiredHabitIds.includes(h.id);
            const done = isDoneToday(h.lastDone);
            return (
              <button
                key={h.id}
                onClick={() => toggleRequiredHabit(h.id)}
                className="no-tap flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left"
                style={req ? { borderColor: "var(--primary)" } : { borderColor: "var(--border)" }}
              >
                <span className="text-xl">{h.icon}</span>
                <span className="flex-1 text-sm font-semibold">{h.name}</span>
                {req && done && <Check className="h-4 w-4 text-primary" strokeWidth={3} />}
                <span className="text-xs font-medium" style={{ color: req ? "var(--primary)" : "var(--muted-foreground)" }}>
                  {req ? "Obrigatório" : "Opcional"}
                </span>
              </button>
            );
          })}
        </div>
        {required.length > 0 && (
          <div
            className="mt-3 rounded-xl p-3 text-sm font-semibold"
            style={
              todayPerfect
                ? { background: "color-mix(in oklab, var(--primary) 18%, transparent)", color: "var(--primary)" }
                : { background: "var(--secondary)" }
            }
          >
            {todayPerfect
              ? `Dia perfeito! +${brl(cofrinho.dailyAmount)} no cofrinho 🎉`
              : `Hoje: ${doneCount}/${required.length} concluídos · faltam ${required.length - doneCount} para ganhar`}
          </div>
        )}
      </Card>

      {/* Missão da semana */}
      <SectionLabel>Missão principal da semana</SectionLabel>
      <WeeklyEditor weekly={weekly} setWeekly={setWeekly} setWeeklyProgress={setWeeklyProgress} />

      {/* Metas de recompensa */}
      <SectionLabel>Metas de recompensa</SectionLabel>
      <Card className="space-y-2">
        <div className="flex gap-2">
          <input
            value={goalName}
            onChange={(e) => setGoalName(e.target.value)}
            placeholder="Ex: Carta Pokémon"
            className="flex-1 rounded-xl border border-border bg-transparent px-3 py-2 text-sm"
          />
          <input
            value={goalTarget}
            onChange={(e) => setGoalTarget(e.target.value)}
            inputMode="decimal"
            placeholder="R$"
            className="w-20 rounded-xl border border-border bg-transparent px-3 py-2 text-sm"
          />
          <button onClick={addGoal} className="no-tap flex items-center justify-center rounded-xl bg-primary px-3 text-primary-foreground">
            <Plus className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>
      </Card>
      <div className="mt-3 space-y-3">
        {cofrinho.goals.length === 0 && (
          <p className="px-1 text-sm text-muted-foreground">Nenhuma meta ainda. Crie um objetivo acima.</p>
        )}
        {cofrinho.goals.map((g) => {
          const pct = Math.min(100, Math.round((cofrinho.balance / g.target) * 100));
          const ready = cofrinho.balance >= g.target;
          return (
            <Card key={g.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{g.name}</span>
                </div>
                <button onClick={() => deleteRewardGoal(g.id)} className="no-tap text-muted-foreground">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2">
                <Bar pct={pct} />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {brl(Math.min(cofrinho.balance, g.target))} / {brl(g.target)} · {pct}%
                </p>
              </div>
              <button
                onClick={() => redeem(g.name, g.target)}
                disabled={!ready}
                className="no-tap mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                <Gift className="h-4 w-4" /> {ready ? "Resgatar recompensa" : "Continue acumulando"}
              </button>
            </Card>
          );
        })}
      </div>

      {/* Histórico */}
      <SectionLabel>Histórico de recompensas</SectionLabel>
      <Card>
        {cofrinho.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma recompensa resgatada ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {cofrinho.history.map((h) => (
              <li key={h.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">{h.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.date + "T00:00:00").toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold">-{brl(h.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Disciplina vira recompensa. Use para hobbies e objetivos pessoais.
      </p>
    </main>
  );
}

function WeeklyEditor({
  weekly,
  setWeekly,
  setWeeklyProgress,
}: {
  weekly: ReturnType<typeof useStore.getState>["weekly"];
  setWeekly: (m: { label: string; target: number; unit: string } | null) => void;
  setWeeklyProgress: (n: number) => void;
}) {
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");

  if (weekly) {
    const info = missionInfo(weekly);
    return (
      <Card>
        <div className="flex items-center justify-between">
          <span className="font-semibold">{weekly.label}</span>
          <button onClick={() => setWeekly(null)} className="no-tap text-muted-foreground">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2">
          <Bar pct={info.pct} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {weekly.current} / {weekly.target} {weekly.unit} · {info.pct}%
          </p>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="capitalize">Prazo: {info.deadlineLabel}</span>
          <span
            style={{
              color: info.done
                ? "var(--primary)"
                : info.overdue
                ? "var(--danger)"
                : info.daysLeft <= 1
                ? "var(--warning)"
                : undefined,
            }}
          >
            {info.daysLeftLabel}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setWeeklyProgress(weekly.current - 1)}
            className="no-tap h-9 w-9 rounded-xl border border-border text-lg font-bold"
          >
            −
          </button>
          <input
            type="number"
            value={weekly.current}
            onChange={(e) => setWeeklyProgress(parseFloat(e.target.value) || 0)}
            className="w-20 rounded-xl border border-border bg-transparent px-3 py-2 text-center text-sm font-bold"
          />
          <button
            onClick={() => setWeeklyProgress(weekly.current + 1)}
            className="no-tap h-9 w-9 rounded-xl border border-border text-lg font-bold"
          >
            +
          </button>
          <span className="text-sm text-muted-foreground">{weekly.unit}</span>
        </div>
      </Card>
    );
  }


  return (
    <Card className="space-y-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Ex: 20 horas de estudo"
        className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          inputMode="decimal"
          placeholder="Meta (ex: 20)"
          className="flex-1 rounded-xl border border-border bg-transparent px-3 py-2 text-sm"
        />
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Unidade (horas)"
          className="flex-1 rounded-xl border border-border bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <label className="block text-xs text-muted-foreground">
        Prazo final
        <input
          type="date"
          value={deadline}
          min={todayKey()}
          onChange={(e) => setDeadline(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm text-foreground"
        />
      </label>
      <button
        onClick={() => {
          const t = parseFloat(target.replace(",", "."));
          if (!label.trim() || !t || t <= 0) {
            toast("Preencha o objetivo e a meta");
            return;
          }
          setWeekly({ label: label.trim(), target: t, unit: unit.trim() || "", deadline: deadline || endOfWeekKey() });
          setLabel("");
          setTarget("");
          setUnit("");
          setDeadline(endOfWeekKey());
          toast("Missão Principal criada 🔥");
        }}
        className="no-tap w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
      >
        Criar Missão Principal
      </button>
    </Card>

  );
}
