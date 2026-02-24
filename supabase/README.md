# Supabase Setup - Modo Simples (igual ao App de Custos)

Este projeto agora funciona no mesmo modelo simples:
- `URL + ANON KEY` no cliente;
- login por email no app;
- sync via RLS;
- retenção mensal sincronizada pelo próprio cliente autenticado.

Nao precisa `functions invoke` para o app funcionar.

## 1) Criar projeto e habilitar Auth
1. Crie o projeto no Supabase.
2. Em `Authentication > Providers`, habilite Email.
3. Em `Authentication > URL Configuration`, adicione sua URL local (ex: `http://localhost:5500`) em `Site URL` e `Redirect URLs`.

## 2) Executar schema
1. Abra `SQL Editor`.
2. Execute:
   - `supabase/schema.sql`
3. Confirme as tabelas:
   - `profiles`
   - `hydration_events`
   - `monthly_summaries`
   - `push_subscriptions`

## 3) Configurar cliente do app
Edite:
- `src/config.js`

Preencha:
```js
export const SUPABASE_CONFIG = {
  url: "https://SEU_PROJECT_REF.supabase.co",
  anonKey: "SUA_ANON_KEY",
  vapidPublicKey: ""
};
```

## 4) Validar conexão no app
1. Abra o app.
2. Em `Configuracoes`, informe email e clique `Entrar`.
3. Abra o link recebido no email.
4. Registre um consumo.
5. No Supabase Table Editor, valide insercao em `hydration_events`.

## 5) Realtime (opcional, recomendado)
Em `Database > Replication`, habilite realtime para `hydration_events`.

## 6) Edge Function (opcional, avancado)
O arquivo `supabase/functions/monthly-retention/index.ts` continua no repo como opcao avancada.
Para o fluxo comum do app, nao e necessario deploy/invoke dessa function.
