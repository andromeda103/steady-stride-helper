# Gerar o APK Android (Capacitor) — LevelUp

Este guia mostra **exatamente** os comandos para transformar o LevelUp em um
APK Android. O app **não foi reescrito** — ele continua usando TanStack Start,
React, Zustand, Supabase (auth, Google login, sincronização em nuvem) e o
sistema de notificações. A única diferença é que existe agora uma build
**estática (SPA)** compatível com o Capacitor.

---

## 1. O que foi configurado neste projeto

| Arquivo | Mudança |
|---|---|
| `vite.config.android.ts` | **Novo.** Build dedicada para Android: ativa o **SPA mode** oficial do TanStack Start (`spa.enabled`) e **desliga o Nitro/SSR** (`nitro: false`). Gera um `index.html` estático + `assets/`. |
| `scripts/android-postbuild.mjs` | **Novo.** Achata a saída: move `dist/client/*` → `dist/*` e remove `dist/server`. Resultado final: `dist/index.html` + `dist/assets/`. |
| `package.json` | **Novos scripts:** `build:android`, `cap:sync`, `cap:open`. |
| `capacitor.config.ts` | `webDir` aponta para `dist` (a raiz estática com `index.html`). |

> A build **web normal** (`npm run build`, SSR/Cloudflare) **continua intacta**.
> A build Android é separada e só roda quando você chama `build:android`.

### Por que isso resolve o erro

O erro original:

```
The web assets directory must contain an index.html file
```

acontecia porque a build padrão do TanStack Start é **SSR** e gera
`dist/client` + `dist/server`, **sem** um `index.html` na raiz. O SPA mode
oficial pré-renderiza um **shell HTML estático** que inicializa o roteador no
cliente — é exatamente o que o Capacitor precisa.

---

## 2. Pré-requisitos (uma vez)

Feito na **sua máquina** (o ambiente Lovable é web-only):

```bash
# Dependências do Capacitor (já tem core + android; adicione o resto que usar)
npm i @capacitor/core @capacitor/cli @capacitor/android
npm i @capacitor/local-notifications @capacitor/app @capacitor/preferences
```

Se ainda não criou a pasta `android/`:

```bash
npx cap add android
```

---

## 3. Comandos finais para gerar o APK

### Passo 1 — Build estática + sync (um comando)

```bash
npm run cap:sync
```

Isso faz, em sequência:
1. `npm run build:android` → gera `dist/index.html` + `dist/assets/`
2. `npx cap sync android` → copia a build para o projeto Android

> Ou rode separadamente:
> ```bash
> npm run build:android
> npx cap sync android
> ```

### Passo 2 — Abrir no Android Studio

```bash
npm run cap:open
# (equivale a: npx cap open android)
```

### Passo 3 — Compilar o APK (no Android Studio)

```
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

O APK aparece em:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 4. Verificar a build localmente (opcional)

Antes de empacotar, dá para servir a pasta estática como um site comum:

```bash
npm run build:android
npx serve dist     # ou: python3 -m http.server -d dist 5000
```

Abra no navegador — se funcionar aqui, funciona dentro do APK.

---

## 5. O que continua funcionando dentro do APK

| Recurso | Status |
|---|---|
| **Supabase** (banco + auth) | ✅ `@supabase/supabase-js` é fetch puro → roda na WebView. |
| **Login Google** | ✅ via OAuth do Supabase. Configure o **deep link / redirect** do Capacitor (ver abaixo). |
| **Sincronização Cloud** | ✅ `src/lib/sync.ts` usa o cliente Supabase direto, sem servidor. |
| **Notificações** | ✅ `NotificationService` detecta o nativo e usa `@capacitor/local-notifications` automaticamente. |
| **Zustand** | ✅ store puro em memória + `localStorage` (trocável por `@capacitor/preferences`). |

### Atenção: redirect do Login Google no app

No app nativo a URL não é mais `https://...lovable.app`. Configure no Supabase
(Auth → URL Configuration) uma **Redirect URL** com o esquema do app, ex.:

```
app.lovable.levelup://login-callback
```

e trate o retorno com `@capacitor/app` (`appUrlOpen`). Sem isso, o login web
abre, mas não volta para o app.

---

## 6. Fluxo resumido (toda vez que mudar o app)

```bash
npm run cap:sync      # build estática + copia pro Android
npm run cap:open      # abre o Android Studio
#   Build > Build APK(s)
```

Pronto — APK gerado a partir do mesmo código do app web. 🎉
