# Migração para Android (Capacitor) — LevelUp

Este documento descreve como o projeto **LevelUp** foi preparado para virar um
APK Android usando **Capacitor**, sem reescrever o aplicativo e sem migrar para
React Native. A base atual (TanStack Start + React + Vite) é mantida.

---

## 1. O que já está pronto (feito neste projeto)

### ✅ Camada de abstração de plataforma
- `src/lib/platform.ts`
  - `isNativePlatform()` → detecta se está rodando dentro do Capacitor (APK).
  - `getPlatform()` → `"web" | "android" | "ios"`.
  - `hasCapacitorPlugin()` → checa disponibilidade de um plugin nativo.

### ✅ Camada única de notificações (`NotificationService`)
- `src/lib/notification-service.ts`
  - **Modo automático**:
    - `isNativePlatform() === true` → **Capacitor Local Notifications** (nativo).
    - caso contrário → **Service Worker** (engine web atual, em `src/lib/notify.ts`).
  - API única usada por todo o app:
    - `notificationService.init()`
    - `notificationService.requestPermission()`
    - `notificationService.currentPermission()`
    - `notificationService.notify(title, body, options)`
    - `notificationService.schedule(title, body, delayMs)`
    - `notificationService.cancel(id)`
  - **Regra do projeto:** nenhuma funcionalidade chama notificações diretamente.
    Tudo passa pelo `NotificationService`. Já migrados:
    - `src/components/Reminders.tsx`
    - `src/routes/__root.tsx` (init no carregamento)
  - O plugin nativo é carregado via **import dinâmico protegido**, então o bundle
    web **não** depende de `@capacitor/local-notifications` (não quebra o build atual).

### ✅ Persistência preparada para nuvem
- `src/lib/persistence.ts`
  - `getStorage()` → adaptador de armazenamento único (hoje `localStorage`,
    com fallback em memória). Ponto único para trocar por
    `@capacitor/preferences` no nativo.
  - O `store` (`src/lib/store.ts`) já usa esse adaptador via
    `createJSONStorage(() => getStorage())`.
  - Coordenador de sincronização (scaffolding): `getSyncStatus()`,
    `onSyncStatus()`, `syncNow()` com estados `idle | syncing | synced | error`
    prontos para indicadores visuais.

### ✅ Configuração do Capacitor
- `capacitor.config.ts` na raiz (appId, appName, `webDir`, plugins).
  Não afeta o build web; é lido apenas pela CLI do Capacitor.

### ✅ Dependências auditadas
- Todas as dependências atuais (`package.json`) são JS/React puras e rodam
  dentro de uma WebView Android. **Nenhuma bloqueia a geração do APK.**

---

## 2. O que falta (feito localmente, fora do Lovable)

O ambiente Lovable é **web-only**. As etapas abaixo são executadas na sua
máquina depois de exportar o projeto para o GitHub e clonar localmente.

### 2.1 Instalar dependências do Capacitor
```bash
npm i @capacitor/core @capacitor/cli @capacitor/android
npm i @capacitor/local-notifications @capacitor/app @capacitor/preferences
npm i @capacitor/status-bar @capacitor/splash-screen
```

### 2.2 Gerar build SPA estática
> ⚠️ Ponto mais importante. Hoje o build é **SSR (Cloudflare Workers)**.
> Para o APK precisamos de **HTML/JS estáticos** na pasta `dist/` (igual ao
> `webDir` do `capacitor.config.ts`).

Opções:
- Usar a saída de prerender/estática do TanStack Start, **ou**
- Manter uma config de build alternativa que gere apenas o SPA cliente.

O importante: o conteúdo final deve ser arquivos estáticos servíveis sem
servidor Node/Worker. `createServerFn` e rotas `api/` **não existem** dentro do
APK — qualquer backend futuro deve ser uma API remota (ex.: Lovable Cloud).

### 2.3 Inicializar e adicionar Android
```bash
npx cap init   # se ainda não usar capacitor.config.ts
npx cap add android
npx cap sync
```

### 2.4 Gerar o APK
```bash
npx cap open android   # abre no Android Studio
# Build > Build Bundle(s) / APK(s) > Build APK(s)
```

---

## 3. Próximos passos sugeridos (futuro)

| Recurso | Como integrar |
|---|---|
| **Notificações locais** | Já abstraído. Basta instalar `@capacitor/local-notifications`; o `NotificationService` passa a usá-lo automaticamente no APK. |
| **Login Google** | `@capacitor/google-auth` ou OAuth do Lovable Cloud via `@capacitor/browser` + deep link. |
| **Lovable Cloud / Supabase** | `@supabase/supabase-js` é fetch puro → roda na WebView. Plugar em `syncNow()` para sincronização real. |
| **Storage nativo** | Trocar `getStorage()` por `@capacitor/preferences` em `src/lib/persistence.ts`. |
| **Widgets Android** | Requer código nativo Kotlin/Java na pasta `android/` (Capacitor não cria widgets). |

---

## 4. Resumo

- **Experiência atual do usuário:** inalterada. No navegador tudo continua via
  Service Worker.
- **Pronto para Android:** detecção de plataforma, serviço único de
  notificações, persistência abstraída e config do Capacitor.
- **Falta apenas (local):** instalar Capacitor, gerar build SPA estática e
  compilar o APK no Android Studio.
