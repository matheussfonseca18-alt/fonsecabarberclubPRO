# Home do projeto anterior — adaptação isolada para C06

Referência autorizada pelo usuário: [Lealweed/Fosenca-Barber-Club](https://github.com/Lealweed/Fosenca-Barber-Club), commit `3d8eeb166b2c1a87d5f91d0685bbc04f04b01695`. Revisão deste pacote: `HOME-LEGACY-01`. O usuário declarou que esse é seu projeto anterior. A adaptação destina-se ao seu sistema; não pressupõe licença aberta de terceiros ou permissão geral de redistribuição.

## Referência e decisões

Leitura pelo conector GitHub de arquivos fixados no commit, sem executar o aplicativo antigo, instalar suas dependências ou consultar seu backend:

| Fonte                                                                                                                                   | Composição reaproveitada                                                          | Decisão na adaptação                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [App.tsx, hero 359–413](https://github.com/Lealweed/Fosenca-Barber-Club/blob/3d8eeb166b2c1a87d5f91d0685bbc04f04b01695/src/App.tsx#L359) | Hero centralizado, título serifado com trecho dourado/itálico, ações arredondadas | `Eleve o seu padrão` em texto seguro; ambiente CSS, sem vídeo ou foto não verificados                              |
| App.tsx, diferenciais 439–472                                                                                                           | Três cards arredondados, hierarquia de título e texto                             | Usa o conteúdo editorial já existente de identidade, cuidado e presença; sem garantias comerciais                  |
| App.tsx, planos 474–555                                                                                                                 | Cards claros de preço, período e inclusões                                        | Reutiliza `renderPlans` e os fatos verificados atuais; não importa preços, benefícios ou selo automático do antigo |
| App.tsx, galeria 557–615                                                                                                                | Grade 2×2                                                                         | `home-gallery.ts` aceita somente fotos locais verificadas; configuração real vazia, seção omitida                  |
| App.tsx, contato/rodapé 667–914                                                                                                         | Faixas de contato e CTA final centralizado                                        | Somente canais/endereço verificados no `home-content.ts`; rotas atuais do sistema preservadas                      |
| [Header.tsx](https://github.com/Lealweed/Fosenca-Barber-Club/blob/3d8eeb166b2c1a87d5f91d0685bbc04f04b01695/src/components/Header.tsx)   | Cabeçalho persistente e menu móvel                                                | Dialog nativo com nome acessível, Escape, foco, retorno e ajuste no resize; sem o admin antigo                     |
| [index.css](https://github.com/Lealweed/Fosenca-Barber-Club/blob/3d8eeb166b2c1a87d5f91d0685bbc04f04b01695/src/index.css)                | Preto e dourado `#c5a059`, contraste tipográfico                                  | CSS local, sem Tailwind, Motion, fontes remotas, textura remota ou animação infinita                               |

Blobs GitHub observados: `App.tsx=d68ed68ceec491355400802bb5684ba1ff1f628d`, `Header.tsx=78a00c9a22bda61057cc7009048b70a232064045`, `index.css=0aa083b2c7b0922bb1e1a3db11de23ba4250cfc1`.

Estatísticas, avaliações/depoimentos, superioridade local, garantias, preços históricos, “Mais Escolhido”, prioridades/economia do clube, endereço, horários, telefone e redes antigas não foram importados como fatos atuais. A fonte tinha galeria vazia e defaults remotos de logo/vídeo. O endereço externo de logo não foi associado aos PNG oficiais do usuário; nenhum pixel dessa referência foi adotado. O pacote não contém logo redesenhada, fonte substituta como logomarca ou mídia inventada.

Na ausência da logo verificada, o cabeçalho usa apenas o nome textual comum do estabelecimento. Títulos editoriais serifados não representam a marca gráfica. Quando `homeContent.logo` for preenchido com o ativo original verificado, `renderLogo` mantém caminho e dimensões; o CSS usa `object-fit: contain`, sem filtros de brilho/contraste, recorte ou transformação dos traços.

## Escopo de arquivos

**Substituído:** somente `src/landing.ts`, o ponto de montagem já existente. Sua assinatura `startLanding()` permanece.

**Aditivos de produção:** `src/legacy-home-view.ts`, `src/legacy-home-interactions.ts`, `src/legacy-home.css`, `src/home-gallery.ts`.

**Aditivos de apoio:** testes `legacy-home.test.ts` e `home-gallery.test.ts`, este documento e o script QA. O manifesto lista hashes e todos os arquivos exatos.

`main.ts`, `home-content.ts`, `home-sections.ts`, dependências, Auth, booking, barbeiro, WhatsApp e Parâmetros ficam intactos. `landing.css` e `home-enhancement.css` continuam no projeto para histórico/reversão, mas o novo entrypoint da home importa somente `legacy-home.css`. Nenhum CSS da home entra nas áreas internas.

## Integração após C06

1. Conferir o `beforeSha256` de `src/landing.ts` no manifesto. Se divergir, reconciliar somente esse ponto de montagem; não sobrescrever trabalho concorrente.
2. Copiar os arquivos de `files/`, ou usar o patch após `git -c core.autocrlf=false apply --check home-legacy.patch`. Os arquivos entregues usam LF para comparação exata de hashes. Não copiar o snapshot inteiro, node_modules, evidências originais ou configurações locais.
3. Preservar o `home-content.ts` canônico. O pacote reutiliza seus renderizadores verificados. Planos atuais, endereço e logo não são preenchidos a partir do repositório antigo.
4. Galeria futura: preencher `homeGallery` somente com fotos aprovadas em `/brand/`, `alt`, largura/altura originais, evidência e data de conferência. São mostradas até quatro fotos válidas, como escolha de apresentação. Sem material aprovado, a seção e o link ficam ausentes.
5. Reexecutar testes, lint e build no canônico; conferir desktop/mobile e destinos atuais. A adaptação não publica o site nem muda autorizações.

Âncoras existentes (`inicio`, `conteudo`, `clube`, `experiencia`, `planos`, `encontre`, `equipe`) são preservadas quando há conteúdo. O novo destino da galeria é explicitamente `/inicio#galeria`, evitando ampliar a lista de hashes do root administrativo em `main.ts`. A home continua abrindo pelas rotas já existentes.

## Validação e capturas

```powershell
node --experimental-strip-types --test tests/legacy-home.test.ts tests/home-gallery.test.ts tests/home-content.test.ts tests/landing-entry.test.ts
npm run test
npm run lint
npm run build
node qa/legacy-home-qa.mjs
```

O QA usa Vite com `.env` desabilitado em `127.0.0.1:5194`, Chrome headless temporário e bloqueio de rede externa. Fecha navegador/servidor ao terminar. Não acessa AppBarber, Supabase, Hostinger ou abas/perfis compartilhados. O script possui caminho do Chrome específico do executor Windows.

Capturas retratam a proposta na cópia isolada: sem dados pessoais, preços inventados ou implantação. Galeria/preços/logo/endereço reais ficam ausentes até confirmação. O relatório de entrega informa os checks realmente executados; não equivale a QA da integração canônica ou do funcionamento das operações.
