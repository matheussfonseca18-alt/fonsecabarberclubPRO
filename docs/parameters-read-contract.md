# L17 / PARAM-READ-01 — contrato de consulta dos parâmetros

Revisão do contrato: `L17-PARAM-READ-01-v1`, 30/10/2026. O catálogo representa os textos documentados e o tipo de controle observado. Não representa configurações efetivas nem executa as ações descritas pelos rótulos.

## Evidência e proveniência

Fonte: `appbarber-parametros-recuperados-2026-10-30.json`, revisão/data `2026-10-30`, campos `/rows`, `/summary` e `/limits`. Critérios: seção **L17 / PARAM-READ-01** de `delta-backlog-lote1-rea-2026-10-30.md`, 30/10/2026.

- SHA-256 dos bytes do JSON de origem: `7950fd3693ba2bbb056d95a0159a69a2c4a7c79ac85b94337235b5be003ebde6`.
- SHA-256 da projeção textual das linhas: `0dea51be0980ebe49ea926d43b7f4cc292077d0c63f9f3017fdcac020ec741c2`.
- Método registrado na fonte: snapshot DOM e leitura DOM sem alteração; associação de uma coluna textual renderizada ao controle da mesma linha. Valores de inputs, opções selecionadas e espelhos Select2 não foram lidos. Linhas ocultas foram excluídas. Essa recuperação foi evidência complementar de navegador; o motor REA não foi invocado.
- Cobertura do registro: dez rótulos estavam no viewport; 62 estavam renderizados abaixo dele. Isso não comprova percurso visual integral nem verificação operacional.

A projeção cujo hash é verificado nos testes contém, nessa ordem, `parameterNumberDisplayed`, `label`, `tag`, `inputType`, `optionsComplete`, `optionsAvailable` e `timeOptionSamples`, para cada linha na ordem original. O hash usa JSON compacto, UTF-8, sem escape ASCII de caracteres acentuados. Foi calculado diretamente da fonte na construção do pacote, antes de gerar o catálogo. O teste recompõe essa projeção a partir dos metadados entregues; não depende de caminho absoluto, conexão, arquivo externo ou acesso ao JSON original durante a execução.

O JSON integral não é importado pela aplicação. A extração usa uma lista explícita de campos públicos. Origem de rede, rota de captura, navegador, identificador de aba, `requiredHTML`, contagens de opções não inspecionadas e limites HTML não integram o catálogo. As informações de método e cobertura permanecem neste documento. A interface de consulta deve usar linguagem de produto e não apresentar detalhes internos da captura.

## Modelo e API

`src/parameters-read/catalog.ts` exporta `PARAMETERS_READ_CATALOG`, um array somente de leitura, congelado recursivamente, e `PARAMETERS_READ_PROVENANCE`, com revisão documental e hash da fonte. `src/parameters-read/model.ts` exporta os tipos e as funções puras `searchParameters(catalog, query)` e `validateParameterCatalog(value)`.

Cada `ParameterReadEntry` contém exclusivamente:

| Campo             | Contrato                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `localId`         | Identificador local `parameter-read-001` a `parameter-read-072`; não é ID de backend.            |
| `sourceNumber`    | Número observado na captura, usado documentalmente como P1…P72.                                  |
| `label`           | Texto completo e exato da fonte, preservando maiúsculas, acentos, pontuação e espaços.           |
| `observedControl` | `tag: select` com `inputType: null`, ou `tag: input` com `inputType: text`; não habilita edição. |
| `options`         | União discriminada por completude, definida abaixo.                                              |
| `unit`            | Unidade textual diretamente sustentada, ou `status: unknown`.                                    |
| `sourceRef`       | Nome do documento e ponteiro `/rows/N` correspondente à linha, com índice iniciado em zero.      |

Não existem campos para valor atual, valor selecionado, default, obrigatoriedade, escopo, autorização, efeitos, persistência, salvar ou autosave. A ausência desses fatos não equivale a falso, zero, opção desabilitada ou campo opcional. Os números Pnn são referências desta captura, sem promessa de identidade persistente na origem.

## Completude e placeholders

| `options.completeness` | Quantidade | Representação                                                                         |
| ---------------------- | ---------: | ------------------------------------------------------------------------------------- |
| `complete`             |         35 | `items` com todas as strings recuperadas na ordem original.                           |
| `sampled`              |          2 | Exclusivamente P54/P61; `samples.first` e `samples.last`, sem `items`.                |
| `not-recovered`        |         30 | Select cujo conjunto de opções não foi recuperado; não contém lista vazia substituta. |
| `not-applicable`       |          5 | Controle observado como input de texto, sem enumeração de opções.                     |

