# L17 / PARAM-READ-01 — integração de consulta

Revisão: `L17-PARAM-READ-01-v1`, 30/10/2026. Pacote aditivo preparado em cópia sanitizada. Nenhum arquivo existente é substituído; a integração canônica pertence ao frontend owner. O AppBarber continua operacional.

## Comportamento entregue

- Consulta local de 72 rótulos, com controles observados (67 listas e cinco campos de texto).
- 35 conjuntos completos; duas listas apenas amostradas; 30 listas sem opções recuperadas. Placeholder é orientação, nunca opção efetiva.
- Pesquisa literal por rótulo, sem diferenciar acentos/maiúsculas; limpeza e recuperação de falha. Nenhuma pesquisa remota.
- Configuração atual, defaults, obrigatoriedade e efeitos continuam desconhecidos. Não existe API para salvar ou editar parâmetros. Os campos de origem são apresentados como texto, não como formulário operacional.
- Nenhuma dependência de Auth, sessão, serviço, agenda, comissões, caixa, estoque, WhatsApp ou transporte de escrita. A tela não concede acesso e não substitui autorização no servidor.

Contrato de metadados/proveniência: [parameters-read-contract.md](parameters-read-contract.md).

## Arquivos e pontos de integração

O namespace novo é `src/parameters-read/`; CSS inteiramente sob `.pr-root`. `mount.ts` importa somente seu CSS e módulos locais. O pacote não altera `main.ts`, roteamento, Auth, gates, dependências ou o fluxo WhatsApp em integração.

O local identificado na revisão de origem é o ramo **Parâmetros** de `renderSettings` em `src/settings-view.ts`, atualmente preenchido por `pendingParameters`. `demo-app.ts` chama esse renderer. O diálogo `settings:parameters` também contém texto antigo sobre rótulos ainda pendentes; atualizar o texto ao integrar. Não modificar as demais abas.

Os helpers atuais `panel` e `dataTable` rotulam seu conteúdo como dados fictícios. Não envolver estes metadados documentados nesses helpers sem corrigir a rotulagem. O novo renderer possui seu próprio contexto de consulta e pode ser inserido diretamente após a navegação da aba.

Integração preferida, pelo owner:

1. Copiar **somente os arquivos aditivos** do manifesto, conferindo que os destinos não existem. Não copiar o snapshot inteiro nem o diretório `server` usado apenas na verificação das regressões existentes.
2. No ramo Parâmetros da superfície já autorizada, retornar um host dedicado (por exemplo, `<div data-parameters-read-host></div>`). Após montar o HTML do pai, chamar `mountParametersRead(host)`. O módulo importa seu CSS; não precisa expor nova rota.
3. Guardar o handle e chamar `dispose()` **antes** de substituir/remover o host, mudar de aba ou encerrar a superfície. Não montar duas instâncias no mesmo host. A instância pertence ao seu host e destrói também seu controller. Não compartilhar o controller entre mounts.
4. Manter as decisões atuais de acesso. Abrir esta consulta de metadados não habilita outras capacidades ou autoriza consultar valores reais.
5. Reexecutar os checks no canônico e fazer QA da aba integrada. O QA isolado não valida as permissões nem o layout de toda a aplicação canônica.

Exemplo mínimo, dentro do ciclo de vida do integrador (não é uma edição automática de `demo-app.ts`):

```ts
import { mountParametersRead } from "./parameters-read/mount.ts";

let parametersMount: ReturnType<typeof mountParametersRead> | undefined;

function unmountParameters() {
  parametersMount?.dispose();
  parametersMount = undefined;
}

function mountParameters(host: HTMLElement) {
  unmountParameters();
  parametersMount = mountParametersRead(host);
}
```

`ready` é uma Promise concluída após a tentativa de carregar os metadados. Falha ou indisponibilidade são estados da UI, não exceções a mostrar ao usuário. O controller só aceita a cobertura fixa desta revisão (72, 67/5, 35/2/30/5), além da validação estrutural; catálogo ausente ou parcial não vira pesquisa vazia.

Para composição sem mount, `view.ts` exporta `renderParametersRead(state)` e `renderParametersReadResults(state)`; o owner assume eventos, foco e ciclo de vida nesse caso. Não ligar os atributos próprios `data-parameters-*` ao editor de configurações.

## Checks reproduzíveis

```powershell
node --experimental-strip-types --test tests/parameters-read-catalog.test.ts tests/parameters-read-controller.test.ts tests/parameters-read-view.test.ts
npx tsc --noEmit -p tests/browser/parameters-read/tsconfig.json
npm run lint
npm run test
npm run build
node tests/browser/parameters-read/build.mjs
```

O último comando gera `dist-parameters` separadamente: prova que o módulo aditivo compila e é empacotado mesmo sem importação pelo entrypoint canônico. Não publicar esse output como aplicativo separado.

QA isolado opcional: `node tests/browser/parameters-read/qa.mjs`. O harness usa somente estes metadados e cenários de erro explicitamente de teste. Ele inicia Vite em `127.0.0.1:5193`, com `.env` desabilitado, e Chrome headless em contexto temporário. Bloqueia requisições externas e encerra os dois processos ao terminar. Não usa perfil, aba compartilhada, AppBarber ou credenciais. O caminho do Chrome é específico do executor Windows e deve ser adaptado em outra máquina. Nenhum cenário de teste é importado por produção.

## Limites do aceite

Conclusão permitida: **consulta dos parâmetros documentados implementada no escopo local**. Não significa configurações clonadas e funcionando. Valores vigentes, efeito de cada opção, escopo, permissões, persistência e autosave exigem contrato próprio e evidência adicional. Nenhuma regra comercial foi executada ou inferida a partir da consulta.
