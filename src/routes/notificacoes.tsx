import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useStore, type NotifKind } from "@/lib/store";
import { Card, PageTitle, SectionLabel } from "@/components/primitives";
import { cancelScheduled, getNotificationDiagnosticSnapshot } from "@/lib/notify";
import {
  notificationService,
  getNotificationRuntime,
  getNativePluginStatus,
  requestNotificationPermission,
  type NativePluginStatus,
} from "@/lib/notification-service";
import {
  NOTIFICATION_DIAGNOSTIC_VERSION,
  NOTIFICATION_DIAGNOSTIC_BUILD,
  runNativeNotificationSmokeTest,
  runNativeTest10s,
  runNativeTest60s,
  getSmokeLog,
  type SmokeReport,
  type SmokeLogEntry,
} from "@/lib/native-notify-smoke";

const NOT_VERIFIED = "Não verificado";

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

/** Tri-state value: true → "Sim", false → "Não", null → "Não verificado". */
function triLabel(v: boolean | null | undefined): string {
  if (v === null || v === undefined) return NOT_VERIFIED;
  return v ? "Sim" : "Não";
}

function Diagnostico() {
  const notifLog = useStore((s) => s.notifLog);
  const scheduled = useStore((s) => s.scheduled);
  const setNotifPermission = useStore((s) => s.setNotifPermission);
  const clearNotifLog = useStore((s) => s.clearNotifLog);

  // Live runtime (re-read on demand, never cached at module scope).
  const [runtime, setRuntime] = useState(() => getNotificationRuntime());
  const isNative = runtime.native;
  const methodLabel = isNative ? "Capacitor Local Notifications" : "Web Notifications / Service Worker";
  const envLabel = isNative ? `APK ${runtime.platform === "ios" ? "iOS" : "Android"} (Capacitor)` : "Navegador / PWA";

  const [perm, setPerm] = useState<string>(NOT_VERIFIED);
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof getNotificationDiagnosticSnapshot>> | null>(null);
  const [nativeStatus, setNativeStatus] = useState<NativePluginStatus | null>(null);
  const [testResult, setTestResult] = useState<string>("Nenhum teste executado.");

  // --- Unified diagnostic state (native-v8-unified) ---
  const [smoke, setSmoke] = useState<SmokeReport | null>(null);
  const [smokeLog, setSmokeLog] = useState<SmokeLogEntry[]>([]);
  const [pointerCount, setPointerCount] = useState(0);
  const [clickCount, setClickCount] = useState(0);
  const [lastButton, setLastButton] = useState<string>(NOT_VERIFIED);
  const [clickedAt, setClickedAt] = useState<number | null>(null);
  const [currentStage, setCurrentStage] = useState<string>("idle");
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  /** Pointer reached the element (proves the touch was not swallowed). */
  function capturePointer(button: string) {
    setPointerCount((c) => c + 1);
    // eslint-disable-next-line no-console
    console.log("[LEVELUP-NOTIFY] pointerdown", { button, at: new Date().toISOString() });
  }

  /** Capture the click IMMEDIATELY (before any await) so the UI reacts at once. */
  function captureClick(button: string) {
    setClickCount((c) => c + 1);
    setLastButton(button);
    setClickedAt(Date.now());
    setCurrentStage(`click-captured: ${button}`);
    setBusy(true);
    // eslint-disable-next-line no-console
    console.log("[LEVELUP-NOTIFY] click", {
      button,
      native: runtime.native,
      platform: runtime.platform,
      at: new Date().toISOString(),
    });
  }

  function applyReport(report: SmokeReport) {
    setSmoke(report);
    setSmokeLog(getSmokeLog());
    setCurrentStage(
      report.error ? `erro: ${report.error.message}` : report.foundInPending ? "agendado (pendente)" : "concluído",
    );
    setTestResult(
      report.error
        ? `❌ ${report.error.message}`
        : report.foundInPending
          ? `✅ ID ${report.notificationId} agendado — deve aparecer em instantes.`
          : `⚠️ schedule() rodou mas ID ${report.notificationId} não apareceu em getPending().`,
    );
    if (report.permissionAfter) setPerm(report.permissionAfter === "prompt" ? "default" : report.permissionAfter);
  }

  // Initial snapshot — does NOT auto-request permission.
  useEffect(() => {
    let active = true;
    async function loadSnapshot() {
      const rt = getNotificationRuntime();
      if (!active) return;
      setRuntime(rt);
      try {
        const p = await notificationService.currentPermission();
        if (!active) return;
        setPerm(p);
        if (p !== "unsupported") setNotifPermission(p as NotificationPermission);
      } catch {
        /* surfaced via lastError */
      }
      try {
        const snap = await getNotificationDiagnosticSnapshot();
        if (active) setSnapshot(snap);
      } catch {
        /* ignore */
      }
      try {
        const ns = await getNativePluginStatus();
        if (active) setNativeStatus(ns);
      } catch {
        /* ignore */
      }
      if (active) setSmokeLog(getSmokeLog());
    }
    void loadSnapshot();
    return () => {
      active = false;
    };
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

  /** Manual refresh (button only) — never auto-runs after a test. */
  async function refreshStatus() {
    captureClick("Atualizar diagnóstico");
    try {
      setRuntime(getNotificationRuntime());
      setPerm(await notificationService.currentPermission());
      setSnapshot(await getNotificationDiagnosticSnapshot());
      setNativeStatus(await getNativePluginStatus());
      setSmokeLog(getSmokeLog());
      setCurrentStage("diagnóstico atualizado");
    } finally {
      setBusy(false);
    }
  }

  async function ask() {
    captureClick("Permitir notificações");
    try {
      if (runtime.native) {
        const r = await requestNotificationPermission();
        setSmokeLog(getSmokeLog());
        setPerm(r);
        if (r === "granted") {
          setNotifPermission("granted");
          setTestResult("✅ Permissão concedida. Use 'Testar agora' para disparar a notificação.");
        } else if (r === "denied") {
          setTestResult("Permissão negada — ative manualmente nas configurações do app.");
          toast("Permissão negada", { description: "Ative nas configurações do app." });
        } else {
          setTestResult(`Permissão: ${r}`);
        }
        setCurrentStage(`permissão (nativa): ${r}`);
      } else {
        const r = await notificationService.requestPermission();
        setPerm(r);
        setSnapshot(await getNotificationDiagnosticSnapshot());
        if (r === "granted") {
          setNotifPermission("granted");
          const result = await notificationService.notify("Notificações ativadas!", "Tudo certo para receber lembretes.");
          setTestResult(result.message);
        } else if (r === "denied") {
          setTestResult("Permissão negada");
          toast("Permissão negada", { description: "Ative nas permissões do site." });
        } else if (r === "unsupported") {
          setTestResult("Este navegador não suporta notificações web.");
        }
        setCurrentStage(`permissão (web): ${r}`);
      }
    } finally {
      setBusy(false);
    }
  }

  /** Direct native smoke test — bypasses store/legacy, surfaces the real report. */
  async function runNowTest() {
    captureClick("Testar agora");
    try {
      if (runtime.native) {
        const report = await runNativeNotificationSmokeTest();
        applyReport(report);
      } else {
        const result = await notificationService.notify("Teste imediato ✅", "Se você viu isso, está funcionando!");
        setTestResult(result.ok ? result.message : `${result.message}${result.detail ? ` — ${result.detail}` : ""}`);
        setCurrentStage("teste web concluído");
      }
    } finally {
      setBusy(false);
    }
  }

  async function runScheduledTest(seconds: number) {
    captureClick(`Em ${seconds === 60 ? "1 min" : `${seconds}s`}`);
    try {
      if (runtime.native) {
        const report = seconds === 60 ? await runNativeTest60s() : await runNativeTest10s();
        applyReport(report);
      } else {
        await notificationService.schedule(`Teste ${seconds}s ⏱️`, `Notificação agendada há ${seconds} segundos.`, seconds * 1000);
        setTestResult(`Agendamento criado para ${seconds}s usando ${methodLabel}.`);
        toast(`Agendada para ${seconds}s`, { description: "Teste real criado." });
        setCurrentStage(`agendamento web ${seconds}s`);
      }
    } finally {
      setBusy(false);
    }
  }

  const selectedMethodLabel = isNative ? "native" : "web";
  const permLabel =
    perm === "granted"
      ? "Concedida"
      : perm === "denied"
        ? "Negada"
        : perm === "unsupported"
          ? "Não suportada"
          : perm === NOT_VERIFIED
            ? NOT_VERIFIED
            : "Não solicitada";
  const permColor = perm === "granted" ? "var(--primary)" : perm === "denied" ? "var(--danger)" : "var(--warning)";

  return (
    <main className="px-4 pt-6">
      <Link to="/voce" className="no-tap mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <PageTitle title="Diagnóstico de notificações" subtitle="Status, testes e registros detalhados." />

      {/* ===== Identificação ESTÁTICA da versão empacotada (sempre visível) ===== */}
      <div
        className="mb-3 rounded-xl border p-3"
        style={{
          borderColor: "color-mix(in oklab, var(--primary) 45%, transparent)",
          background: "color-mix(in oklab, var(--primary) 10%, transparent)",
        }}
      >
        <p className="text-sm font-extrabold" style={{ color: "var(--primary)" }}>
          BUILD: {NOTIFICATION_DIAGNOSTIC_VERSION}
        </p>
        <p className="text-xs text-muted-foreground">Código gerado em: {NOTIFICATION_DIAGNOSTIC_BUILD}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Antes de testar, confirme que o topo mostra <b>BUILD: {NOTIFICATION_DIAGNOSTIC_VERSION}</b>. Se uma versão
          anterior aparecer, o APK instalado está desatualizado.
        </p>
      </div>



      {/* ===== Botão nativo mínimo (HTML puro, sem design system) ===== */}
      <button
        type="button"
        onPointerDown={() => capturePointer("teste-nativo-direto")}
        onClick={() => void runNowTest()}
        style={{
          position: "relative",
          zIndex: 100,
          pointerEvents: "auto",
          touchAction: "manipulation",
          width: "100%",
          minHeight: "64px",
          marginBottom: "12px",
          borderRadius: "14px",
          fontWeight: 800,
          fontSize: "15px",
          color: "var(--primary-foreground)",
          background: "var(--primary)",
        }}
      >
        EXECUTAR TESTE NATIVO DIRETO
      </button>

      {/* ===== Diagnóstico unificado (native-v8-unified) ===== */}
      <Card className="space-y-3" style={{ borderColor: "color-mix(in oklab, var(--primary) 45%, transparent)" }}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">Diagnóstico unificado</span>
          <span
            className="rounded-full px-3 py-1 text-xs font-bold"
            style={{ background: "color-mix(in oklab, var(--primary) 18%, transparent)", color: "var(--primary)" }}
          >
            {NOTIFICATION_DIAGNOSTIC_VERSION}
          </span>
        </div>

        <StatusLine
          icon={<PlayCircle className="h-4 w-4" />}
          label="pointerDown recebido"
          value={pointerCount > 0 ? `Sim (${pointerCount})` : NOT_VERIFIED}
          color={pointerCount > 0 ? "var(--primary)" : "var(--warning)"}
        />
        <StatusLine
          icon={<PlayCircle className="h-4 w-4" />}
          label="click recebido"
          value={clickCount > 0 ? `Sim (${clickCount})` : NOT_VERIFIED}
          color={clickCount > 0 ? "var(--primary)" : "var(--warning)"}
        />
        <StatusLine icon={<Info className="h-4 w-4" />} label="clickCount" value={String(clickCount)} />
        <StatusLine icon={<Info className="h-4 w-4" />} label="último botão" value={lastButton} />
        <StatusLine icon={<Clock className="h-4 w-4" />} label="horário do clique" value={clickedAt ? fmtTime(clickedAt) : NOT_VERIFIED} />
        <StatusLine
          icon={<Smartphone className="h-4 w-4" />}
          label="native atual"
          value={runtime.native ? "true" : "false"}
          color={runtime.native ? "var(--primary)" : "var(--danger)"}
        />
        <StatusLine icon={<Smartphone className="h-4 w-4" />} label="platform atual" value={runtime.platform} color={runtime.platform === "android" ? "var(--primary)" : undefined} />
        <StatusLine icon={<Bot className="h-4 w-4" />} label="plugin reportado (isPluginAvailable)" value={runtime.pluginReportedAvailable ? "true" : "false"} />
        <StatusLine
          icon={<BellRing className="h-4 w-4" />}
          label="método selecionado"
          value={selectedMethodLabel}
          color={selectedMethodLabel === "native" ? "var(--primary)" : "var(--warning)"}
        />
        <StatusLine icon={<Bot className="h-4 w-4" />} label="plugin importado" value={triLabel(smoke ? smoke.pluginImported : null)} color={smoke?.pluginImported ? "var(--primary)" : smoke ? "var(--danger)" : undefined} />
        <StatusLine icon={<Bell className="h-4 w-4" />} label="permissionBefore" value={smoke?.permissionBefore ?? NOT_VERIFIED} />
        <StatusLine icon={<Bell className="h-4 w-4" />} label="permissionRequested" value={smoke?.permissionRequested ?? NOT_VERIFIED} />
        <StatusLine icon={<ShieldCheck className="h-4 w-4" />} label="permissionAfter" value={smoke?.permissionAfter ?? NOT_VERIFIED} color={smoke?.permissionAfter === "granted" ? "var(--primary)" : smoke?.permissionAfter ? "var(--danger)" : undefined} />
        <StatusLine icon={<ShieldCheck className="h-4 w-4" />} label="canal criado" value={triLabel(smoke ? smoke.channelCreated : null)} color={smoke?.channelCreated ? "var(--primary)" : undefined} />
        <StatusLine icon={<Send className="h-4 w-4" />} label="schedule resolvido" value={triLabel(smoke ? smoke.scheduleResolved : null)} color={smoke?.scheduleResolved ? "var(--primary)" : undefined} />
        <StatusLine icon={<Info className="h-4 w-4" />} label="ID do teste" value={smoke ? String(smoke.notificationId) : NOT_VERIFIED} />
        <StatusLine icon={<Clock className="h-4 w-4" />} label="scheduledAt" value={smoke?.scheduledAt ? fmtTime(new Date(smoke.scheduledAt).getTime()) : NOT_VERIFIED} />
        <StatusLine icon={<Inbox className="h-4 w-4" />} label="pending IDs" value={smoke ? (smoke.pendingIds.length ? smoke.pendingIds.join(", ") : "nenhum") : NOT_VERIFIED} />
        <StatusLine icon={<CheckCircle2 className="h-4 w-4" />} label="foundInPending" value={triLabel(smoke ? smoke.foundInPending : null)} color={smoke?.foundInPending ? "var(--primary)" : smoke ? "var(--danger)" : undefined} />
        <StatusLine icon={<ShieldCheck className="h-4 w-4" />} label="listener registrado" value={triLabel(nativeStatus ? nativeStatus.listenersRegistered : null)} color={nativeStatus?.listenersRegistered ? "var(--primary)" : undefined} />
        <StatusLine icon={<AlertTriangle className="h-4 w-4" />} label="último erro" value={smoke?.error ? smoke.error.message : nativeStatus?.lastError ?? "Nenhum"} color={smoke?.error || nativeStatus?.lastError ? "var(--danger)" : undefined} />
        <StatusLine
          icon={<PlayCircle className="h-4 w-4" />}
          label="etapa atual"
          value={busy ? `⏳ ${currentStage}` : currentStage}
          color={busy ? "var(--warning)" : undefined}
        />
      </Card>

      {/* Smoke-test log */}
      {smokeLog.length > 0 && (
        <Card className="mt-3 space-y-1.5 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logs [LEVELUP-NOTIFY]</p>
          {smokeLog.slice(0, 25).map((l, i) => (
            <div key={`${l.timestamp}-${i}`} className="flex items-start gap-2 border-b border-border/40 pb-1 last:border-0">
              {l.success ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--primary)" }} />
              ) : (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--danger)" }} />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs">
                  <span className="font-semibold">{l.stage}</span>
                  <span className="text-muted-foreground"> · {fmtTime(new Date(l.timestamp).getTime())}</span>
                </p>
                <p className="break-words text-xs text-muted-foreground">{l.message}</p>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Ambiente atual */}
      <Card className="mt-3 space-y-3">
        <StatusLine
          icon={isNative ? <Smartphone className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
          label="Ambiente atual"
          value={envLabel}
          color="var(--primary)"
        />
        <StatusLine icon={<Bot className="h-4 w-4" />} label="Método usado" value={methodLabel} />
        <StatusLine icon={<Bell className="h-4 w-4" />} label="Permissão atual" value={permLabel} color={permColor} />
      </Card>

      {/* Detalhes nativos (APK) */}
      {isNative && (
        <Card className="mt-3 space-y-3">
          <StatusLine
            icon={<Smartphone className="h-4 w-4" />}
            label="Plugin importado"
            value={triLabel(nativeStatus ? nativeStatus.pluginImported : null)}
            color={nativeStatus?.pluginImported ? "var(--primary)" : nativeStatus ? "var(--danger)" : undefined}
          />
          <StatusLine
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Permissão (nativa)"
            value={nativeStatus ? nativeStatus.permission : NOT_VERIFIED}
            color={
              nativeStatus?.permission === "granted"
                ? "var(--primary)"
                : nativeStatus?.permission === "denied"
                  ? "var(--danger)"
                  : "var(--warning)"
            }
          />
          <StatusLine
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Canal Android criado"
            value={triLabel(nativeStatus ? nativeStatus.channelCreated : null)}
            color={nativeStatus?.channelCreated ? "var(--primary)" : "var(--warning)"}
          />
          <StatusLine
            icon={<Bot className="h-4 w-4" />}
            label="Listeners registrados"
            value={triLabel(nativeStatus ? nativeStatus.listenersRegistered : null)}
            color={nativeStatus?.listenersRegistered ? "var(--primary)" : "var(--warning)"}
          />
          <StatusLine icon={<Clock className="h-4 w-4" />} label="Pendentes (nativo)" value={nativeStatus ? String(nativeStatus.pendingCount) : NOT_VERIFIED} />
          <StatusLine
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Último erro real"
            value={nativeStatus?.lastError ?? "Nenhum"}
            color={nativeStatus?.lastError ? "var(--danger)" : undefined}
          />
        </Card>
      )}

      {/* Aviso de ambiente — não é erro crítico */}
      {!isNative && (
        <Card className="mt-3 flex items-start gap-2" style={{ borderColor: "color-mix(in oklab, var(--cat-estudos) 40%, transparent)" }}>
          <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--cat-estudos)" }} />
          <p className="text-xs text-muted-foreground">
            Notificações nativas só estarão disponíveis no APK. No navegador, o fallback web (Service Worker) só dispara
            enquanto a página permanece aberta — não é agendamento persistente como no nativo.
          </p>
        </Card>
      )}

      {/* Detalhes técnicos (navegador) */}
      {!isNative && (
        <Card className="mt-3 space-y-3">
          <StatusLine icon={<BellRing className="h-4 w-4" />} label="Notification API" value={triLabel(snapshot ? snapshot.notificationApiAvailable : null)} color={snapshot?.notificationApiAvailable ? "var(--primary)" : "var(--warning)"} />
          <StatusLine icon={<ShieldCheck className="h-4 w-4" />} label="Service Worker" value={snapshot ? (snapshot.serviceWorkerRegistered ? `Sim · ${snapshot.serviceWorkerState}` : "Não registrado") : NOT_VERIFIED} color={snapshot?.serviceWorkerRegistered ? "var(--primary)" : "var(--warning)"} />
          <StatusLine icon={<Bot className="h-4 w-4" />} label="Push Manager" value={snapshot ? (snapshot.pushManagerAvailable ? "Disponível" : "Indisponível") : NOT_VERIFIED} color={snapshot?.pushManagerAvailable ? "var(--primary)" : "var(--warning)"} />
          <StatusLine icon={<Smartphone className="h-4 w-4" />} label="Status da PWA" value={snapshot ? (snapshot.pwaStatus === "standalone" ? "Instalada / standalone" : "Navegador") : NOT_VERIFIED} color={snapshot?.pwaStatus === "standalone" ? "var(--primary)" : "var(--warning)"} />
          <StatusLine icon={<Globe className="h-4 w-4" />} label="Navegador" value={snapshot?.browser ?? NOT_VERIFIED} />
          <StatusLine icon={<Smartphone className="h-4 w-4" />} label="Sistema" value={snapshot?.os ?? NOT_VERIFIED} />
        </Card>
      )}

      <Card className="mt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Bell className="h-5 w-5 shrink-0" style={{ color: permColor }} />
            <span className="truncate text-sm font-semibold">Permissão</span>
          </div>
          <span
            className="shrink-0 rounded-full px-3 py-1 text-xs font-bold"
            style={{ background: `color-mix(in oklab, ${permColor} 18%, transparent)`, color: permColor }}
          >
            {permLabel}
          </span>
        </div>
        {perm !== "granted" && perm !== "unsupported" && (
          <button
            type="button"
            onPointerDown={() => capturePointer("permitir")}
            onClick={() => void ask()}
            disabled={busy}
            className="no-tap mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {isNative ? "Permitir notificações (POST_NOTIFICATIONS)" : "Permitir notificações"}
          </button>
        )}
        {perm === "denied" && (
          <p className="mt-2 text-xs text-muted-foreground">
            {isNative
              ? "Bloqueadas pelo sistema. Ative nas configurações do app."
              : "Bloqueadas pelo navegador. Abra as permissões do site e ative as notificações manualmente."}
          </p>
        )}
        {perm === "unsupported" && (
          <p className="mt-2 text-xs text-muted-foreground">
            {isNative
              ? "O plugin de notificações nativas não respondeu. Veja o último erro acima."
              : "Este navegador não suporta notificações web. Tudo bem — o app continua funcionando normalmente."}
          </p>
        )}
        <button
          type="button"
          onPointerDown={() => capturePointer("atualizar")}
          onClick={() => void refreshStatus()}
          disabled={busy}
          className="no-tap mt-3 w-full rounded-xl border border-border py-2.5 text-sm font-bold disabled:opacity-60"
        >
          Atualizar diagnóstico
        </button>
      </Card>

      {/* Last events summary */}
      <SectionLabel>Resumo</SectionLabel>
      <div className="grid grid-cols-1 gap-2">
        <StatRow icon={<Send className="h-4 w-4" />} label="Última enviada" value={lastSent ? `${lastSent.title} · ${fmtTime(lastSent.at)}` : "—"} />
        <StatRow icon={<Inbox className="h-4 w-4" />} label="Última recebida" value={lastReceived ? `${lastReceived.title} · ${fmtTime(lastReceived.at)}` : "—"} color="var(--primary)" />
        <StatRow icon={<AlertTriangle className="h-4 w-4" />} label="Último erro real" value={lastError ? `${lastError.detail ?? lastError.title} · ${fmtTime(lastError.at)}` : "Nenhum"} color={lastError ? "var(--danger)" : undefined} />
        <StatRow icon={<PlayCircle className="h-4 w-4" />} label="Último teste executado" value={testResult} color="var(--warning)" />
      </div>

      {/* Tests */}
      <SectionLabel>Testes</SectionLabel>
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onPointerDown={() => capturePointer("testar-agora")}
          onClick={() => void runNowTest()}
          disabled={busy}
          className="no-tap flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          <BellRing className="h-4 w-4" /> Testar agora ({isNative ? "smoke nativo · ID 10001" : "web"})
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onPointerDown={() => capturePointer("em-10s")}
            onClick={() => void runScheduledTest(10)}
            disabled={busy}
            className="no-tap flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-bold disabled:opacity-60"
          >
            <Clock className="h-4 w-4" /> Em 10s
          </button>
          <button
            type="button"
            onPointerDown={() => capturePointer("em-60s")}
            onClick={() => void runScheduledTest(60)}
            disabled={busy}
            className="no-tap flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-bold disabled:opacity-60"
          >
            <Clock className="h-4 w-4" /> Em 1 min
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
                <Clock className="h-4 w-4 shrink-0 text-warning" style={{ color: "var(--warning)" }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.title}</p>
                  <p className="text-xs text-muted-foreground">dispara em {left}s</p>
                </div>
                <button type="button" onClick={() => cancelScheduled(s.id)} className="no-tap shrink-0 p-1 text-muted-foreground">
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
          <button type="button" onClick={clearNotifLog} className="no-tap text-xs text-muted-foreground underline">
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

      <div className="h-6" />
    </main>
  );
}

function StatRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary" style={color ? { color } : undefined}>
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
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background" style={color ? { color } : undefined}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-semibold" style={color ? { color } : undefined}>{value}</p>
      </div>
    </div>
  );
}
