# Security Review (2026-02-24)

Escopo revisado:
- `index.html`, `style.css`, `sw.js`
- `src/*.js`
- `supabase/schema.sql`
- `supabase/functions/monthly-retention/index.ts`

## Resultado rapido
- Nenhum segredo de alto risco foi encontrado no cliente.
- Nao foi encontrado `service role key` no frontend.
- RLS no schema esta habilitado nas tabelas principais.

## Pontos validos
1. Sync usa `anonKey` (esperado para app cliente).
2. Tabelas cloud com RLS por `auth.uid()`.
3. Service Worker faz cache apenas de origem local (`requestUrl.origin === self.location.origin`).
4. Login por email OTP, sem senha salva no app.

## Riscos residuais
1. `src/config.js` contem `anonKey` em texto plano.
   - Impacto: baixo/esperado para Supabase client-side.
   - Acao: manter RLS estrita e limitar abuso por rate limit no Supabase.
2. Cliente Supabase vem de CDN (`esm.sh`).
   - Impacto: medio (dependencia externa em runtime).
   - Acao: opcionalmente versionar localmente a dependencia no futuro.
3. Uso de `innerHTML` em alguns pontos de UI.
   - Impacto atual: baixo (dados vindos de listas internas e numeros).
   - Acao: se futuramente aceitar texto livre do usuario, trocar para `textContent`.

## Checklist recomendado antes do publico
1. Confirmar `enable_anonymous_sign_ins = false` no Supabase.
2. Confirmar policy RLS sem `for all` desnecessario.
3. Revisar limites de Auth e API no projeto Supabase.
4. Configurar monitoramento de erros no navegador e Edge Functions.
5. Testar fluxo completo com conta nova e sem cache do navegador.
