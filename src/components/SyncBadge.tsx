import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { useSyncStatus, type SyncStatus } from "@/lib/sync";

const META: Record<SyncStatus, { label: string; color: string; Icon: typeof Cloud; spin?: boolean }> = {
  idle: { label: "Local", color: "var(--muted-foreground)", Icon: Cloud },
  offline: { label: "Offline", color: "var(--warning)", Icon: CloudOff },
  syncing: { label: "Sincronizando", color: "var(--primary)", Icon: RefreshCw, spin: true },
  synced: { label: "Sincronizado", color: "var(--primary)", Icon: CheckCircle2 },
  error: { label: "Erro ao sincronizar", color: "var(--destructive)", Icon: AlertTriangle },
};

export function SyncBadge({ className = "" }: { className?: string }) {
  const status = useSyncStatus();
  const { label, color, Icon, spin } = META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium ${className}`}
      style={{ color }}
    >
      <Icon className={`h-3.5 w-3.5 ${spin ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}
