import type { Settings, DarkMode } from "./store";

export interface ColorPreset {
  name: string;
  value: string; // oklch
}

export const PRIMARY_PRESETS: ColorPreset[] = [
  { name: "Verde", value: "oklch(0.78 0.17 152)" },
  { name: "Azul", value: "oklch(0.7 0.16 250)" },
  { name: "Roxo", value: "oklch(0.7 0.16 300)" },
  { name: "Laranja", value: "oklch(0.74 0.16 55)" },
  { name: "Rosa", value: "oklch(0.72 0.18 10)" },
  { name: "Ciano", value: "oklch(0.78 0.12 195)" },
];

export const SECONDARY_PRESETS: ColorPreset[] = [
  { name: "Azul", value: "oklch(0.7 0.16 250)" },
  { name: "Roxo", value: "oklch(0.7 0.16 300)" },
  { name: "Âmbar", value: "oklch(0.82 0.15 85)" },
  { name: "Ciano", value: "oklch(0.78 0.12 195)" },
  { name: "Rosa", value: "oklch(0.72 0.18 10)" },
  { name: "Verde", value: "oklch(0.78 0.17 152)" },
];

const DARK_PRESETS: Record<DarkMode, Record<string, string>> = {
  default: {
    "--background": "oklch(0.16 0.008 260)",
    "--card": "oklch(0.205 0.01 260)",
    "--popover": "oklch(0.205 0.01 260)",
    "--secondary": "oklch(0.26 0.012 260)",
    "--muted": "oklch(0.24 0.01 260)",
    "--accent": "oklch(0.27 0.014 260)",
    "--border": "oklch(0.28 0.012 260)",
    "--input": "oklch(0.3 0.012 260)",
  },
  amoled: {
    "--background": "oklch(0 0 0)",
    "--card": "oklch(0.13 0.006 260)",
    "--popover": "oklch(0.13 0.006 260)",
    "--secondary": "oklch(0.18 0.008 260)",
    "--muted": "oklch(0.16 0.006 260)",
    "--accent": "oklch(0.19 0.01 260)",
    "--border": "oklch(0.22 0.008 260)",
    "--input": "oklch(0.24 0.008 260)",
  },
  gray: {
    "--background": "oklch(0.24 0.004 260)",
    "--card": "oklch(0.29 0.005 260)",
    "--popover": "oklch(0.29 0.005 260)",
    "--secondary": "oklch(0.34 0.006 260)",
    "--muted": "oklch(0.32 0.005 260)",
    "--accent": "oklch(0.35 0.007 260)",
    "--border": "oklch(0.37 0.006 260)",
    "--input": "oklch(0.39 0.006 260)",
  },
};

/** Apply user settings by overriding CSS variables on the document root. */
export function applyTheme(settings: Settings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // Dark mode surfaces
  const surfaces = DARK_PRESETS[settings.darkMode] ?? DARK_PRESETS.default;
  for (const [k, v] of Object.entries(surfaces)) root.style.setProperty(k, v);

  // Primary accent
  const primary = settings.primaryColor || "oklch(0.78 0.17 152)";
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--ring", primary);
  root.style.setProperty("--success", primary);

  // Secondary accent (used in highlights like the daily mission)
  const secondary = settings.secondaryColor || "oklch(0.7 0.16 250)";
  root.style.setProperty("--secondary-accent", secondary);
}
