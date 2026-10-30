# Fronteiras para equipe e próxima integração

Proposta local de 29/10/2026. Este documento não concede permissões nem define regras comerciais não confirmadas. A área mobile da equipe está sendo preparada separadamente e não integra o checkpoint C01.

## Menus e identidade

Menu é apresentação, nunca controle de acesso. Não aceitar papel, profissional ou empresa a partir de query string, storage, nome, e-mail ou metadados editáveis do usuário. Uma identidade Auth verificada deve ser vinculada por administração autorizada a uma membership ativa e, quando aplicável, a um profissional do mesmo tenant. Cadastrar um profissional não cria login.

O contrato futuro deve entregar capacidades explícitas verificadas no servidor. Até esse contrato existir, usar estado indisponível e nenhuma capacidade operacional. Não criar papel administrativo padrão, impersonação, seletor de pessoa para simular acesso, nem inferir permissão pelo menu oculto.

| Superfície proposta | Recorte mínimo a decidir | Estado enquanto não conectado |
|---|---|---|
| Minha agenda | Profissional vinculado, período, estados e campos mínimos autorizados | Não consultada; sem horários ou clientes inventados |
| Meus atendimentos | Mesmo bookingId autoritativo utilizado pela equipe e pelo cliente | Sem confirmar, finalizar ou alterar atendimento |
| Meu desempenho | Produção identificada por competência, período e fonte completa | Indisponível, nunca zero por falta de dados |
| Minha comissão | Regra versionada e autorização específica; apuração separada do pagamento | Não incluída automaticamente no catálogo ou no desempenho |
| Rascunho de lançamento | Campos e destino a aprovar; não equivale a registro salvo | Preferir não coletar dados reais antes do serviço autorizado |
| Gestão da equipe | Operações e responsáveis a aprovar separadamente | Nenhuma permissão de owner/admin concedida |

## Isolamento de dados e sessão

Os adapters devem invalidar requisições, rascunhos e resultados ao trocar identidade/empresa, sair, expirar ou perder a membership. Uma resposta atrasada não pode reaparecer. O servidor deve conferir a membership atual; não depender somente do JWT antigo. Respostas precisam distinguir não autenticado, negado, erro, indisponível e vazio confirmado.

Não ampliar as três projeções de catálogo para incluir contatos, Auth IDs, comissão ou metadados de ingestão como efeito colateral da área da equipe. Informações operacionais exigem contrato e autorização próprios. Consultas por ID direto, contagem e filtros precisam aplicar o mesmo recorte.

## Decisões objetivas antes da ativação

1. Quais contas verificadas serão vinculadas a quais profissionais? Quem pode conceder/revogar e por quanto tempo?
2. O que cada capacidade permite consultar ou alterar? Qual o recorte de clientes, agenda, produção e comissão por função?
3. Qual fonte confirma jornada, exceções, intervalos, fuso, grade, habilitação e extras? Valores ausentes não podem ser inferidos.
4. Qual operação autoritativa e idempotente gravará a reserva/lançamento? Quais estados, conflitos e cancelamentos são válidos?
5. Quais testes independentes de tenant, profissional, usuário não autorizado, token antigo, revogação e concorrência devem passar antes de liberar cada operação?

As decisões são pré-requisitos de implementação remota. Esta proposta permite avançar na interface local com limites honestos, sem criar contas, grants, RLS, envio, cobrança ou reserva.
