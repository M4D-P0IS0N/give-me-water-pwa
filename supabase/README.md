# Supabase Setup - Sync + Push Server-side

Este projeto usa Supabase para:
- autenticacao por email (OTP);
- sincronizacao de dados (`profiles`, `hydration_events`, `monthly_summaries`);
- push notifications com envio server-side (`send-reminders`).

## 1) Auth e URLs
1. Em `Authentication > Providers`, habilite Email.
2. Em `Authentication > URL Configuration`:
   - `Site URL`: `https://m4d-p0is0n.github.io/give-me-water-pwa/`
   - `Additional Redirect URLs`:
     - `https://m4d-p0is0n.github.io/give-me-water-pwa/`
     - `https://m4d-p0is0n.github.io/give-me-water-pwa/index.html`

## 2) Schema
1. Abra `SQL Editor`.
2. Execute `supabase/schema.sql`.
3. Confirme as tabelas:
   - `profiles`
   - `hydration_events`
   - `monthly_summaries`
   - `push_subscriptions`
   - `push_reminder_dispatches`

## 3) Configuracao do cliente
Edite `src/config.js`:

```js
export const SUPABASE_CONFIG = {
    url: "https://SEU_PROJECT_REF.supabase.co",
    anonKey: "SUA_ANON_KEY",
    vapidPublicKey: "SUA_VAPID_PUBLIC_KEY"
};
```

`vapidPublicKey` precisa estar preenchida para registrar push subscription no navegador.

## 4) Gerar chaves VAPID
Com Node:

```powershell
npx web-push generate-vapid-keys
```

Guarde:
- Public Key -> vai para `src/config.js` (`vapidPublicKey`)
- Private Key -> vai para secret da Edge Function

## 5) Deploy da Edge Function de lembretes
Função:
- `supabase/functions/send-reminders/index.ts`

Deploy:

```powershell
npx supabase@latest functions deploy send-reminders --project-ref SEU_PROJECT_REF
```

Defina secrets:

```powershell
npx supabase@latest secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:voce@dominio.com CRON_SECRET=UM_SEGREDO_FORTE --project-ref SEU_PROJECT_REF
```

Se o seu ambiente nao expor automaticamente `SUPABASE_SERVICE_ROLE_KEY`, configure tambem:

```powershell
npx supabase@latest secrets set GMW_SUPABASE_SERVICE_ROLE_KEY=... GMW_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co --project-ref SEU_PROJECT_REF
```

## 6) Agendar envio (Cron)
Use `Integrations > Cron` no dashboard Supabase:
- Schedule: `*/10 * * * *` (a cada 10 minutos)
- Method: `POST`
- URL: `https://SEU_PROJECT_REF.functions.supabase.co/send-reminders`
- Header:
  - `Authorization: Bearer SEU_CRON_SECRET`

A função respeita por usuario:
- `notificationsEnabled`
- `reminderStartTime` / `reminderEndTime`
- `intervalMinutes`
- `goal` (nao envia se meta ja foi batida)
- deduplicacao por bucket (tabela `push_reminder_dispatches`)

## 7) Testes rapidos
1. No app (iOS/desktop), conceda permissao de notificacao.
2. Em Configuracoes, use `Testar notificacao agora` (teste local imediato).
3. Registre push subscription (login + permissao).
4. Teste server-side:

```powershell
$headers = @{ Authorization = "Bearer SEU_CRON_SECRET"; "Content-Type" = "application/json" }
Invoke-RestMethod -Method Post -Uri "https://SEU_PROJECT_REF.functions.supabase.co/send-reminders" -Headers $headers -Body '{"dryRun":true}'
```

`dryRun:true` nao envia push real, so retorna elegibilidade.
