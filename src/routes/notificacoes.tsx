import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  BellRing,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Inbox,
  AlertTriangle,
  Trash2,
  Smartphone,
  ShieldCheck,
  PlayCircle,
  Globe,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import { useStore, type NotifKind } from "@/lib/store";
import { Card, PageTitle, SectionLabel } from "@/components/primitives";
import {
  currentPermission,
  requestNotificationPermission,
  fireNotification,
  scheduleNotification,
  cancelScheduled,
  getNotificationDiagnosticSnapshot,
} from "@/lib/notify";

export const Route = createFileRoute("/notificacoes")({
  head: () => ({ meta: [{ title: "Diagnóstico de Notificações — LevelUp" }] }),
  component: Diagnostico,
});

const KIND_META: Record<NotifKind, { label: string; color: string; icon: typeof Send }> = {
  permission: { label: "Permissão", color: "var(--cat-estudos)", icon: Bell },
  service_worker: { label: "Service Worker", color: "var(--secondary-foreground)", icon: ShieldCheck },
  sent: { label: "Enviada", color: "var(--cat-estudos)", icon: Send },
  triggered: { label: "Disparo", color: "var(--warning)", icon: PlayCircle },
  received: { label: "Recebida", color: "var(--primary)", icon: Inbox },
  error: { label: "Erro", color: "var(--danger)", icon: AlertTriangle },
  scheduled: { label: "Agendada", color: "var(--warning)", icon: Clock },
  cancelled: { label: "Cancelada", color: "var(--muted-foreground)", icon: XCircle },
};

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function Diagnostico() {
  const notifLog = useStore((s) => s.notifLog);
  const scheduled = useStore((s) => s.scheduled);
  const setNotifPermission = useStore((s) => s.setNotifPermission);
  const clearNotifLog = useStore((s) => s.clearNotifLog);

  const [perm, setPerm] = useState<string>("default");
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof getNotificationDiagnosticSnapshot>> | null>(null);
  const [testResult, setTestResult] = useState<string>("Nenhum teste executado ainda.");
  const [, setTick] = useState(0);

  useEffect(() => {
    async function loadSnapshot() {
      const p = currentPermission();
      setPerm(p);
      if (p !== "unsupported") setNotifPermission(p as NotificationPermission);
      setSnapshot(await getNotificationDiagnosticSnapshot());
    }
    void loadSnapshot();
  }, [setNotifPermission]);

  // refresh countdowns
  useEffect(() => {
    if (scheduled.length === 0) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [scheduled.length]);

  const lastSent = notifLog.find((e) => e.kind === "sent");
  const lastReceived = notifLog.find((e) => e.kind === "received");
  const lastError = notifLog.find((e) => e.kind === "error");

  async function ask() {
    const r = await requestNotificationPermission();
    setPerm(r);
    setSnapshot(await getNotificationDiagnosticSnapshot());
    if (r === "granted") {
      setNotifPermission("granted");
      const result = await fireNotification("Notificações ativadas!", "Tudo certo para receber lembretes.");
      setTestResult(result.message);
    } else if (r === "denied") {
      setTestResult("Permissão negada");
      toast("Permissão negada", { description: "Ative nas permissões do site no navegador/celular." });
    }
  }

  async function refreshStatus() {
    setSnapshot(await getNotificationDiagnosticSnapshot());
  }

  async function runNowTest() {
    const result = await fireNotification("Teste imediato ✅", "Se você viu isso, está funcionando!");
    setTestResult(result.ok ? result.message : `${result.message}${result.detail ? ` — ${result.detail}` : ""}`);
    await refreshStatus();
  }

  async function runScheduledTest(seconds: number) {
    scheduleNotification(`Teste ${seconds}s ⏱️`, `Notificação agendada há ${seconds} segundos.`, seconds * 1000);
    setTestResult(`Agendamento criado para ${seconds}s. Se o navegador suspender timers em segundo plano, isso aparecerá no log.`);
    toast(`Agendada para ${seconds}s`, { description: "Teste real criado." });
    await refreshStatus();
  }

  const permLabel =
    perm === "granted" ? "Concedida" : perm === "denied" ? "Negada" : perm === "unsupported" ? "Não suportada" : "Não solicitada";
  const permColor = perm === "granted" ? "var(--primary)" : perm === "denied" ? "var(--danger)" : "var(--warning)";

  return (
    <main className="px-4 pt-6">
      <Link to="/voce" className="no-tap mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <PageTitle title="Diagnóstico de notificações" subtitle="Status, testes e registros detalhados." />

      <Card className="space-y-3">
        <StatusLine icon={<Bell className="h-4 w-4" />} label="Permissão atual" value={permLabel} color={permColor} />
        <StatusLine icon={<BellRing className="h-4 w-4" />} label="Notification API" value={snapshot?.notificationApiAvailable ? "Sim" : "Não"} color={snapshot?.notificationApiAvailable ? "var(--primary)" : "var(--danger)"} />
        <StatusLine icon={<ShieldCheck className="h-4 w-4" />} label="Service Worker registrado" value={snapshot?.serviceWorkerRegistered ? `Sim · ${snapshot.serviceWorkerState}` : "Não"} color={snapshot?.serviceWorkerRegistered ? "var(--primary)" : "var(--danger)"} />
        <StatusLine icon={<Bot className="h-4 w-4" />} label="Push Manager" value={snapshot?.pushManagerAvailable ? "Disponível" : "Indisponível"} color={snapshot?.pushManagerAvailable ? "var(--primary)" : "var(--warning)"} />
        <StatusLine icon={<Smartphone className="h-4 w-4" />} label="Status da PWA" value={snapshot?.pwaStatus === "standalone" ? "Instalada / standalone" : "Navegador"} color={snapshot?.pwaStatus === "standalone" ? "var(--primary)" : "var(--warning)"} />
        <StatusLine icon={<Globe className="h-4 w-4" />} label="Navegador detectado" value={snapshot?.browser ?? "—"} />
        <StatusLine icon={<Smartphone className="h-4 w-4" />} label="Sistema operacional" value={snapshot?.os ?? "—"} />
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" style={{ color: permColor }} />
            <span className="text-sm font-semibold">Permissão</span>
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs font-bold"
            style={{ background: `color-mix(in oklab, ${permColor} 18%, transparent)`, color: permColor }}
          >
            {permLabel}
          </span>
        </div>
        {perm !== "granted" && perm !== "unsupported" && (
          <button onClick={ask} className="no-tap mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">
            Permitir notificações
          </button>
        )}
        {perm === "denied" && (
          <p className="mt-2 text-xs text-muted-foreground">
            Bloqueadas pelo navegador. Abra as permissões do site e ative as notificações manualmente.
          </p>
        )}
        <button onClick={refreshStatus} className="no-tap mt-3 w-full rounded-xl border border-border py-2.5 text-sm font-bold">
          Atualizar diagnóstico
        </button>
      </Card>

      {/* Last events summary */}
      <SectionLabel>Resumo</SectionLabel>
      <div className="grid grid-cols-1 gap-2">
        <StatRow icon={<Send className="h-4 w-4" />} label="Última enviada" value={lastSent ? `${lastSent.title} · ${fmtTime(lastSent.at)}` : "—"} />
        <StatRow icon={<Inbox className="h-4 w-4" />} label="Última recebida" value={lastReceived ? `${lastReceived.title} · ${fmtTime(lastReceived.at)}` : "—"} color="var(--primary)" />
        <StatRow icon={<AlertTriangle className="h-4 w-4" />} label="Último erro" value={lastError ? `${lastError.detail ?? lastError.title} · ${fmtTime(lastError.at)}` : "Nenhum"} color={lastError ? "var(--danger)" : undefined} />
        <StatRow icon={<PlayCircle className="h-4 w-4" />} label="Resultado real do teste" value={testResult} color="var(--warning)" />
      </div>

      {/* Tests */}
      <SectionLabel>Testes</SectionLabel>
      <div className="grid grid-cols-1 gap-2">
        <button
          onClick={() => void runNowTest()}
          className="no-tap flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
        >
          <BellRing className="h-4 w-4" /> Testar agora
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => void runScheduledTest(10)}
            className="no-tap flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-bold"
          >
            <Clock className="h-4 w-4" /> Em 10s
          </button>
          <button
            onClick={() => void runScheduledTest(30)}
            className="no-tap flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-bold"
          >
            <Clock className="h-4 w-4" /> Em 30s
          </button>
        </div>
      </div>

      {/* Scheduled */}
      <SectionLabel>Agendadas ({scheduled.length})</SectionLabel>
      {scheduled.length === 0 ? (
        <Card className="text-center text-sm text-muted-foreground">Nenhuma notificação agendada.</Card>
      ) : (
        <div className="space-y-2">
          {scheduled.map((s) => {
            const left = Math.max(0, Math.round((s.fireAt - Date.now()) / 1000));
            return (
              <Card key={s.id} className="flex items-center gap-3 p-3">
                <Clock className="h-4 w-4 text-warning" style={{ color: "var(--warning)" }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="text-xs text-muted-foreground">dispara em {left}s</p>
                </div>
                <button onClick={() => cancelScheduled(s.id)} className="no-tap p-1 text-muted-foreground">
                  <Trash2 className="h-4 w-4" />
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Log */}
      <div className="mb-2 mt-6 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Registro detalhado</h2>
        {notifLog.length > 0 && (
          <button onClick={clearNotifLog} className="no-tap text-xs text-muted-foreground underline">
            Limpar
          </button>
        )}
      </div>
      {notifLog.length === 0 ? (
        <Card className="text-center text-sm text-muted-foreground">Sem registros ainda. Faça um teste acima.</Card>
      ) : (
        <Card className="space-y-2 p-3">
          {notifLog.map((e) => {
            const meta = KIND_META[e.kind];
            const Icon = meta.icon;
            return (
              <div key={e.id} className="flex items-start gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: meta.color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <span className="font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                    <span className="text-muted-foreground"> · {fmtTime(e.at)}</span>
                  </p>
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  {e.detail && <p className="truncate text-xs text-muted-foreground">{e.detail}</p>}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Card className="mt-4 border-warning/40" style={{ borderColor: "color-mix(in oklab, var(--warning) 40%, transparent)" }}>
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--warning)" }} />
          <p className="text-xs text-muted-foreground">
            Problema encontrado: o app usava <strong>new Notification()</strong>, que não é o caminho compatível no Chrome Android.
            Correção aplicada: agora o app usa <strong>ServiceWorkerRegistration.showNotification()</strong> e valida Service Worker ativo.
            Resultado: testes imediatos passam a usar o fluxo compatível com Android; testes agendados ainda dependem de timers locais,
            então podem falhar se o navegador suspender o app em segundo plano.
          </p>
        </div>
      </Card>

      <div className="h-6" />
    </main>
  );
}

function StatRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary" style={color ? { color } : undefined}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold" style={color ? { color } : undefined}>{value}</p>
      </div>
    </Card>
  );
}

function StatusLine({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-secondary p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-background" style={color ? { color } : undefined}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold" style={color ? { color } : undefined}>{value}</p>
      </div>
    </div>
  );
}
