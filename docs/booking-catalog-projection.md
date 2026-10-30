# L02 — projeção pura de catálogo para agendamento

`src/integration/booking-catalog-projection.ts` acrescenta a função `projectBookingCatalog(input, expectedRevision): BookingResult<BookingCatalogData>`. Não substitui o cálculo de `booking-domain.ts`, não se conecta ao leitor remoto e não é importada pela aplicação em execução. Só os testes fornecem exemplos sintéticos.

Esta entrega atende ao recorte L02/A02: traduzir fatos explícitos para o contrato já aceito pelo agendamento. Não conclui L01 (identidade/capacidades), L03 (disponibilidade) ou L10 (reserva autoritativa).

## Entrada, versão e origem

O contrato local `BookingCatalogProjectionInput` tem `contractVersion: 1`, uma `revision` factual e cinco coleções: `professionals`, `services`, `products`, `extras` e `eligibility`. Os tipos de campos dos três catálogos são reutilizados das projeções existentes, por imports somente de tipo. Não recebe configuração de conexão, sessão, credencial ou transporte.

Cada campo consumido usa `ProjectionFact<T>`:

- `missing`: informação desconhecida; nenhum valor deve acompanhar esse estado.
- `confirmed` ou `estimated`: valor, `revision` factual e `source`, referência opaca de evidência, todos explícitos.

`expectedRevision` é obrigatório e independente do envelope. Todo fato consumido confirmado/estimado deve referenciar exatamente essa revisão; um fato de outra revisão bloqueia a projeção. O campo `version: 1` das linhas é a versão do esquema da projeção, não a revisão factual. Identidade, nomes, moeda, versão de esquema, referências e cobertura exigem confirmação.

O futuro adapter deve resolver uma revisão consistente dos catálogos e suplementos, determinar a revisão esperada e conservar a rastreabilidade fora da interface. O módulo valida a declaração de origem/revisão; não consegue provar que o emissor está autorizado, que uma fonte é verdadeira ou que a revisão recebida é a mais recente. Não existe relógio, expiração implícita, autenticação ou autorização nesta função.

Cada coleção declara cobertura com `ProjectionFact<{status: 'complete' | 'partial', total: number}>`. Exige cobertura confirmada, completa e total igual ao número de linhas. A falta da coleção, cobertura parcial, paginação incompleta ou divergência de total impede a projeção. `extras` completo com zero linhas significa nenhum vínculo; ausência de `extras` nunca assume esse significado. Uma linha de elegibilidade deve existir para cada profissional, mesmo quando seu fato `serviceIds` é desconhecido.

## Mapeamento permitido

| Entrada | Saída | Regra |
| --- | --- | --- |
| `entity_id` | `id` | ID opaco, não vazio, no máximo 128 caracteres; único dentro do tipo de entidade |
| `active` | `active` | `null` permanece desconhecido; `false` permanece inativo |
| Serviço `price_cents` | `priceCents` | Centavos inteiros não negativos; sem conversão implícita de moeda |
| Serviço `standalone_duration_minutes` | `standaloneMinutes` | Minutos inteiros não negativos; o núcleo bloqueia zero ao usar como base/serviço avulso |
| Produto `sale_price_cents` | `priceCents` | Sem campo de tempo; produto só altera preço no núcleo |
| `name` | `labels.services/products` | Texto confirmado, não vazio e até 160 caracteres, compatível com o controlador; não truncado |
| `display_name` / `full_name` | `labels.professionals` | Ambos confirmados; nome completo usado somente quando apelido é explicitamente `null` |
| `extras.baseServiceId/extraServiceId` | `extraRules` | Relação explícita, IDs existentes, sem autorrelação ou par duplicado |
| `extras.incrementalMinutes/priceCents` | Valores vinculados | Independentes dos valores avulsos; não inferidos de nome, categoria ou duração |
| `eligibility.professionalId/serviceIds` | `eligibleServiceIds` | Uma linha por profissional; IDs existentes e sem duplicação; lista confirmada é exaustiva |
| `timeZone` opcional | `timeZone` | Ausente permanece `missing`; fornecido é validado como identificador aceito pelo runtime, sem assumir UTC |
| Sem contrato de foto | `portraits: {}` | Não cria imagem de pessoa nem utiliza campo de foto inesperado |

