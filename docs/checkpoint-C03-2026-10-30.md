# C03 — entrada e navegação das áreas integradas

O C02 continha os arquivos da página inicial e da área do barbeiro, mas a prévia publicada retornava `404 NOT_FOUND` ao abrir `/inicio` ou `/barbeiro` diretamente. A raiz abria a gestão e não oferecia caminhos para essas áreas. A comparação dos 19 arquivos de integração com o C02 congelado confirmou conteúdo idêntico; a falha observada era de entrega das rotas e descoberta das telas.

## Correção preparada

- A raiz pública `/` abre a apresentação, assim como `/inicio`. As âncoras da home continuam funcionando após recarga.
- A home oferece caminhos explícitos para barbeiro, gestão e login. `/?mode=real#Dashboard` abre a gestão sem depender de uma mudança de fragmento dentro da home.
- O menu da gestão oferece Página inicial, Área do barbeiro e Agendar atendimento. O menu Mais do barbeiro oferece retorno à página inicial.
- As entradas administrativas antigas por hash e os modos explícitos foram preservados. Callback de autenticação mantém prioridade; agendamento e barbeiro continuam em modo real, sem fallback para demonstração.
- `vercel.json` entrega `index.html` nas rotas da aplicação, sem capturar os assets. A página de erro de inicialização aponta para a home; instruções de loopback só aparecem ao abrir o arquivo local diretamente.

Os links tornam as interfaces acessíveis; não concedem funções, autenticação ou acesso a dados. A apresentação avisa que consultas reais e gravações ainda não estão liberadas. Não foram alterados adapters, permissões, dados, reservas, SMTP ou integrações de mensagens.

## Verificação executada

- 263 testes passaram, sem falhas ou skips.
- Lint, typecheck, build e typecheck dos harnesses de navegador passaram.
- QA no navegador do Codex: entrada e recarga de `/`, `/inicio`, `/inicio/`, `/barbeiro`, `/barbeiro/`; âncora da equipe; gestão/Agenda; agendamento; links de retorno; histórico Voltar/Avançar.
- Layouts desktop de 1440 px e mobile de 390 e 320 px inspecionados. Sem overflow horizontal nas páginas medidas. Menu mobile e fechamento por Escape verificados; ações da equipe acessíveis por teclado.
- Nenhum aviso ou erro de console capturado no fluxo local verificado.
- Revisão independente sem achados P1/P2 nos nove arquivos de código, configuração e testes da correção.

## Limites

Esta entrega prepara a configuração de hospedagem. Não houve novo deploy, merge ou promoção nesta etapa. Os rewrites foram revisados, mas sua execução na Vercel depende da publicação deste código. Após publicar, é necessário abrir e recarregar as rotas no host, verificar os assets e confirmar os cabeçalhos HTTP.

Não foram executados testes ponta a ponta de dados reais, autorização remota, entrega de e-mail ou persistência operacional. Logo oficial, endereço e valores atuais de planos continuam ausentes quando não verificados. O AppBarber permanece o sistema oficial; C03 não libera operação real.

Referência da exigência de roteamento SPA: [documentação oficial de Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite).
