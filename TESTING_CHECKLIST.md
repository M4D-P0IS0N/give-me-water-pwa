# Testing Checklist - Give Me Water

## 1) Base app and onboarding
1. Abrir `index.html`.
2. Preencher onboarding com:
   - Genero: Masculino
   - Peso: 80
   - Altura: 180
   - Atividade: Media
   - Clima: Quente
3. Confirmar meta calculada perto de `4200ml` (arredondada de 50 em 50).

## 2) Dia efetivo (end-of-day)
1. Em configuracoes, ajustar `Horario de fim do dia` para `02:00`.
2. Registrar uma bebida entre `00:00` e `01:59` (ou simular alterando hora do sistema).
3. Confirmar que o registro conta para o dia anterior no dashboard/analytics.

## 3) Consumo positivo e negativo
1. Adicionar `500ml` de Agua.
2. Adicionar `500ml` de Cerveja.
3. Validar:
   - total muda com fator de hidratacao;
   - alerta aparece se total ficar negativo.

## 4) Mascote e sobreposicao
1. Subir progresso para 25/50/75/100%.
2. Confirmar troca de imagens (`robo_*` e `oleo_*`) sem fundo branco aparente.
3. Confirmar que as camadas ficam estaveis (oleo atras, robo na frente).

## 5) Analytics semanal e mensal
1. Abrir analytics.
2. Validar media semanal, percentual de metas e barras.
3. Validar grafico mensal com linha/area e linha de meta.

## 6) Push com actions (Android/desktop compativel)
1. Solicitar permissao de notificacao.
2. Disparar um lembrete (aguardar intervalo ou acionar via SW).
3. Usar acao `+250/+500/+750`.
4. Confirmar que consumo entra no historico sem abrir manualmente o app.

## 7) Fallback iOS
1. Em iOS PWA instalado, tocar notificacao quando actions nao aparecerem.
2. Confirmar abertura do quick add e registro de agua.

## 8) Sync Supabase
1. Preencher `src/config.js` com `url` e `anonKey`.
2. Aplicar `supabase/schema.sql` no projeto Supabase.
3. Entrar por email no app.
4. Registrar consumos em dois dispositivos.
5. Confirmar convergencia sem duplicacao.

## 9) Retencao mensal
1. Garantir dados em mes anterior (simulacao/manual).
2. Virar para novo mes.
3. Confirmar criacao de resumo mensal e limpeza de eventos detalhados antigos.

## 10) PWA offline/install
1. Verificar instalacao do PWA.
2. Fechar rede.
3. Reabrir app e registrar consumo.
4. Confirmar funcionamento offline e persistencia local.
