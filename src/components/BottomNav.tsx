import { Link } from "@tanstack/react-router";
import { Home, ListChecks, BookOpen, Dumbbell, User, PiggyBank } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Início", icon: Home },
  { to: "/rotina", label: "Rotina", icon: ListChecks },
  { to: "/estudos", label: "Estudos", icon: BookOpen },
  { to: "/corpo", label: "Corpo", icon: Dumbbell },
  { to: "/cofrinho", label: "Cofrinho", icon: PiggyBank },
  { to: "/voce", label: "Você", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md border-t border-border bg-card/95 backdrop-blur">
      <div className="grid grid-cols-6 px-1 pb-[env(safe-area-inset-bottom)]">

        {ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="no-tap flex flex-col items-center gap-1 py-2 text-muted-foreground transition-colors"
            activeProps={{ className: "!text-primary" }}
          >
            <Icon className="h-5 w-5" strokeWidth={2.2} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
