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

## 1b. Notificações nativas (smoke test `native-v6`)

A correção definitiva das notificações nativas usa um teste isolado e
verificável. Pontos-chave:

- `src/lib/native-notify-smoke.ts` — **novo**. Teste independente (sem Zustand,
  Supabase, rotina, hábitos, Service Worker ou fallback web). Importa
  `@capacitor/local-notifications` **diretamente** quando
  `Capacitor.isNativePlatform()` é `true` e `Capacitor.getPlatform() === "android"`.
  **`Capacitor.isPluginAvailable()` é apenas diagnóstico — não bloqueia mais o fluxo.**
- `android/app/src/main/AndroidManifest.xml` — adicionada
  `android.permission.POST_NOTIFICATIONS` (obrigatória no Android 13+ para o
  diálogo de permissão aparecer).
- IDs fixos de teste: `10001` (Testar agora), `10002` (10s), `10003` (1 min).
- A tela de Diagnóstico mostra a versão `native-v6` e cada etapa real
  (clique → plataforma → import → permissão antes/depois → canal → schedule →
  getPending). Logs no console têm prefixo `[LEVELUP-NOTIFY]`.

### Sincronizar e gerar o APK (PowerShell, na sua máquina)

```powershell
cd "C:\Users\gabri\Documents\new\steady-stride-helper"

npm install

Remove-Item -Recurse -Force .\dist -ErrorAction SilentlyContinue
npm run build:android

Remove-Item -Recurse -Force .\android\app\src\main\assets -ErrorAction SilentlyContinue
npx cap sync android
```

Depois confirme que estes arquivos foram **gerados pelo `cap sync`** (não os
crie manualmente):

```
android/app/src/main/assets/capacitor.config.json   ->  "webDir": "dist"
android/app/src/main/assets/capacitor.plugins.json  ->  contém @capacitor/local-notifications
```

Compile o APK:

```powershell
cd android

$env:JAVA_HOME="D:\android\jbr"
$env:Path="$env:JAVA_HOME\bin;$env:Path"

$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$sdkProp = $sdk -replace '\\','/'
Set-Content -Path .\local.properties -Value "sdk.dir=$sdkProp"

.\gradlew.bat clean assembleDebug
```

### Como validar no APK

1. Abra o app → aba **Você** → **Diagnóstico de notificações**.
2. Confirme `Diagnóstico nativo: native-v6`, `native = true`, `platform = android`.
3. Toque **Testar agora** → o contador de cliques sobe na hora.
4. Aceite o diálogo de permissão (Android 13+).
5. A notificação **ID 10001** deve aparecer em ~5 segundos (app aberto).
6. Verifique `ID encontrado nos pendentes = Sim`.
7. Tocar na notificação registra `action` no log.

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

## 6. Notificações nativas (Capacitor Local Notifications)

O `@capacitor/local-notifications` agora é uma **dependência real** do projeto
(`package.json`). O `NotificationService` faz `import("@capacitor/local-notifications")`
estático, então o Vite **empacota o plugin** no build Android. Dentro do APK as
notificações são **nativas** (AlarmManager); no navegador continuam usando
**Web Notifications / Service Worker**.

### 6.1 — OBRIGATÓRIO após instalar/atualizar o plugin

Sempre que mudar dependências nativas (ou na primeira vez), rode **nesta ordem**:

```bash
npm install
npm run build:android
npx cap sync android
```

> `npx cap sync android` copia a build **e** instala os plugins nativos no
> projeto Android. Sem isso o APK mostra "plugin não disponível".

### 6.2 — Permissões no AndroidManifest.xml

