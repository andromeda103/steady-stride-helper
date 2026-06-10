import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  PiggyBank, Target, Gift, Trash2, Check, Plus, Trophy, CalendarCheck, Coins,
  Save, FlaskConical, CheckCircle2, XCircle, TrendingUp, TrendingDown, Flame,
  ScrollText, BookOpen, Dumbbell, ListChecks, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Card, PageTitle, Bar, SectionLabel } from "@/components/primitives";
import { todayKey, endOfWeekKey } from "@/lib/dates";
import { missionInfo } from "@/lib/mission";
import { computeDayStatus, cofrinhoStats, brl } from "@/lib/cofrinho";

export const Route = createFileRoute("/cofrinho")({
  head: () => ({ meta: [{ title: "Cofrinho — LevelUp" }] }),
  component: Cofrinho,
});

function fmtDate(key: string) {
  return new Date(key + "T00:00:00").toLocaleDateString("pt-BR");
}

function Cofrinho() {
  const habits = useStore((s) => s.habits);
  const tasks = useStore((s) => s.tasks);
  const studyLog = useStore((s) => s.studyLog);
  const workoutLog = useStore((s) => s.workoutLog);
  const cofrinho = useStore((s) => s.cofrinho);
  const weekly = useStore((s) => s.weekly);
  const setDailyAmount = useStore((s) => s.setDailyAmount);
  const toggleRequiredHabit = useStore((s) => s.toggleRequiredHabit);
  const toggleRequiredTask = useStore((s) => s.toggleRequiredTask);
  const setMinStudyMinutes = useStore((s) => s.setMinStudyMinutes);
  const setRequireWorkout = useStore((s) => s.setRequireWorkout);
  const recomputeCofrinho = useStore((s) => s.recomputeCofrinho);
  const addRewardGoal = useStore((s) => s.addRewardGoal);
  const deleteRewardGoal = useStore((s) => s.deleteRewardGoal);
  const redeemReward = useStore((s) => s.redeemReward);
  const setWeekly = useStore((s) => s.setWeekly);
  const setWeeklyProgress = useStore((s) => s.setWeeklyProgress);

  useEffect(() => {
    recomputeCofrinho();
  }, [recomputeCofrinho]);

  const status = useMemo(
    () => computeDayStatus(cofrinho, habits, tasks, studyLog, workoutLog),
    [cofrinho, habits, tasks, studyLog, workoutLog],
  );
  const stats = useMemo(() => cofrinhoStats(cofrinho), [cofrinho]);

  // ------- Config de recompensa (salvar explícito) -------
  const [amountInput, setAmountInput] = useState(String(cofrinho.dailyAmount));
  useEffect(() => setAmountInput(String(cofrinho.dailyAmount)), [cofrinho.dailyAmount]);

  function saveAmount() {
    const v = parseFloat(amountInput.replace(",", "."));
    if (isNaN(v) || v < 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setDailyAmount(v);
    toast.success("✅ Recompensa salva com sucesso", { description: `${brl(v)} por dia perfeito` });
  }

  // ------- Área de teste (não altera dados reais) -------
  const [testResult, setTestResult] = useState<string | null>(null);
  function runTest() {
    const v = parseFloat(amountInput.replace(",", ".")) || cofrinho.dailyAmount;
    setTestResult(`Simulação de dia perfeito: +${brl(v)} seriam adicionados ao cofrinho.`);
    toast.success(`${brl(v)} adicionados (simulação)`, { description: "Nenhum dado real foi alterado." });
  }

  // ------- Metas / compras -------
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
    toast.success("Meta criada 🎯");
  }
  function redeem(name: string, amount: number) {
    if (amount > cofrinho.balance) {
      toast.error("Saldo insuficiente", { description: "Continue acumulando dias perfeitos." });
      return;
    }
    redeemReward(name, amount);
    toast.success("Recompensa resgatada! 🎁", { description: `${name} · ${brl(amount)}` });
  }

  // visual: quantidade de moedas proporcional ao saldo
  const coinCount = Math.min(40, Math.max(0, Math.floor(cofrinho.balance / 10)));

  return (
    <main className="px-4 pt-6 pb-12">
      <PageTitle title="Cofrinho" subtitle="Disciplina transparente: veja exatamente como a recompensa é calculada." />

      {/* Saldo + cofrinho visual */}
      <Card className="relative overflow-hidden">
        <div className="flex items-center gap-3">
          <span
            className="flex items-center justify-center rounded-2xl bg-primary/15 transition-all"
            style={{ height: 56 + Math.min(24, coinCount), width: 56 + Math.min(24, coinCount) }}
          >
            <PiggyBank className="text-primary" style={{ height: 28 + Math.min(14, coinCount / 2), width: 28 + Math.min(14, coinCount / 2) }} />
          </span>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Saldo acumulado</p>
            <p className="font-display text-3xl font-bold">{brl(cofrinho.balance)}</p>
          </div>
        </div>
        {coinCount > 0 && (
          <div className="mt-3 flex flex-wrap gap-0.5 text-base leading-none" aria-hidden>
            {Array.from({ length: coinCount }).map((_, i) => (
              <span key={i} className="animate-in fade-in" style={{ animationDelay: `${i * 20}ms` }}>🪙</span>
            ))}
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-secondary p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Coins className="h-4 w-4" /> Ganho no mês</div>
            <p className="mt-1 font-display text-lg font-bold">{brl(stats.earnedThisMonth)}</p>
          </div>
          <div className="rounded-xl bg-secondary p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarCheck className="h-4 w-4" /> Dias perfeitos</div>
            <p className="mt-1 font-display text-lg font-bold">{cofrinho.perfectDays.length}</p>
          </div>
        </div>
      </Card>

      {/* Estatísticas */}
      <SectionLabel>Estatísticas</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Total acumulado" value={brl(stats.totalEarned)} color="var(--primary)" />
        <StatCard icon={<TrendingDown className="h-4 w-4" />} label="Total gasto" value={brl(stats.totalSpent)} color="var(--danger)" />
        <StatCard icon={<Flame className="h-4 w-4" />} label="Maior sequência" value={`${stats.longestStreak} dias`} />
        <StatCard icon={<Coins className="h-4 w-4" />} label="Economizado no mês" value={brl(stats.earnedThisMonth)} />
      </div>

      {/* Status do dia (diagnóstico) */}
      <SectionLabel>Status do dia</SectionLabel>
      <Card>
        {!status.active ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma exigência configurada ainda. Defina abaixo o que é necessário para liberar a recompensa diária.
          </p>
        ) : (
          <div className="space-y-2.5">
            {status.habits.active && (
              <DiagRow icon={<ListChecks className="h-4 w-4" />} label="Hábitos" value={`${status.habits.done}/${status.habits.total}`} ok={status.habits.ok} />
            )}
            {status.tasks.active && (
              <DiagRow icon={<Check className="h-4 w-4" />} label="Tarefas" value={`${status.tasks.done}/${status.tasks.total}`} ok={status.tasks.ok} />
            )}
            {status.study.active && (
              <DiagRow icon={<BookOpen className="h-4 w-4" />} label="Estudo" value={`${status.study.done}/${status.study.total} min`} ok={status.study.ok} />
            )}
            {status.workout.active && (
              <DiagRow icon={<Dumbbell className="h-4 w-4" />} label="Treino" value={status.workout.done ? "Concluído" : "Pendente"} ok={status.workout.ok} />
            )}
          </div>
        )}
        <div
          className="mt-3 flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold"
          style={
            status.perfect
              ? { background: "color-mix(in oklab, var(--primary) 18%, transparent)", color: "var(--primary)" }
              : { background: "var(--secondary)", color: "var(--muted-foreground)" }
          }
        >
          <span>Recompensa</span>
          <span className="flex items-center gap-1.5">
            {status.perfect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {status.perfect ? `LIBERADA · +${brl(cofrinho.dailyAmount)}` : "PENDENTE"}
          </span>
        </div>
      </Card>

      {/* Configuração de recompensa */}
      <SectionLabel>Configuração de recompensa</SectionLabel>
      <Card className="space-y-3">
        <label className="block text-xs text-muted-foreground">Valor por dia perfeito</label>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">R$</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder="10,00"
            className="w-28 rounded-xl border border-border bg-transparent px-3 py-2 text-base font-bold"
          />
          <span className="text-sm text-muted-foreground">por dia</span>
        </div>
        <button
          onClick={saveAmount}
          className="no-tap flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
        >
          <Save className="h-4 w-4" /> Salvar recompensa
        </button>
      </Card>

      {/* Área de teste */}
      <SectionLabel>Área de teste</SectionLabel>
      <Card className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Simula um dia perfeito para verificar o cálculo. <b>Não altera</b> seus dados reais.
        </p>
        <button
          onClick={runTest}
          className="no-tap flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-bold"
        >
          <FlaskConical className="h-4 w-4" /> Testar sistema
        </button>
        {testResult && (
          <div className="rounded-xl bg-secondary p-3 text-sm font-medium text-foreground">{testResult}</div>
        )}
      </Card>

      {/* Regras / requisitos */}
      <SectionLabel>Regras para ganhar a recompensa</SectionLabel>
      <Card className="space-y-1.5">
        <p className="mb-1 text-xs text-muted-foreground">Para ganhar a recompensa diária é necessário:</p>
        <RuleLine on={status.habits.active} text="Concluir os hábitos obrigatórios" />
        <RuleLine on={status.tasks.active} text="Concluir as tarefas obrigatórias" />
        <RuleLine on={status.study.active} text={`Concluir o estudo mínimo${cofrinho.minStudyMinutes ? ` (${cofrinho.minStudyMinutes} min)` : ""}`} />
        <RuleLine on={status.workout.active} text="Concluir o treino do dia (quando exigido)" />
      </Card>

      {/* Hábitos obrigatórios */}
      <SectionLabel>Hábitos obrigatórios</SectionLabel>
      <Card>
        <div className="space-y-2">
          {habits.length === 0 && <p className="text-sm text-muted-foreground">Nenhum hábito cadastrado.</p>}
          {habits.map((h) => {
            const req = cofrinho.requiredHabitIds.includes(h.id);
            const done = (h.logByDay?.[todayKey()] ?? 0) >= h.target && h.target > 0;
            return (
              <button
                key={h.id}
                onClick={() => toggleRequiredHabit(h.id)}
                className="no-tap flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left"
                style={{ borderColor: req ? "var(--primary)" : "var(--border)" }}
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
      </Card>

      {/* Tarefas obrigatórias */}
      <SectionLabel>Tarefas obrigatórias</SectionLabel>
      <Card>
        <div className="space-y-2">
          {tasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa cadastrada.</p>}
          {tasks.map((t) => {
            const req = (cofrinho.requiredTaskIds ?? []).includes(t.id);
            const done = t.lastDone === todayKey();
            return (
              <button
                key={t.id}
                onClick={() => toggleRequiredTask(t.id)}
                className="no-tap flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left"
                style={{ borderColor: req ? "var(--primary)" : "var(--border)" }}
              >
                <span className="flex-1 text-sm font-semibold">{t.name}</span>
                {req && done && <Check className="h-4 w-4 text-primary" strokeWidth={3} />}
                <span className="text-xs font-medium" style={{ color: req ? "var(--primary)" : "var(--muted-foreground)" }}>
                  {req ? "Obrigatória" : "Opcional"}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Estudo mínimo + treino */}
      <SectionLabel>Estudo & treino</SectionLabel>
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-sm font-semibold">Estudo mínimo</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={cofrinho.minStudyMinutes || ""}
            onChange={(e) => setMinStudyMinutes(parseInt(e.target.value) || 0)}
            placeholder="0"
            className="w-20 rounded-xl border border-border bg-transparent px-3 py-2 text-center text-sm font-bold"
          />
          <span className="text-sm text-muted-foreground">min</span>
        </div>
        <button
          onClick={() => setRequireWorkout(!cofrinho.requireWorkout)}
          className="no-tap flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left"
          style={{ borderColor: cofrinho.requireWorkout ? "var(--primary)" : "var(--border)" }}
        >
          <Dumbbell className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-sm font-semibold">Exigir treino do dia</span>
          <span className="text-xs font-medium" style={{ color: cofrinho.requireWorkout ? "var(--primary)" : "var(--muted-foreground)" }}>
            {cofrinho.requireWorkout ? "Exigido" : "Não exigido"}
          </span>
        </button>
      </Card>

      {/* Missão da semana */}
      <SectionLabel>Missão principal da semana</SectionLabel>
      <WeeklyEditor weekly={weekly} setWeekly={setWeekly} setWeeklyProgress={setWeeklyProgress} />

      {/* Metas de compra / recompensa */}
      <SectionLabel>Metas de compra</SectionLabel>
      <Card className="space-y-2">
        <div className="flex gap-2">
          <input
            value={goalName}
            onChange={(e) => setGoalName(e.target.value)}
            placeholder="Ex: Mouse Gamer"
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
          const missing = Math.max(0, g.target - cofrinho.balance);
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
                <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{brl(Math.min(cofrinho.balance, g.target))} / {brl(g.target)} · {pct}%</span>
                  <span style={{ color: ready ? "var(--primary)" : undefined }}>
                    {ready ? "Pronto! 🎉" : `Faltam ${brl(missing)}`}
                  </span>
                </div>
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

      {/* Histórico financeiro */}
      <SectionLabel>Histórico financeiro</SectionLabel>
      <Card>
        {cofrinho.ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lançamento ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {cofrinho.ledger.slice(0, 50).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{e.reason}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(e.date)}</p>
                </div>
                <span
                  className="shrink-0 text-sm font-bold"
                  style={{ color: e.amount >= 0 ? "var(--primary)" : "var(--danger)" }}
                >
                  {e.amount >= 0 ? "+" : "−"}{brl(Math.abs(e.amount)).replace("R$ ", "")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Log de eventos / auditoria */}
      <SectionLabel>Log de eventos</SectionLabel>
      <Card>
        {cofrinho.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {cofrinho.events.slice(0, 40).map((ev) => (
              <li key={ev.id} className="flex items-start gap-2 text-sm">
                <EventIcon kind={ev.kind} />
                <div className="min-w-0">
                  <p className="text-foreground">{ev.detail}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(ev.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
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

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon} {label}</div>
      <p className="mt-1 font-display text-lg font-bold" style={color ? { color } : undefined}>{value}</p>
    </Card>
  );
}

function DiagRow({ icon, label, value, ok }: { icon: React.ReactNode; label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className="text-sm font-bold tabular-nums">{value}</span>
      {ok ? (
        <CheckCircle2 className="h-4 w-4" style={{ color: "var(--primary)" }} />
      ) : (
        <XCircle className="h-4 w-4" style={{ color: "var(--warning)" }} />
      )}
    </div>
  );
}

function RuleLine({ on, text }: { on: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm" style={{ color: on ? "var(--foreground)" : "var(--muted-foreground)" }}>
      {on ? <Sparkles className="h-3.5 w-3.5 text-primary" /> : <span className="inline-block h-3.5 w-3.5 rounded-full border border-border" />}
      <span className={on ? "" : "line-through opacity-60"}>{text}</span>
    </div>
  );
}

function EventIcon({ kind }: { kind: string }) {
  const map: Record<string, { Icon: typeof Coins; color: string }> = {
    earned: { Icon: TrendingUp, color: "var(--primary)" },
    lost: { Icon: TrendingDown, color: "var(--warning)" },
    purchase: { Icon: Gift, color: "var(--danger)" },
    amount_changed: { Icon: Save, color: "var(--muted-foreground)" },
    config: { Icon: ListChecks, color: "var(--muted-foreground)" },
    test: { Icon: FlaskConical, color: "var(--muted-foreground)" },
  };
  const { Icon, color } = map[kind] ?? { Icon: ScrollText, color: "var(--muted-foreground)" };
  return <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />;
}

function WeeklyEditor({
  weekly,
  setWeekly,
  setWeeklyProgress,
}: {
  weekly: ReturnType<typeof useStore.getState>["weekly"];
  setWeekly: (m: { label: string; target: number; unit: string; deadline?: string } | null) => void;
  setWeeklyProgress: (n: number) => void;
}) {
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [deadline, setDeadline] = useState(endOfWeekKey());

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
          toast.success("Missão Principal criada 🔥");
        }}
        className="no-tap w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
      >
        Criar Missão Principal
      </button>
    </Card>
  );
}