Os 35 conjuntos completos contêm 166 textos: 35 placeholders e 131 alternativas. Cada item tem apenas `label` e `kind: placeholder | choice`. A string exata `Selecione uma Opção` é classificada como `placeholder`; não é alternativa de negócio, valor backend, seleção atual nem default. As demais strings são rótulos de alternativas, sem valores de transporte inventados.

P54 e P61 preservam, cada um, as cinco strings de `first` e as cinco strings de `last`. O placeholder da primeira amostra continua identificado como tal. A contagem estrutural registrada na origem não é usada para gerar opções ausentes, preencher intervalos ou presumir uma enumeração completa. As amostras não são promovidas a conjunto completo.

## Unidades e separação de conceitos

| Referência  | Unidade textual conservada | Base                                    |
| ----------- | -------------------------- | --------------------------------------- |
| P1, P9, P25 | Dias                       | Rótulo.                                 |
| P2          | Minutos e horas            | Textos das alternativas completas.      |
| P3          | Minutos                    | Rótulo e alternativas completas.        |
| P5          | Minutos, horas e dias      | Textos das alternativas completas.      |
| P19         | Horas                      | Rótulo.                                 |
| P58         | Pixels                     | Sufixo `px` das alternativas completas. |

As demais unidades permanecem desconhecidas. P54/P61 contêm textos de horário; o modelo não os converte em unidade de duração. Os dias da semana mencionados em P68 são assunto do rótulo; as 24 horas de P72 descrevem um efeito declarado, não a unidade de uma configuração. Os atributos HTML `min: 0` de P48/P59 não são transportados como regra de negócio, valor atual ou default.

Não há normalização numérica nem conversão entre as unidades mistas. P3 não fornece duração de serviço ou incremento de Extra; P58 não fornece tempo nem capacidade; P54/P61 não estabelecem jornada. A abertura ou pesquisa do catálogo não altera preço, disponibilidade, reserva, comissão, caixa, estoque ou capacidade de acesso. Os módulos de metadados não contêm transporte de rede, adapter, armazenamento, DOM ou executor de efeitos.

## Pesquisa, validação e integração

`searchParameters` pesquisa somente rótulos, desconsiderando acentos e caixa. A consulta é literal, sem expressão regular ou interpretação de HTML. Uma consulta em branco retorna as 72 linhas em sua ordem documental. O retorno é um novo array e não altera o catálogo nem o estado de outro domínio.

`validateParameterCatalog` recebe `unknown` e retorna `{ valid, issues }`. Verifica estrutura, chaves permitidas, identidade e referência únicas, relação entre controle e completude, classificação do placeholder e tipos de unidade. É um validador estrutural de metadados: não autentica proveniência de dados arbitrários, não determina política de autorização e não valida configurações operacionais. O teste de hash fixa o conteúdo exato do catálogo fornecido. Uma lista estruturalmente válida pode ser vazia; o estado de carregamento/disponibilidade da interface é responsabilidade do controller.

O renderer deve tratar rótulos como texto, escapar conteúdo quando usar templates HTML, mostrar valor atual indisponível e distinguir ausência de correspondências de erro de catálogo. Deve apresentar a completude e identificar o placeholder sem oferecer salvar ou editar parâmetros. Os testes de renderer/controller e os estados `loading`, `ready`, `error` e `unavailable` pertencem à integração do owner, separada destes metadados.

## Verificação deste pacote

Comando executado em 30/10/2026:

```text
node --experimental-strip-types --test tests/parameters-read-catalog.test.ts
```

Resultado: **16 testes aprovados, zero falhas, zero skips**. Cobertura: contagens e unicidade; comparação de todos os textos, tipos, opções e amostras pelo digest independente; referências de origem; completude; placeholders; unidades; ausência de valores efetivos e contexto de captura; busca literal e limpeza; imutabilidade; rejeição de metadados fora do contrato; ausência de transporte, persistência e execução de HTML nos módulos de metadados.

Também executados com código de saída zero: ESLint sobre os dois módulos e seu teste; TypeScript em modo estrito, sem emissão, limitado a `model.ts` e `catalog.ts` (`ES2022`, `ESNext`, resolução `bundler`). Esses checks são locais ao escopo deste helper e não substituem os checks completos da integração. Os quatro arquivos foram formatados com o Prettier local do projeto.

Esses testes locais não aprovam autorização, persistência, regras operacionais, todos os viewports ou experiência visual integrada. Revisão/hash da entrega, checks completos e QA da integração devem constar da evidência produzida pelo owner. A conclusão permitida ao integrar e verificar este pacote é **consulta dos parâmetros documentados implementada no escopo local**. A evidência não sustenta configurações operacionais clonadas ou funcionando.