Abra `android/app/src/main/AndroidManifest.xml` e adicione, dentro de
`<manifest>` (antes de `<application>`):

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- Necessário para notificações agendadas com horário exato (Android 12+) -->
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.USE_EXACT_ALARM" />
```

No Android 13+ o app pede a permissão `POST_NOTIFICATIONS` em runtime — o botão
**"Permitir notificações"** na tela de Diagnóstico chama
`LocalNotifications.requestPermissions()`.

### 6.3 — Tela de Diagnóstico

Em `Você → Diagnóstico de notificações`, dentro do APK você verá:

- **Plugin nativo disponível:** Sim/Não
- **Permissão Android:** granted / denied / prompt
- **Último erro real**
- **Testar agora** → dispara uma notificação nativa imediata
- **Em 10s / Em 1 min** → agenda notificações nativas

---

## 7. Fluxo resumido (toda vez que mudar o app)

```bash
npm run cap:sync      # build estática + copia pro Android (build:android + cap sync)
npm run cap:open      # abre o Android Studio
#   Build > Build APK(s)
```

Pronto — APK gerado a partir do mesmo código do app web. 🎉


---

## 8. Correções de notificações nativas + Cofrinho (atualização)

### Notificações nativas (APK)
- O plugin `@capacitor/local-notifications` é carregado por **import dinâmico**
  e **só** no APK (`Capacitor.isNativePlatform()`), nunca na web/SSR.
- Antes de qualquer `schedule()` o app cria o canal **`levelup_reminders`**
  (importance 5, visibility 1, som + vibração).
- Listeners (`localNotificationReceived` / `localNotificationActionPerformed`)
  são registrados **uma única vez** em `notificationService.init()`.
- Toda falha é capturada com **etapa + mensagem + stack + horário** e aparece
  na tela de Diagnóstico (Você → Diagnóstico de notificações).

#### AndroidManifest.xml (obrigatório)
Em `android/app/src/main/AndroidManifest.xml`, antes de `<application>`:
```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.USE_EXACT_ALARM" />
```

#### Ícone `ic_stat_icon`
O `capacitor.config.ts` **não** referencia mais um ícone inexistente — usa o
ícone padrão do app. Para um ícone de status branco personalizado, crie
`android/app/src/main/res/drawable/ic_stat_icon.png` e adicione de volta
`smallIcon: "ic_stat_icon"` em `capacitor.config.ts`.

### Comandos para gerar/testar o APK (Windows PowerShell)
```powershell
npm install
Remove-Item -Recurse -Force .\dist -ErrorAction SilentlyContinue
npm run build:android
npx cap sync android
cd android
$env:JAVA_HOME="D:\android\jbr"
$env:Path="D:\android\jbr\bin;$env:Path"
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$sdkProp = $sdk -replace '\\','/'
Set-Content -Path .\local.properties -Value "sdk.dir=$sdkProp"
.\gradlew.bat assembleDebug
```

### Como testar as notificações no APK
1. Abra **Você → Diagnóstico de notificações**.
2. Toque em **Permitir notificações** → Android deve pedir a permissão.
3. Confirme que **Plugin nativo disponível = Sim** e **Canal Android criado = Sim**.
4. **Testar agora (nativo)** → notificação aparece em ~2s.
5. **Em 10s / Em 1 min** → notificações agendadas disparam no tempo.
6. "Última enviada", "Última recebida", "Pendentes" e o log devem atualizar.

### Como testar o Cofrinho
1. Defina o **Valor por dia perfeito** e toque em **Salvar recompensa**.
2. Abra **Hábitos/Tarefas obrigatórios** e marque o que conta como dia perfeito.
3. Conclua os requisitos do dia → o status mostra **Recompensa LIBERADA**.
4. Toque em **Verificar recompensa de hoje** → saldo sobe e o histórico
   registra `+ Dia perfeito`.
5. Tocar de novo no mesmo dia mostra **"Recompensa de hoje já adicionada"**
   (controle por `rewardGrantedDates`, sem duplicar).
6. **Testar sistema** simula o cálculo **sem** alterar o saldo real.
7. **Resgatar recompensa** desconta do saldo e registra a saída no histórico.
