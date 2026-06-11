// Android / Capacitor build config.
//
// This config produces a fully STATIC SPA (Single Page Application) with a real
// `index.html` + `assets/` directory that Capacitor can pack into an APK.
//
// It reuses the SAME app code as the web build — nothing is rewritten. The only
// difference vs. the default (SSR / Cloudflare) build is:
//   1. TanStack Start runs in "SPA mode" → it prerenders an HTML shell that
//      boots the client-side router (no server needed at runtime).
//   2. Nitro (the SSR/Cloudflare server bundler) is disabled — the APK has no
//      Node/Worker server, everything talks directly to Supabase from the WebView.
//
// Used by: `npm run build:android` (see package.json).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // No SSR server inside the APK — emit a static client bundle only.
  nitro: false,
  tanstackStart: {
    // SPA mode: prerender a static HTML shell that hydrates the router on the
    // client. The shell is written as `index.html` at the root of the client
    // output so Capacitor's `webDir` finds it.
    spa: {
      enabled: true,
      prerender: {
        outputPath: "/",
        crawlLinks: false,
      },
    },
  },
  vite: {
    // Relative-friendly root base so assets resolve under Capacitor's
    // localhost WebView origin.
    base: "/",
    build: {
      // Capacitor reads from ./dist (see capacitor.config.ts -> webDir).
      outDir: "dist",
      emptyOutDir: true,
    },
  },
});
