# Give Me Water - PWA

PWA de hidratacao com:
- design `Liquid Glass` em tema claro Catppuccin Latte;
- mascote dinamico (robo + galao de oleo) por nivel de progresso;
- funcionamento offline;
- push notifications com quick add;
- base para sync cloud com Supabase.

## Estrutura principal
- `index.html`: layout e telas.
- `style.css`: design system visual.
- `src/main.js`: bootstrap do app.
- `src/state.js`: estado, persistencia e helper de dia efetivo.
- `src/sync.js`: fila IndexedDB + sync cloud.
- `sw.js`: service worker, cache e quick actions.

## Configuracao de Supabase
1. Edite `src/config.js`.
2. Preencha:
   - `url`
   - `anonKey`
   - `vapidPublicKey` (opcional, para push web real)
3. Execute o schema SQL:
   - `supabase/schema.sql`
4. Siga os passos completos em:
   - `supabase/README.md`

Com `url`/`anonKey` vazios em `src/config.js`, o app continua em modo local-only.

## Normalizacao de assets do mascote
1. Execute:
```powershell
powershell -ExecutionPolicy Bypass -File .\tools\normalize-mascot-assets.ps1 -ProjectRoot .
```
2. Os PNGs normalizados serao gerados em:
   - `Imagens/Processed/Robo`
   - `Imagens/Processed/Oleo`

## Observacoes de push
- Android/desktop: usa acoes de notificacao (`+250`, `+500`, `+750`).
- iOS fallback: toque abre quick add no app quando actions nao estiverem disponiveis.

## Checklist de testes
- `TESTING_CHECKLIST.md`

## Reset de dados
- No app: `Configuracoes > Resetar dados e recomecar`
- Se estiver logado, o reset apaga:
  - dados locais
  - fila offline
  - eventos/summaries/push subscriptions na nuvem (Supabase)

## Deploy e seguranca
- Deploy no GitHub Pages:
  - `DEPLOY_GITHUB_PAGES.md`
- Revisao final de seguranca:
  - `SECURITY_REVIEW.md`
