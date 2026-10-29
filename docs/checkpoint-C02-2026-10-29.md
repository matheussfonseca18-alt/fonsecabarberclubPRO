# Checkpoint C02 — página inicial e área do barbeiro

29/10/2026. Incremento sobre C01, preservado como referência histórica. As duas entregas foram integradas ao projeto original após comparar hashes e baselines. `main.ts` recebeu somente o ramo da nova rota e a seleção obrigatória de modo real; Auth/callback continuam prioritários. Não houve alteração de dependências, launcher, configuração privada, SMTP, contas, grants, banco, cobrança ou deploy.

## Rotas e comportamento

- `/inicio`: apresentação própria, CTA para `/agendar`, Instagram no rodapé com aviso de nova aba e animação decorativa curta desativada em movimento reduzido.
- `/barbeiro`: Minha agenda, Meu rascunho, Meu desempenho e Mais. Datas, navegação, rascunhos temporários e estados de acesso distintos. O adapter permanece inativo; agenda, métricas e comissão reais não foram consultadas. `?mode=demo` não muda esse limite. Subcaminhos inválidos permanecem nesta área, sem abrir a administração.
- `/agendar`: fluxo já existente preservado; compatibilidade local não confirma reserva. Nenhum dado fictício é usado no lugar de dados reais.
- `/auth/login`: entrada existente preservada. Abrir a área da equipe não concede função ou acesso a dados.

O rascunho aceita descrições livres de serviços/produtos e quantidades somente na memória da aba. Não incluir dados de clientes. Cancelar edição e desistir do descarte preservam os itens; confirmar descarte, sair ou recarregar limpa o rascunho. Salvar no sistema permanece desabilitado. Os itens não alteram produção, comanda, estoque, receita ou comissão.

## Informações de apresentação

Logo oficial, endereço e planos estão configurados como ausentes. O código tem componentes para imagem original, localização e cartões de planos, mas não mostra valores sem verificação. Não houve instalação dos PNG oficiais, comparação dos seus pixels/hashes, confirmação de endereço ou validação de preços atuais. A marca tipográfica existente não é apresentada como a logo oficial fornecida.

O único perfil social configurado é [Instagram Fonseca Barber Club](https://www.instagram.com/fonsecabarberclub/), com origem pública indexada registrada pela entrega visual. A abertura direta do perfil sofreu limitação de tráfego naquela verificação. Outras redes não foram presumidas. O link Google fornecido não confirmou endereço porque terminou em uma verificação de tráfego; nenhuma verificação foi contornada.

## Verificação integrada

262 testes aprovados, zero falhas e zero skips; lint, typecheck, build e typecheck dos harnesses passaram na fonte canônica. O relatório combinado anterior do worker não executou navegador; o QA de integração do responsável é separado dos testes e do QA histórico dos patches.

Foram conferidos no navegador integrado: CTA da home, retorno ao booking real indisponível, modo real forçado da área do barbeiro, datas por teclado, rascunho com entradas sintéticas explicitamente identificadas, validação de quantidade, HTML exibido como texto, Cancelar/Escape/Descartar, limpeza após recarga, métricas ausentes e histórico de navegação. Dados sintéticos usados durante o QA foram descartados; não compõem catálogo nem aparecem na abertura normal.

Layouts e limites restantes devem ser lidos por dimensão: UI local e domínio testado não aprovam persistência, autorização no servidor ou operação ponta a ponta. Não foi realizado login real, consulta de agenda privada, lançamento persistido, reserva, pagamento ou teste de entrega SMTP nesta etapa.

## Próxima liberação

O [contrato do barbeiro](barber-contract.md) é uma proposta: identidade/sessão vinculadas no servidor ao tenant e profissional, projeção mínima e invalidação imediata. O menu não autoriza consultas. Comissão permanece fora da primeira liberação dos três catálogos e exigirá necessidade, contrato e permissão próprios.

Antes de conexão operacional: confirmar dados e funções, implementar adapters com origem e escopo validados, testar acessos permitidos/negados e revogação. Antes de gravar: serviço transacional, validação de concorrência/idempotência e releitura autoritativa. A área visual não autoriza ampliar acesso remoto.
