
# LevelUp — Plano de Evolução

O app hoje é 100% local (zustand + localStorage). Vamos adicionar tudo o que você pediu em **fases**, sem alterar nada que já funciona. As fases 1–3 não dependem de internet; a fase 4 (conta + sincronização) adiciona o backend na nuvem.

## Princípios
- Não remover nem quebrar funcionalidades atuais (tarefas, hábitos, XP, pomodoro, treino, dieta, calendário, modo foco, dia ruim).
- Performance e mobile em primeiro lugar.
- Confiabilidade dos dados acima de tudo: nada é apagado sem confirmação; sincronização nunca sobrescreve dados sem merge seguro.

---

## FASE 1 — Notificações confiáveis + Diagnóstico (CRÍTICO)

Reescrever a base de notificações para resolver os "falsos erros" e dar visibilidade total.

- **Logs de diagnóstico** persistidos no store: cada evento (pedido de permissão, envio, recebimento, erro, agendamento) vira um registro com data/hora.
- **Confirmação de recebimento**: quando uma notificação dispara, o callback `onshow` registra "recebida"; se falhar, registra "erro" real (não falso).
- **Agendamentos com `setTimeout`** rastreados em memória + listados na tela.
- **Nova tela "Diagnóstico de Notificações"** (rota `/notificacoes`, acessível a partir de "Você"):
  - Status da permissão (concedida / negada / não solicitada / não suportada)
  - Última notificação enviada / recebida / último erro
  - Notificações agendadas (lista)
  - Botões: **Testar agora**, **Testar em 30s**, **Testar em 1min**
  - Log detalhado (últimos eventos) com botão limpar
- **Limitação técnica honesta**: notificações web não disparam de forma 100% confiável com o app fechado em Android (limitação do navegador/PWA, não do código). Para máxima confiabilidade real é preciso empacotar como app nativo (Capacitor) com push nativo — fora do escopo desta fase, mas deixo a base pronta e documento o caminho.

## FASE 2 — Personalização (tema)

- Tokens de tema dirigidos por CSS variables já existentes em `styles.css`.
- Novo estado de configurações: **cor primária**, **cor secundária**, e **modo escuro**: `Dark padrão`, `Dark AMOLED` (preto puro), `Dark cinza`.
- Aplicação em tempo real injetando variáveis no `:root` (sem recarregar).
- Seção "Personalização" na aba "Você".

## FASE 3 — Novos módulos (locais)

1. **Missão Principal do Dia**: escolher uma tarefa como missão; destaque no topo da Home; mostra estado de conclusão.
2. **Metas semanais por matéria** (Estudos): horas planejadas vs estudadas na semana + barra de progresso por matéria.
3. **Água melhorada** (Corpo/Dieta): meta diária editável + botões rápidos 250ml / 500ml / 750ml / 1L.
4. **Peso** (Corpo): peso atual, meta de peso, histórico com mini-gráfico.
5. **Sono** (Corpo, nova aba): hora de dormir, hora de acordar, total dormido, histórico.
6. **Anti-procrastinação**: detectar inatividade (último uso salvo); ao reabrir, avisos progressivos se passaram 24h / 48h / 72h sem uso.
7. **Backup**: exportar (download `.json` com todo o estado) e importar (merge/restauração a partir de `.json`).

---

## FASE 4 — Conta + Sincronização na nuvem (CRÍTICO)

Requer ativar o **Lovable Cloud** (backend gerenciado: banco + autenticação, sem você criar contas externas).

- **Autenticação**: Login com **Google** e **Email/Senha**.
- **Armazenamento na nuvem**: uma tabela por usuário guardando o "documento de estado" (tarefas, hábitos, anti-hábitos, estudos, pomodoro, treino, dieta, calendário, XP, configurações). RLS garante que cada usuário só acessa os próprios dados.
- **Sincronização automática**:
  - Ao logar em outro aparelho, restaura tudo.
  - Salva na nuvem (debounce) quando o estado muda.
  - Merge seguro por carimbo de tempo para não perder dados.
- **Indicadores de status**: sincronizando / sincronizado / erro / última sincronização (visível em "Você").
- **Modo offline**: continua funcionando local; sincroniza quando volta a conexão.
- **Sem conta** o app continua 100% funcional localmente (login é opcional, mas recomendado para backup em nuvem).

---

## Detalhes técnicos (resumo)

- `src/lib/store.ts`: adicionar slices `settings` (tema/cores), `mission`, `subjectGoals`, `weight[]`, `sleep[]`, `notifLog[]`, `lastActiveAt`, `water` (já existe, só novos atalhos). Manter `version` do persist e escrever **migração** para não perder dados existentes.
- `src/lib/notify.ts`: reescrever com logging, agendamento rastreável e confirmação `onshow`/`onerror`.
- Novos arquivos: `src/routes/notificacoes.tsx`, `src/lib/theme.ts`, `src/lib/backup.ts`, e (fase 4) integração Cloud + `src/lib/sync.ts`.
- Tema aplicado via efeito no `__root.tsx`.
- Fase 4: tabela `profiles_state` (jsonb + updated_at) com policies por `auth.uid()`; client browser para auth/realtime; sync com debounce.

---

### Ordem de execução proposta
Começo pela **Fase 1 (notificações + diagnóstico)** e **Fase 2 (tema)**, depois **Fase 3 (módulos)**, e por fim **Fase 4 (conta + nuvem)**. Cada fase é entregue funcionando antes de avançar.

Quer que eu siga exatamente nessa ordem, ou prefere que eu priorize primeiro a **Fase 4 (conta + sincronização)** por ser crítica para nunca perder dados?
