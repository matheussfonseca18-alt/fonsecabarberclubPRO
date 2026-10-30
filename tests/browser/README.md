# Harness isolado de agendamento

Somente testes sintéticos. Não importar este diretório em `src` nem usá-lo como fallback do aplicativo real.

Na raiz do projeto: `node tests/browser/server.mjs`. Abrir `http://127.0.0.1:5175/` e encerrar com Ctrl+C ao terminar. O servidor usa somente loopback, porta estrita, configuração própria, `envFile:false` e `envDir:false`; não inicia Auth, leitura real ou escrita. Não contém credenciais. `npm run build` continua usando somente a entrada normal do aplicativo.

Data de teste: 01/11/2050, UTC. Selecionar Base sintética40, profissional habilitado, extra20 e produto quantidade2 deve resultar em60min/R$110. O mesmo extra como serviço avulso usa50min. Outro serviço de30min aumenta o total para90 e elimina09h/11h por não caber antes do bloqueio/intervalo. Serviço sem duração e profissional sem habilitação ficam bloqueados. Nenhuma foto real ou fictícia de pessoa é usada.

O seletor do harness controla resposta normal, pendente, vazia, ausente e erro. A resposta pendente pode ser liberada depois de Cancelar/Interromper para testar descarte. Em "Responder durante Espaço", iniciar a consulta, focar Cancelar por Tab e manter Espaço: a resposta chega durante keydown. O output mede identidade do nó pressionado e número de clicks; o resultado correto é mesmo nó=true e um cancelamento. Não existe click sintético no harness.

Verificar quantidade editada→Next, inválida→bloqueio→descartar, data alterada→opções removidas, Voltar/revisar novamente, desktop1440 e mobile390/320. A ação final permanece desabilitada em todos os cenários.

Checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` e `npx tsc -p tests/browser/tsconfig.json`. O QA de navegador usa o browser conectado; não está automatizado por esses comandos.
