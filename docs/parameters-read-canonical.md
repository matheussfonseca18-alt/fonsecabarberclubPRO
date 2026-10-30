# C06 — consulta documental de parâmetros integrada

Configurações → Parâmetros apresenta o catálogo local documentado. Endereço direto: `/?mode=real#Configura%C3%A7%C3%B5es/Par%C3%A2metros`. A aba também existe na demonstração isolada, identificada como consulta documental; a troca de modo preserva a seção. Recarregar mantém a seção e reinicia a pesquisa.

São 72 rótulos: 67 listas e cinco campos de texto. Das listas, 35 têm conjuntos completos de opções, duas têm somente amostras e 30 não tiveram opções recuperadas. Placeholders são orientação, não alternativas nem valores ativos. A proveniência e seus limites estão no [contrato](parameters-read-contract.md).

**Valores atuais, padrões, obrigatoriedade, permissões operacionais e efeitos permanecem desconhecidos.** A tela não oferece edição nem salvamento e não modifica agenda, comissão, estoque, fidelidade, caixa, notificações ou acesso de usuários. Os metadados não autorizam executar as ações descritas nos rótulos.

## Integração

- `parameters-read/` foi importado sem alteração dos 16 arquivos do pacote, após conferência de tamanho e SHA-256.
- `real-view.ts` e `settings-view.ts` fornecem um host dedicado, sem os helpers que rotulam tabelas como fictícias.
- `real-app.ts` e `demo-app.ts` montam a consulta, desmontam antes de substituir o host e tratam retorno de página. O modo real invalida renderizações pendentes ao ocultar a página.
- `routing.ts` limita seções endereçáveis a uma lista explícita e rejeita caminhos malformados. O roteador mantém o pai Configurações.
- `real.css` oculta somente o avatar decorativo do cabeçalho real até 360 px, corrigindo overflow encontrado no QA; menu, acesso e status permanecem visíveis.
- Nenhum arquivo de Auth, adapter de dados reais, WhatsApp, landing, barbeiro ou domínio de booking foi alterado.

## Verificação e limites

411 testes passaram: 368 anteriores, 37 do pacote e seis de integração. Lint, typecheck, build e typecheck dos harnesses passaram. O primeiro teste integrado revelou um import sem extensão aceito pelo Vite, mas não pelo executor Node dos testes; a extensão `.ts` foi corrigida antes da suíte final.

QA local verificou 1440/390/320 px, pesquisa com acentos e maiúsculas, nenhum resultado, limpeza/foco pelo teclado, abertura das opções completas/amostradas, valores desconhecidos, rota direta/refresh, menu, histórico e troca real/demo. Também verificou home, WhatsApp, barbeiro, booking e cancelamento repetido na Agenda demonstrativa. O overflow de 320 px foi corrigido e a largura medida novamente sem excedente. Console sem warnings/errors capturados nesses fluxos.

Revisão independente não identificou P1/P2 no pacote nem na integração. O digest documental fornecido foi conferido; o JSON original e o AppBarber não foram acessados pelo integrador. Voltar/Avançar e remontagem foram observados, mas a ativação específica do bfcache não foi instrumentada.

Nenhuma escrita remota, conexão, permissão, workflow, publicação ou deploy foi ativado. Não foi executado teste remoto nem de configurações operacionais. A home antiga permanece fora deste checkpoint. AppBarber continua oficial.
