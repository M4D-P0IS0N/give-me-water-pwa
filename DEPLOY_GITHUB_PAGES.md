# Deploy no GitHub Pages

## 1) Preparar repositorio
1. No projeto local:
```powershell
git init
git add .
git commit -m "feat: pwa hydration app"
```
2. Crie o repositorio no GitHub (ex: `give-me-water-pwa`).
3. Conecte e envie:
```powershell
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/give-me-water-pwa.git
git push -u origin main
```

## 2) Publicar no Pages
1. Abra `Settings > Pages`.
2. Em `Build and deployment`:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - `Folder`: `/ (root)`
3. Salve e aguarde a URL ser gerada:
   - `https://SEU_USUARIO.github.io/give-me-water-pwa/`

## 3) Ajustar Supabase para URL final
No painel do Supabase:
1. `Authentication > URL Configuration`
2. Configure:
   - `Site URL`: `https://SEU_USUARIO.github.io/give-me-water-pwa/`
   - `Redirect URLs`: adicione a mesma URL acima.
3. Se for usar dominio proprio, adicione o dominio final tambem.

## 4) Configurar app para producao
Edite `src/config.js`:
```js
export const SUPABASE_CONFIG = {
  url: "https://SEU_PROJECT_REF.supabase.co",
  anonKey: "SUA_ANON_KEY",
  vapidPublicKey: ""
};
```

## 5) Verificacao pos deploy
1. Abrir URL do Pages em aba anonima.
2. Confirmar instalacao PWA.
3. Fazer login email.
4. Registrar consumo e validar no Supabase.
5. Testar offline e reabertura.

## 6) Atualizacoes futuras
Sempre que mudar codigo:
```powershell
git add .
git commit -m "sua alteracao"
git push
```
O GitHub Pages publica automaticamente.
