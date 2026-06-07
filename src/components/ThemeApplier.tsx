import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { applyTheme } from "@/lib/theme";

/** Applies user theme settings to the document and keeps it in sync. */
export function ThemeApplier() {
  const settings = useStore((s) => s.settings);
  useEffect(() => {
    applyTheme(settings);
  }, [settings]);
  return null;
}
