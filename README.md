# Fonseca Barber Club — checkpoint C01

Frontend local em português, identidade própria preta e dourada. Inclui administração demonstrativa isolada, apresentação e preparação de agendamento. **Não está liberado para operação em produção.**

`/inicio` apresenta o projeto. `/agendar` segue serviço → profissional → complementos → horários compatíveis → revisão, com adapter real inativo. A confirmação continua bloqueada. `/` usa dados reais indisponíveis; somente `?mode=demo` carrega fixtures sinalizadas. Não há fallback fictício no modo real.

## Executar

Requer Node.js compatível com Vite 7 e suporte a `--experimental-strip-types`.

`npm ci`

`npm run dev -- --port 5174 --strictPort`

Abrir http://127.0.0.1:5174/inicio no mesmo computador. O launcher `node start-preview.mjs` é opcional e não cria serviço/autostart. Não abrir index.html por duplo clique.

## Verificação

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build` e `npx tsc -p tests/browser/tsconfig.json`.

C01 preserva os 183 testes do conjunto integrado. O harness em tests/browser usa dados sintéticos em origem separada; nunca é importado pelo aplicativo real. Consultar [cobertura e limites](docs/checkpoint-2026-10-29.md) e [fronteiras da equipe](docs/access-boundaries.md).

## Dados e acesso

Configuração, registros e relatórios privados não acompanham este código. Auth, leitura remota, gravações e cobranças permanecem inativos por padrão. Não incluir senha SMTP, chave privilegiada, dados reais ou exports no repositório. Login não concede automaticamente acesso de equipe. Este checkpoint antecede a nova área mobile dos profissionais e as novas informações comerciais da apresentação.
