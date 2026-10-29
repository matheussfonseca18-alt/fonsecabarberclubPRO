# Fonseca Barber Club — checkpoint C02

Frontend local em português, identidade própria preta e dourada. Inclui administração demonstrativa isolada, apresentação, preparação de agendamento e área mobile do barbeiro. **Ainda não está liberado para operação em produção.**

## Entradas

- `/inicio`: apresentação, CTA para agendar e Instagram no rodapé. Logo oficial, endereço e preços atuais não estão confirmados e permanecem ausentes.
- `/agendar`: serviço → profissional → complementos → horários compatíveis → revisão. Adapter real inativo e confirmação bloqueada.
- `/barbeiro`: Minha agenda, Meu rascunho, Meu desempenho e Mais. Sem dados fictícios no lugar de dados reais. Rascunhos apenas na memória; salvar no sistema está desabilitado.
- `/auth/login`: acesso preparado, sem envio ou acesso remoto habilitado por padrão. Login não concede automaticamente função de equipe.
- `/`: administração com dados reais indisponíveis. Somente `?mode=demo` carrega fixtures sinalizadas; não há fallback demo em falhas. O parâmetro não ativa demo nas rotas de booking ou barbeiro.

## Executar

Requer Node.js compatível com Vite 7 e suporte a `--experimental-strip-types`.

`npm ci`

`npm run dev -- --port 5174 --strictPort`

Abrir http://127.0.0.1:5174/inicio no mesmo computador. O launcher `node start-preview.mjs` é opcional e não cria serviço/autostart. Não abrir index.html por duplo clique. O preview não está publicado nem acessível de outro aparelho pelo link loopback.

## Verificação

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build` e `npx tsc -p tests/browser/tsconfig.json`.

C02 passou com 262 testes. QA local integrado verificou navegação, teclado, rascunhos, cancelamento, limpeza após recarga, indisponibilidade e layout responsivo. O harness em tests/browser usa dados sintéticos e nunca é importado pelo aplicativo real. Nenhum teste local comprova autorização remota, persistência operacional ou entrega SMTP.

Ver [cobertura C02](docs/checkpoint-C02-2026-10-29.md), [área do barbeiro](docs/barber-mobile.md), [contrato proposto](docs/barber-contract.md) e [fronteiras da equipe](docs/access-boundaries.md). O [C01](docs/checkpoint-2026-10-29.md) é histórico.

## Dados e acesso

Configuração, registros e relatórios privados não acompanham este código. Auth, leitura remota, gravações e cobranças permanecem inativos por padrão. Não incluir senha SMTP, chave privilegiada, dados reais ou exports no repositório. Antes de operar, faltam contratos/dados verificados, adapters autorizados e validação de acesso/concorrência no servidor. Este snapshot não ativa permissões ou produção.
