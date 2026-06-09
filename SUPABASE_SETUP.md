# Sincronização em nuvem (Lovable Cloud / Supabase)

O LevelUp agora é **multi-dispositivo**: os dados continuam funcionando offline e
sincronizam automaticamente quando há internet e o usuário está logado.

## Tabelas criadas

### `profiles`
Perfil de cada usuário, criado automaticamente no cadastro.
- `id` → referência ao usuário autenticado
- `email`, `display_name`, `avatar_url`
- `created_at`, `updated_at`

### `user_state`
Snapshot completo do app por usuário (modelo escolhido: **1 documento JSON por usuário**).
Guarda **tudo**: tarefas, hábitos, anti-hábitos, sessões de estudo, matérias,
pomodoro, treino, dieta, cofrinho, metas e configurações.
- `user_id` → referência ao usuário (chave primária)
- `state` (JSONB) → todo o estado do app
- `client_updated_at` (bigint, epoch ms) → carimbo da última alteração do cliente
- `created_at`, `updated_at`

### Segurança (RLS)
Cada usuário só pode ler/escrever as **próprias** linhas (`auth.uid()`).
Nenhum acesso anônimo. A função de criação de perfil roda apenas como gatilho.

## Autenticação

- **Google** (gerenciado pelo Lovable Cloud, sem configuração extra)
- **E-mail e senha**

O **login é opcional**: sem entrar, o app funciona localmente neste aparelho.
Ao entrar, ativa-se a sincronização e a restauração entre dispositivos.

Tela: `src/routes/auth.tsx`. Acesso pela página **Você → Conta e sincronização**.

## Sincronização

Motor: `src/lib/sync.ts`.

- **Offline-first:** o estado vive no `localStorage` (zustand). O app nunca
  depende de internet para funcionar.
- **Push automático:** qualquer alteração marca um carimbo local e agenda um
  envio (debounce ~1.5s) quando online e logado.
- **Pull / restauração:** ao entrar (ou trocar de dispositivo) e ao reconectar,
  o app compara os carimbos e aplica o mais recente.
- **Resolução de conflito:** *last-write-wins* por `client_updated_at`.
  Em um aparelho novo o carimbo local é 0, então a nuvem sempre vence →
  **restauração automática completa** ao logar.

### Estados de sincronização (indicador visual)
`src/components/SyncBadge.tsx`:
- `offline` — sem internet
- `syncing` — sincronizando
- `synced` — sincronizado
- `error` — falha (tentará novamente)
- `idle` — local (sem login)

## Fluxo de dados

```text
Ação do usuário
   → zustand (estado) → localStorage  (sempre, mesmo offline)
   → marca client_updated_at + agenda push
   → online + logado? → upsert em user_state

Login / reconexão / outro dispositivo
   → lê user_state
   → carimbo da nuvem > local?  → aplica nuvem no estado (restaura)
   → carimbo local  > nuvem?    → envia local para a nuvem
```

## Arquivos relevantes
- `src/lib/sync.ts` — motor de sync + hook `useSyncStatus`
- `src/hooks/useAuth.ts` — estado de autenticação
- `src/routes/auth.tsx` — tela de login/cadastro
- `src/components/SyncBadge.tsx` — indicador de status
- `src/integrations/supabase/client.ts` — cliente (gerado, não editar)
- `src/integrations/lovable/index.ts` — login social Google (gerado, não editar)