Os IDs de serviços, produtos e profissionais pertencem a espaços separados. Mesmo nome não significa mesma identidade. A função não retorna comissão, contato, IDs de autenticação, proveniência bruta, chaves, campos extras ou metadados de ingestão. A saída é construída campo a campo, com arrays/objetos novos, sem compartilhar referências mutáveis com a entrada. DTOs com getters ou arrays esparsos são recusados; funções/Proxies executáveis não fazem parte do contrato de dados.

## Bloqueio da projeção versus bloqueio do uso

Erro estrutural, identidade/versão/moeda inválida, revisão divergente, proveniência ausente em fato conhecido, cobertura incompleta, duplicata ou referência quebrada retorna `blocked` para o catálogo inteiro. Isso inclui vínculos inválidos que ainda não foram selecionados. Não há resultado parcial silencioso.

Fatos estruturalmente válidos, porém desconhecidos/estimados, de preço, duração, atividade, incremento ou habilitação são preservados como `BookingFact`. O retorno `ready` significa apenas **projeção estrutural válida**. O núcleo continua bloqueando o uso afetado: duração avulsa desconhecida não permite serviço base, incremento desconhecido não permite extra, habilitação desconhecida não permite atribuir aquele profissional. Um item não relacionado pode permanecer utilizável. Zero confirmado de incremento é permitido; estimativa de zero não é. Lista de habilitação confirmada vazia significa explicitamente nenhum serviço, enquanto `missing` significa desconhecido.

Se um serviço possui preço/duração avulsos desconhecidos, mas atividade e vínculo/valor/incremento confirmados, seu uso como extra pode ser calculado; seu uso avulso continua bloqueado. A decisão vem dos fatos distintos aceitos pelo núcleo existente.

Quantidades são entrada do carrinho, não do catálogo. Os testes de composição usam a projeção com `priceBookingCart` e `quoteBooking`; os limites de quantidade, repetição de item e precisão dos totais continuam sendo validados pelo mesmo núcleo, sem duplicar regras.

## Aceites cobertos pelos testes

- Cabelo sintético de 40 minutos + selagem incremental de 20 = 60; a mesma selagem avulsa usa 50 minutos e preço próprio. Produto altera centavos, não minutos.
- Incremento zero explícito, desconhecido e estimado; duração avulsa zero; valores/atividade ausentes ou inativos; elegibilidade desconhecida, estimada e vazia.
- Cobertura e quantidade de linhas em todas as coleções; vínculos ausentes versus conjunto completo vazio; IDs, pares e habilitações duplicados; autorrelação e referências quebradas.
- Revisão esperada, revisão de cada fato, origem, versão de contrato/linha, rótulos e moeda; números negativos, fracionários, não finitos ou imprecisos.
- Composição com o domínio para quantidade inválida, overflow, recalculação e itens duplicados; interface do controlador aceita a saída sem produzir disponibilidade ou reserva.
- Entrada congelada, determinismo, ausência de mutação/aliasing, chave `__proto__`, getters, campos privados inesperados e metadados removidos da saída.

Executar o recorte com `node --experimental-strip-types --test tests/booking-catalog-projection.test.ts`. Executar a regressão completa com `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` e `npx tsc -p tests/browser/tsconfig.json`. Resultados executados e hashes são registrados no manifesto da entrega; o comando por si só não é evidência de aprovação.

## Próximo bloqueio concreto

O leitor atual dos três catálogos não fornece os suplementos necessários: relação base-extra, incremento e preço vinculados, elegibilidade exaustiva, revisão factual comum, cobertura dos suplementos e origem de cada fato. Também não fornece disponibilidade. É necessário definir e aprovar a fonte desses campos antes de preparar um adapter conectado. Não derivar essas informações de categorias, nomes, catálogo financeiro, observações parciais ou ausência de registros na agenda.

`inactiveBookingAdapter` permanece inativo. Reservar exige fonte de disponibilidade completa e autorização/transação no servidor, com nova validação de revisão e concorrência no momento da gravação. Nenhuma configuração, permissão, consulta privada, mensagem, reserva ou produção é ativada por esta entrega.
