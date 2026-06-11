// Post-build step for the Android / Capacitor build.
//
// TanStack Start always emits its client bundle to `dist/client` and an unused
// SSR bundle to `dist/server`. Capacitor wants a single static web root with
// `index.html` + `assets/` at the top level. This script flattens the output:
//
//   dist/client/*  ->  dist/*
//   dist/server/   ->  removed (no server runs inside the APK)
//
// Result: `dist/index.html`, `dist/assets/`, etc. — exactly what
// capacitor.config.ts points `webDir` at.
import { existsSync } from "node:fs";
import { rm, readdir, rename } from "node:fs/promises";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
const client = join(dist, "dist-client-tmp");
const clientOut = join(dist, "client");
const server = join(dist, "server");

async function main() {
  if (!existsSync(clientOut)) {
    console.error("[android-postbuild] dist/client not found — did the build run?");
    process.exit(1);
  }

  // Drop the unused SSR bundle.
  if (existsSync(server)) {
    await rm(server, { recursive: true, force: true });
  }

  // Move dist/client out of the way, then promote its contents to dist/.
  await rename(clientOut, client);
  for (const entry of await readdir(client)) {
    await rename(join(client, entry), join(dist, entry));
  }
  await rm(client, { recursive: true, force: true });

  console.log("[android-postbuild] Static web root ready at ./dist (index.html + assets).");
}

main().catch((err) => {
  console.error("[android-postbuild] failed:", err);
  process.exit(1);
});
