# Fonseca Barber Club — checkpoint C03

Frontend em português, identidade própria preta e dourada. Inclui apresentação, gestão demonstrativa isolada, preparação de agendamento e área mobile do barbeiro. **Ainda não está liberado para operação real.**

## Entradas

- `/` e `/inicio`: página inicial com acesso às áreas do sistema. Logo oficial, endereço e preços atuais não verificados permanecem ausentes.
- `/?mode=real#Dashboard`: gestão com dados reais indisponíveis. Somente `?mode=demo` carrega fixtures sinalizadas; não há fallback demo em falhas.
- `/agendar`: serviço → profissional → complementos → horários compatíveis → revisão. Adapter real inativo e confirmação bloqueada.
- `/barbeiro`: Minha agenda, Meu rascunho, Meu desempenho e Mais. Sem dados fictícios no lugar de dados reais; rascunhos na memória, salvamento desabilitado.
- `/auth/login`: acesso preparado, sem envio ou consulta remota habilitados por padrão. Login não concede automaticamente função de equipe.

Os modos explícitos e hashes administrativos antigos foram preservados. Booking e barbeiro permanecem em modo real. Links e parâmetros não concedem permissões.

## Executar

Requer Node.js compatível com Vite 7 e suporte a `--experimental-strip-types`.

`npm ci`

`npm run dev -- --port 5174 --strictPort`

Abrir http://127.0.0.1:5174/inicio no mesmo computador. O launcher opcional `node start-preview.mjs` não cria serviço ou autostart. Não abrir index.html por duplo clique. O endereço loopback não permite acessar o preview de outro aparelho.

## Correção de hospedagem

No C02 publicado, as entradas diretas /inicio e /barbeiro retornavam 404, embora os arquivos estivessem presentes. C03 acrescenta rotas SPA em vercel.json, entrada pública pela raiz e links entre home, gestão e barbeiro. Não captura os assets. A correção foi preparada e testada localmente; sua execução no host deve ser conferida após o deploy.

## Verificação

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build` e `npx tsc -p tests/browser/tsconfig.json` passaram. C03 tem 263 testes. QA local verificou entrada direta, recarga, menus, histórico, teclado e layouts desktop/mobile. Nenhum teste local comprova autorização remota, persistência operacional ou entrega SMTP.

Ver [cobertura C03](docs/checkpoint-C03-2026-10-30.md), [C02 histórico](docs/checkpoint-C02-2026-10-29.md), [área do barbeiro](docs/barber-mobile.md), [contrato proposto](docs/barber-contract.md) e [fronteiras da equipe](docs/access-boundaries.md).

## Dados e acesso

Configuração, registros e relatórios privados não acompanham este código. Auth, leitura remota, gravações e cobranças permanecem inativos por padrão. Não incluir senha SMTP, chave privilegiada, dados reais ou exports no repositório. Antes de operar, faltam contratos e dados verificados, adapters autorizados e validação de acesso e concorrência no servidor. Este checkpoint não ativa permissões ou produção; o AppBarber permanece o sistema oficial.
