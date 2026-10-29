# Área mobile do barbeiro — integração C02

**Estado atual:** integrada à fonte canônica em C02, junto da melhoria da página inicial. A suíte integrada passou com 262 testes. Os números e o QA listados na seção histórica abaixo pertencem ao patch isolado; não são uma nova execução no projeto original. Ver [checkpoint C02](checkpoint-C02-2026-10-29.md) para o escopo da integração e seus limites.

Entrada: `/barbeiro` ou `/barbeiro/`, com navegação `#agenda`, `#rascunho`, `#desempenho` e `#mais`. A família `/barbeiro/…` fica reservada: subcaminhos desconhecidos mostram uma tela de endereço inválido da própria área, sem cair no dashboard administrativo. `?mode=demo` não ativa demonstração nessa entrada. Auth/callback mantém prioridade sobre todos os caminhos; `/inicio`, `/agendar` e a raiz administrativa preservam seu comportamento.

## Contrato incremental

O [contrato de domínio](barber-contract.md) distingue a proposta de navegação por função de autorização no servidor. Os papéis proprietário/administração, recepção e barbeiro são extensíveis; nenhum papel, conta ou permissão foi concedido. O menu do barbeiro contém somente suas telas propostas.

O adapter padrão é inativo e não tem método de escrita. A futura consulta deverá obter o vínculo de sessão por um canal confiável, de forma independente da resposta da agenda. Tenant, conta, profissional e sessão não são aceitos da URL ou do formulário. Cada resposta deve representar exclusivamente o profissional autorizado, com a data exata pedida. Linhas de outro tenant/profissional, contextos divergentes, dados inválidos e datas locais incorretas rejeitam a resposta completa. O servidor ainda precisa aplicar autorização e garantir uma consulta completa; essas validações no navegador não substituem essa responsabilidade.

A projeção retém somente nome de exibição do cliente do atendimento, horários, rótulos de serviços e estado fornecido pelo sistema. Não há telefone, e-mail, histórico do cliente, diretório geral, valores de colegas ou finanças da empresa. Horários e o botão Hoje usam o fuso confirmado na resposta; antes da primeira consulta, a data segue o dispositivo e isso é informado.

O resumo individual usa somente métricas fornecidas pelo sistema. Ausente é `Não informado`, não zero. Comissão usa o valor e período informados; nenhuma fórmula, percentual, pagamento, saldo ou valor a receber é inferido. Formatação de unidades menores considera a moeda recebida. Quantidades de rascunho não alimentam resumo, comissão, estoque, comanda ou agenda.

## Interações entregues

- **Agenda:** consulta diária, escolher data, Hoje, dia anterior/próximo; estados indisponível, autenticação necessária, proibido, erro, carregando e resultado vazio verificado são distintos. Detalhes mostram o mínimo do atendimento atribuído. Fechar o painel não altera o rascunho.
- **Rascunho:** incluir, editar e remover itens de serviço/produto; descrição livre até 120 caracteres, quantidade inteira de 1 a 99, máximo de 20 itens. São limites locais do protótipo, não regras comprovadas do AppBarber. Não há cadastro de cliente nem preço presumido. Itens podem ser organizados sem vínculo; um vínculo só aceita um atendimento próprio presente na consulta validada.
- **Salvar:** continua desabilitado. Mesmo que o DOM seja manipulado, a ação informa indisponibilidade, sem transporte ou sucesso fictício. Rascunhos vivem somente na memória da aba. Recarregar/sair limpa os itens. Descartar exige confirmação local; Cancelar/Escape preservam os itens.
- **Desempenho:** resumo diário próprio e comissão informada, com estados desconhecidos explícitos. Não há dados inventados para preencher a tela.
- **Mais:** explica o acesso individual e os limites atuais; oferece apenas o destino de autenticação existente. Não cria acesso administrativo nem novas contas.

Troca/invalidação de contexto limpa dados e rascunhos imediatamente; requisições em andamento são canceladas e respostas atrasadas descartadas. Editor ainda não enviado também é limpo. Rascunho vinculado é descartado ao mudar atendimento/data ou atualizar a consulta; fechar detalhes não muda seu vínculo. No retorno por BFCache, dados sensíveis foram limpos e a página recarrega, sem restaurar o rascunho.

## Evidência e escolhas próprias

Foram consultados os documentos sanitizados `evidence/rastreabilidade-rea.md` e `evidence/modules-acceptance.md` do projeto original. Eles sustentam os rótulos genéricos da agenda, serviços, produtos e relatórios. Não comprovam o menu de uma conta de barbeiro, autorização para lançar itens ou fórmula real de comissão. A hipótese fictícia de 40% foi excluída desta área.

Navegação inferior, layout mobile, rascunho local, tipos de acesso, limites de validação e política de agrupar atendimento pelo dia local de início são propostas Fonseca. O fim de um atendimento pode cruzar meia-noite; seu início precisa pertencer ao dia consultado. Não se alega equivalência operacional com AppBarber. Nenhum acesso novo ao AppBarber foi feito pelo executor visual.

## Validação histórica do patch isolado

- Build e `tsc --noEmit`: passaram.
- Lint do projeto: passou.
- Suíte completa: **256 testes passaram**, zero falhas/skips. Destes, 73 são testes novos de domínio/controller/entrada da área do barbeiro.
- QA em Chrome headless temporário, porta loopback 5191, sem `.env` ou perfil/abas compartilhados: quatro telas em 1440, 768, 390 e 320 CSS px, sem overflow horizontal.
- Fluxos conferidos: inclusão/edição local, texto HTML escapado, quantidade inválida, salvar indisponível, descarte/Cancel/Escape, teclado nas datas e atualização, skip link, limpeza após recarga, restauração após `pagehide/pageshow` persistidos, namespace inválido, movimento reduzido e isolamento de módulos.
- Um harness exclusivamente em `tests/browser/` verificou vínculo próprio, preservação do rascunho ao fechar detalhes e limpeza de dados/editor após invalidação. Ele é sintético, explicitamente sinalizado e não integra o build de produção nem as capturas destinadas ao usuário.
- Zero erros JavaScript ou requisições externas no QA. O navegador bloqueava destinos externos; nenhuma tentativa ocorreu.
- Revisão independente Astra Ultra: os achados de histórico, foco, fuso, minimização e descarte foram corrigidos e rechecados.

## Integração e limites restantes

Na integração C02 foram aplicados somente os arquivos revisados, com alterações pontuais em `src/main.ts` para preservar o login. A página inicial foi integrada separadamente. Para a entrega ao Git, usar exclusivamente o manifesto congelado C02; não reaplicar estes patches nem copiar a pasta de desenvolvimento inteira, `.env`, dependências ou `dist`.

Não houve escrita em produção, ativação de grants, criação de conta, migração, configuração SMTP, deploy ou push. Backend, leitura real, catálogo autorizado para lançamentos e gravação continuam pendentes de contratos/permissões aprovados. O patch isolado preservou o original; sua integração foi realizada posteriormente em C02. `/barbeiro` está disponível no preview local. A URL loopback não está publicada na internet nem acessível remotamente no celular.
