# Fonseca Barber Club

Protótipo frontend de gestão de barbearia em português brasileiro, desenvolvido com TypeScript e Vite. Todos os nomes, valores e registros são fictícios. Não é um sistema de produção.

## Executar localmente

Requer Node.js 22.13+ na linha 22, ou Node.js 24+ e npm.

```sh
git clone https://github.com/matheussfonseca18-alt/fonsecabarberclubPRO.git
cd fonsecabarberclubPRO
npm ci
npm run dev -- --port 5174 --strictPort
```

Abra http://127.0.0.1:5174/. O servidor escuta somente na interface local. Não abra `index.html` por duplo clique.

## Verificações

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

O build gera `dist/`, que não faz parte do código versionado.

## Funcionalidades demonstradas

- Dashboard, agenda diária/semanal/mensal e consulta de agendamentos.
- Criação de agendamentos em memória, com detecção de conflitos.
- Consulta de clientes, profissionais, serviços e produtos; pesquisa e paginação do catálogo.
- Comandas, assinaturas, metas e indicadores gerenciais ilustrativos.

`src/demo.ts` contém as fixtures sintéticas e o repositório em memória. `src/domain.ts` concentra tipos e cálculos. As telas ficam em `src/main.ts`, `src/agenda-view.ts` e `src/catalog-view.ts`; navegação e rotas em `src/shell.ts` e `src/routing.ts`. `tests/` verifica domínio, agenda, catálogo e rotas.

## Limites do protótipo

As alterações existem apenas na memória da aba e desaparecem ao recarregar. Não há autenticação, banco de dados, persistência, pagamento, envio de mensagens, exportação ou integrações externas. Cadastros e estoque são consultas ilustrativas. Disponibilidade automática não está implementada; espaços vazios na agenda não garantem vaga.

Indicadores usam outubro de 2026 como período fixo. A agenda abre em 28/10/2026; o botão Hoje segue a data local do navegador. Agenda e produção são amostras independentes: criar agendamento não gera produção, pagamento ou comissão.

Valores monetários são representados em centavos. Produção por competência e caixa por liquidação são conceitos separados. A comissão de 40% é uma estimativa fictícia; resultado líquido não é calculado sem custos, impostos e taxas. Caixa não é conciliado com produção e não representa extrato real. Clientes distintos são recalculados por período e escopo, sem somar totais parciais.

Referências a serviços futuros na interface são apenas propostas. Antes de uso real, implementar e validar backend, permissões, isolamento de dados, persistência, regras operacionais e conciliação. Este repositório não realiza deploy.