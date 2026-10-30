# Painel WhatsApp integrado — C05

O painel está integrado ao frontend em `/whatsapp` e `/whatsapp/`, acessível pela área da equipe na home e pelo menu da gestão, com rótulo **não conectado**. Rotas internas desconhecidas oferecem retorno ao painel. A raiz, Agenda, barbeiro, agendamento e prioridade do callback Auth foram preservados. `?mode=demo` não ativa fixtures no WhatsApp.

## O que existe

- Interface de conexão, consulta/lista/busca/paginação, histórico, responsável, rascunho temporário e estados de carregamento, vazio e erro.
- Montagem real usa exclusivamente o adapter inativo. Não consulta conversas e não apresenta exemplos como registros reais. Busca fica desabilitada enquanto não há acesso.
- Rascunhos somente em memória; limpeza ao sair, recarregar ou invalidar o escopo. Voltar pelo cache do navegador monta uma instância nova, sem restaurar conversas/rascunhos anteriores.
- Envio permanece bloqueado em interface, client e handler. Atribuição também está inativa no aplicativo integrado.
- Testes sintéticos isolados em `tests/`; o harness positivo não é importado por nenhuma tela real ou build público.

O painel é uma interface preparada. Ele não afirma o estado atual de uma instalação WAHA externa nem comprova conexão com um workflow existente. AppBarber continua oficial.

## Fronteiras de código

| Local | Responsabilidade | Estado |
| --- | --- | --- |
| `src/features/whatsapp/` | UI, controlador, DTOs e adapters | Host usa apenas adapter inativo |
| `src/whatsapp-page.ts` | Entrada, navegação, aviso, limpeza e retorno de bfcache | Nenhuma configuração de fornecedor ou identidade é aceita |
| `server/whatsapp/` | Bibliotecas propostas de políticas/handler, HMAC, inbox/outbox | Fora do frontend; nenhum endpoint foi montado |
| `integrations/whatsapp/n8n/` | Dois templates e validador estático | Inativos, gatilhos bloqueados, sem credenciais ou envio |
| `tests/browser/whatsapp/` | Harness claramente sintético, incluindo atribuição pendente controlável | Somente testes locais |

O adapter HTTP preparado conhece apenas `/api/whatsapp` na mesma origem, com `no-store`, redirects recusados e atribuição opt-in/CSRF. Ele não é instanciado pela rota integrada. Não há chave, sessão WAHA, segredo n8n, URL privada ou comunicação direta com provedores no frontend. Incluir os arquivos de servidor não cria API, tabela, grant ou serviço.

## Permissões e ativação futura

Antes de ligar consultas, faltam identidade autenticada e escopo fornecidos por fonte confiável, grants de leitura por papel/conversa, assinatura de invalidação/revogação e endpoints de leitura autorizados. Atribuição exige permissão própria, CSRF, revisão esperada e atualização/auditoria transacional. Menu não concede acesso.

Antes de qualquer tráfego de fornecedor, faltam repository durável, verificação de tenant, replay/retenção/limites, callbacks autenticados, gestão segura das credenciais no servidor e homologação da versão WAHA. Nenhuma dessas etapas foi ativada pela integração visual.

O envio ainda exige uma decisão separada, incluindo responsabilidades entre AppBarber e Fonseca, consentimento/opt-out, destinatários, deduplicação de negócio, outbox durável e reconciliação de resultados ambíguos. A interface não autoriza testes com clientes reais.

Contratos: [backend e acesso](backend-contract.md), [templates n8n](n8n.md) e [extensão assistida proposta](assisted-agent-extension.md).

## Verificações desta integração

368 testes passaram: a suíte anterior com L02 foi preservada e recebeu os 55 casos do pacote, cinco testes de entrada/lifecycle e um teste dos templates. Typecheck, lint, build e typecheck dos harnesses de booking e WhatsApp passaram.

QA local no navegador verificou desktop de 1440 px e mobile de 390/320 px; home/menu, entrada direta, barra final, recarga, rota inexistente, teclado, Voltar/Avançar, Agenda, barbeiro e agendamento. No harness sintético: histórico/paginação, busca sem resultados, responsável, opt-out, texto não executável, rascunhos por conversa, limpeza/recarga e ausência de escopo. Sem warnings/errors capturados no console desses fluxos.

Um problema de foco assíncrono encontrado no QA foi corrigido: um botão temporariamente desabilitado recupera o foco ao terminar, respeitando quem moveu o foco com Tab durante a espera. O harness tem `?slowAssignment=1` e o atalho Alt+R para liberar a resposta sintética e reproduzir esse caso sem servidor.

O código final e o manifesto são entregues para revisão. Não houve publicação, deploy, teste remoto da nova rota, leitura de mensagens reais, import de workflow ou envio. Os testes locais não comprovam persistência, permissões remotas ou operação ponta a ponta.
