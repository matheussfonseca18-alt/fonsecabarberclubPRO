# C07 — home adaptada do projeto anterior

A apresentação foi integrada sobre C06 nas entradas `/` e `/inicio`. A composição usa hero centralizado, título serifado, preto/dourado, cards, CTA e menu mobile inspirados no projeto anterior identificado pelo usuário. O pacote adaptado é `HOME-LEGACY-01`; sua [documentação de origem e decisões](legacy-home-adaptation.md) identifica os trechos consultados.

Somente `src/landing.ts` foi substituído. Foram acrescentados renderer, interações, CSS isolado, contrato de galeria, testes e scripts de QA. `home-content.ts` e `home-sections.ts` continuam sendo a fonte e os renderizadores dos dados de marca verificados. Nenhuma dependência do aplicativo antigo foi instalada e seu aplicativo/backend não foi executado pelo integrador.

**Logo oficial, fotos de galeria, endereço e planos atuais permanecem ausentes.** A identidade temporária é texto comum com o nome do estabelecimento. Nenhuma marca gráfica foi recriada, nenhuma logo externa foi adotada e os arquivos oficiais ainda precisam ser materializados e conferidos. Estatísticas, depoimentos, preços e benefícios antigos não foram apresentados como atuais. O Instagram já configurado foi preservado, sem abrir ou alterar a conta.

O menu mobile usa dialog nativo, nome acessível, Tab/Shift+Tab, Escape e retorno de foco. Ao passar para desktop, fecha e move o foco para a identidade. Âncoras da apresentação e links para as áreas atuais foram preservados; links não concedem permissões. A galeria só é renderizada com fotos locais verificadas e segue vazia na configuração atual.

## Verificação canônica

- 429 testes passaram, zero falhas/skips: os 411 de C06 mais 18 novos casos da adaptação/galeria.
- Lint, typecheck e build passaram.
- QA atual em 1440, 1024, 980, 768, 390 e 320 px, sem overflow horizontal medido.
- Menu mobile, foco, Tab/Shift+Tab, Escape, resize, skip link e navegação por âncoras verificados. Root e `/inicio` recarregados.
- Links para `/agendar`, `/barbeiro`, `/whatsapp`, gestão e Configurações → Parâmetros verificados com refresh. Booking permanece sem reserva, WhatsApp sem conexão, Parâmetros com 72 referências e valores desconhecidos.
- Console sem warnings/errors capturados nos fluxos executados. Revisão independente sem achados P1/P2.

As variantes com marca/galeria/planos sintéticos continuam restritas aos testes; não foram ativadas na apresentação real. O helper verificou movimento reduzido em seu QA isolado; a emulação de movimento reduzido não foi repetida pelo integrador. As capturas canônicas mostram somente a configuração real disponível nesta etapa.

C06, WhatsApp, Parâmetros, barbeiro, booking, Auth, configurações de marca, launcher e dependências foram preservados por conferência de hashes. Não houve publicação, deploy, migração, acesso a dados reais, envio de mensagem ou ativação operacional. O novo pacote de histórico WhatsApp está fora de C07. AppBarber permanece oficial.
