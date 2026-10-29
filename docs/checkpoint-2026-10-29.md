# Checkpoint consolidado C01 — 29/10/2026

Este checkpoint reúne o frontend administrativo, a apresentação `/inicio`, o núcleo puro e a interface `/agendar`, as correções de horário passado/carrinho inválido/gesto assíncrono e a preparação de Auth/leitura. É código de desenvolvimento local; não é uma operação liberada em produção.

## Executar e verificar

Requer Node.js compatível com Vite 7 e `--experimental-strip-types`.

```sh
npm ci
npm run dev -- --port 5174 --strictPort
npm test
npm run typecheck
npm run lint
npm run build
npx tsc -p tests/browser/tsconfig.json
```

O servidor é somente loopback. `/inicio` apresenta o projeto; `/agendar` prepara o fluxo real sem dados fictícios; `/` abre a administração real indisponível. `/?mode=demo` é uma demonstração explicitamente separada. `/auth/login` e `/auth/callback` têm prioridade sobre parâmetros de modo. Configuração privada não acompanha esta cópia; Auth e acesso remoto permanecem inativos por padrão.

O launcher `node start-preview.mjs` mantém o preview independente do terminal, sem serviço, autostart, túnel ou alteração de firewall. Não reinicia após reboot. Não abrir `index.html` por duplo clique.

## Cobertura e limites por dimensão

| Área da matriz | Interface | Domínio | Persistência | Permissões | Ponta a ponta |
|---|---|---|---|---|---|
| M01 navegação | 13 rotas administrativas e duas rotas de apresentação/agendamento | Roteamento local | Não se aplica à navegação | Não autoriza dados | Navegação local |
| M02–M03 agenda/carrinho/extras | Grade demo e fluxo real separado; QA sintético positivo | Composição, elegibilidade e intervalos puros testados | Nenhuma reserva | Adapter real inativo | Sem bookingId compartilhado |
| M04 clientes | Consulta demo; estado real indisponível | Filtros demo e validadores locais | CRUD não conectado | Não ativadas | Não validado com dados reais |
| M05–M07 profissionais/serviços/produtos | Consulta demo, leitor real preparado, seleção sintética no harness | Regras puras de booking; contratos de leitura | Leitor inativo; nenhuma escrita/estoque | Proposta restrita, ainda não aplicada | Testes com transporte sintético |
| M08–M09 fornecedores/estoque | Estados explicativos | Operação pendente | Ausente | Pendente | Ausente |
| M10 comandas | Abertas/histórico demo | Filtros; sem fechamento/estorno | Ausente | Pendente | Ausente |
| M11–M12 planos/assinantes | Consultas demo | Sem contratação/benefício/ciclo aprovado | Ausente | Pendente | Ausente |
| M13–M18 caixa/comissões/contas/fluxo | Consultas demo; ausências explícitas | Amostras independentes; sem conciliação | Ausente | Pendente | Ausente |
| M19–M20 resultado/Raio-X/dashboard/metas | Indicadores demo | Competência separada de caixa; identidade analítica demo ainda por nome | Ausente | Pendente | Ausente |
| M21–M23 relatórios | Consultas demo e limites explícitos | Filtros próprios; fonte operacional pendente | Ausente | Pendente | Ausente |
| M24 impressão/exportação | Não implementada | Pendente | Ausente | Pendente | Ausente |
| M25–M29 parâmetros/funcionamento/restrições/avaliações/conexões | Estruturas demonstrativas ou indisponíveis | Regras operacionais não aprovadas | Ausente | Pendente | Ausente |
| M30–M33 pacotes/clube/cupons/lembretes | Sem rotas dedicadas neste checkpoint | Requisitos pendentes | Ausente | Pendente | Ausente |
| M34 Auth/base real | Primeiro acesso e leitores preparados | PKCE, cancelamento e transporte testados | Sem cadastros operacionais | Liberação depende de identidade verificada e testes remotos | SMTP/login real não concluídos |
| M35 apresentação | `/inicio` integrada | Apresentação e links | Não se aplica | Não concede acesso operacional | QA visual local |

UI não comprova persistência; testes unitários não comprovam autorização no servidor. Nenhuma reserva, cobrança, comissão paga ou saldo real é gerado pela demonstração. Clientes distintos da demonstração ainda usam nomes; migrar para IDs estáveis é obrigatório antes de uso operacional, inclusive para homônimos.

## Validação deste checkpoint

A rodada C01 executou 183 testes, typecheck, lint, build e typecheck do harness. Os resultados exatos e hashes acompanham o handoff local; logs administrativos e capturas privadas não fazem parte do pacote público. O QA positivo de booking já registrado em desktop e mobile usa somente o harness separado em `tests/browser/`, sem fallback no aplicativo real. Não representa reserva operacional, Auth real ou aprovação de todas as áreas.

As correções preservadas incluem corte por minuto superior quando o início já passou, invalidação de disponibilidade após item inválido, leitura da quantidade visível antes de avançar e preservação do botão durante Space/Enter enquanto chega uma resposta.

## Próximos incrementos

1. Área mobile da equipe e menus por capacidade: integrar em checkpoint posterior, com estados bloqueados e contrato descrito em [fronteiras de acesso](access-boundaries.md). Este C01 não contém esse patch.
2. Validar payloads externos de booking e vincular contexto de sessão/empresa/revisão sem inferir elegibilidade, incrementos, jornada, grade ou fuso.
3. Concluir SMTP e primeiro login pelo fluxo aprovado. Só depois verificar identidade e aplicar a consulta restrita dos três catálogos, com testes permitidos/negados/revogação.
4. Especificar e implementar confirmação transacional antes de qualquer reserva; compartilhar um único bookingId entre cliente e equipe.
5. Evoluir comandas, planos e finanças por regras explícitas e eventos conciliáveis. Não inferir a lógica interna de outro sistema a partir do layout.

Endereço, redes sociais, preços comerciais e retratos novos dependem de fonte verificada. Nenhuma publicação, deploy ou ativação remota decorre deste checkpoint.
