# Mascot Processed Assets

Estes arquivos sao gerados por `tools/normalize-mascot-assets.ps1`.

Objetivo:
- padronizar canvas e ponto de ancoragem para sobreposicao estavel;
- remover fundo claro opaco dos PNGs originais;
- preservar variacoes de nivel em `Robo` e `Oleo`.

Como gerar:
1. No diretorio do projeto, execute:
```powershell
powershell -ExecutionPolicy Bypass -File .\tools\normalize-mascot-assets.ps1 -ProjectRoot .
```
2. Os arquivos serao emitidos em:
- `Imagens/Processed/Robo`
- `Imagens/Processed/Oleo`

Se algum nivel ficar visualmente ruim, ajuste `TargetFillRatio` no script e execute novamente.
