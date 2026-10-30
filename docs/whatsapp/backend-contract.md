# Contrato backend v1

O pacote não registra rotas, abre portas, conecta banco nem chama WAHA/n8n. `backend/handlers.mjs` fornece uma função independente de framework. O integrador deve chamar `createWhatsappHandler` somente em código servidor. Nunca importar `backend/` no bundle de navegador.

## Identidade e permissões

`request.actor` é contexto verificado por middleware servidor: `{authenticated:true, userId, tenantId, role, permissions}`. Não aceitar esses campos de corpo, query, estado local, e-mail ou cabeçalhos informados pelo cliente. Validar sessão, membership ativa e empresa antes de construir o contexto em cada requisição. `csrfVerified` também é resultado de validação do servidor (token + origem/sessão), não parâmetro recebido do navegador. Negar a requisição quando essa integração de identidade não existir.

Os nomes de perfis abaixo são proposta explícita deste contrato; não afirmam papéis já implantados. O mapeamento canônico precisa ser aprovado/implementado no servidor. Perfil sozinho nunca concede acesso: requer também grants de membership.

| Perfil proposto | Limite máximo de grants | Atribuição | Envio nesta entrega |
|---|---|---|---|
| owner, admin, manager | `whatsapp.read.all`, `whatsapp.read.assigned`, `whatsapp.assign` | Exige read.all + assign + flag servidor | Bloqueado |
| receptionist | Mesmo limite acima | Mesmas condições | Bloqueado |
| barber | `whatsapp.read.assigned` | Negada | Bloqueado |
| Ausente ou desconhecido | Nenhum | Negada | Bloqueado |

Tenant e ator vêm da sessão, nunca do DTO de conversa. Barbeiro só lê conversa atribuída a ele; ID conhecido não altera essa regra. A UI recebe capacidades e as usa somente para apresentação. Ausência de permissões fecha o acesso.

## HTTP do navegador → backend

Base fixa same-origin `/api/whatsapp`. Todas as respostas: JSON, `Cache-Control: no-store`; o adaptador de rotas deve acrescentar `Content-Type: application/json` e os controles normais da aplicação. Não liberar CORS a origens arbitrárias.

| Método/rota | Resposta ou requisição |
|---|---|
| GET `/status` | `Connection` de `src/contracts.ts`, sempre `canSend:false`. Estado reflete observação servidor, não variável cliente. |
| GET `/conversations?q=&cursor=&limit=` | `{items:Conversation[],nextCursor:string\|null}`; limite 1–100; busca até 160 caracteres. |
| GET `/conversations/:id/messages?cursor=&limit=` | `{items:Message[],nextCursor:string\|null}` após conferir acesso à conversa. |
| GET `/assignees` | `User[]`; somente quem pode atribuir, somente usuários ativos da mesma empresa. |
| POST `/conversations/:id/assignment` | `{assigneeId:string\|null,expectedVersion:number}`; retorna Conversation. Requer CSRF e versão atômica. |
| POST `/conversations/:id/messages` | Sempre `423 OUTBOUND_DISABLED`; defesa adicional. O client nem oferece transporte de envio. |

Erros: `{error:{code,message}}`, sem erros brutos do provedor. 401 sessão ausente; 403 acesso/CSRF; 404 conversa inexistente ou não autorizada; 409 versão alterada; 423 integração/envio desativado; 502 DTO inválido do repository; 500 erro interno sanitizado. O cliente não deve repetir automaticamente mutações em erro ou timeout.

Configuração padrão: `readEnabled:false`, `assignmentEnabled:false`, nenhum repository. Nenhum endpoint aceita chave WAHA, URL do n8n ou mudança de estado de sessão. Não há login/QR/Connect/ativação no painel.

## Repository ainda a implementar pelo backend canônico

Métodos assíncronos obrigatórios conforme capacidades habilitadas:

```text
listConversations({tenantId,userId,assignedOnly,query,cursor,limit}) -> Page<StoredConversation>
getConversation({tenantId,id}) -> StoredConversation | null
listMessages({tenantId,conversationId,cursor,limit}) -> Page<StoredMessage>
listAssignees({tenantId}) -> StoredUser[]
getAssignableUser({tenantId,id}) -> StoredUser | null
assignConversation({tenantId,conversationId,assigneeId,expectedVersion,actorId})
  -> StoredConversation | null (conflito)
```

Registros têm `tenantId`; usuários atribuíveis têm `active:true`. Além dos campos do DTO, mensagens têm `tenantId`. O handler seleciona campos de saída: não retorna provider keys, cabeçalhos, URLs privadas, `_data` ou payload bruto. O banco deve aplicar limites/filtros antes da leitura, não retornar tudo para filtrar no navegador. Ordenação estável e cursores opacos vinculados ao tenant/filtro; mensagens ordenadas cronologicamente na página. Nenhuma consulta em massa foi realizada.

`assignConversation` deve, numa transação, comparar versão, validar membership ativa do responsável, atualizar versão e escrever auditoria de ator/data/antes/depois. Ausência/conflito retorna null. Permissões/revogação precisam ser verificadas no limite de commit conforme mecanismo de identidade do projeto. O pacote não implementa transações de banco com um mock em produção.

## WAHA → backend → n8n

Recepção futura exclusiva no backend: corpo bruto Buffer + headers HMAC permitidos → `verifyWahaEvent` → `acceptVerifiedEvent`. O normalizador implementa `fonseca.whatsapp.event.v2`, com nomes camelCase e variantes `message.received`, `message.ack`, `session.status`, `ignored`. Isso distingue o formato executável do exemplo v1/snake_case do plano anterior, que era apenas proposta e não deve ser consumido como o mesmo schema. `environment`, `instanceId`, allowlist de sessão e segredo vêm do servidor. Não aceitar ambiente/empresa do payload como autoridade. Limite inicial 1 MiB e mensagens de texto de até 10 mil caracteres; mídia e eventos desconhecidos vão para registro ignorado sem resposta automática.

HMAC SHA-512 compara bytes em tempo constante. `_data` e metadados privados não passam ao contrato normalizado. Responder sucesso ao webhook só após commit durável. `repository.insertInboxOnce({key,event,bodyDigest})` precisa de UNIQUE atômico e retornar `{kind:'inserted'}` ou `{kind:'duplicate',bodyDigest}`. Mesmo event ID com digest diferente gera conflito. `inboxKey` separa ambiente/instância/sessão; `messageEffectKey` evita novo efeito para mesmo message ID sob outro envelope.

O adapter HTTP de ingresso ainda precisa: roteamento, extração segura de cabeçalhos, limites de bytes antes de parse, retenção, política para replay antigo, tratamento de indisponibilidade como 503, logs sem corpo/segredo e teste de compatibilidade com a engine instalada. HMAC não elimina replay por si só. Não há endpoint de webhook publicado nesta entrega.

Após commit, o backend poderá chamar o webhook interno autenticado do n8n com ID interno do evento; n8n orquestra regras e devolve intenção ao backend usando credencial separada. O navegador não conhece esses URLs. Workflows em `n8n/` são esqueletos inativos com bloqueio imediato, sem chamadas externas; ver `n8n.md`.

## Outbox e coexistência com AppBarber

O backend futuro é o único emissor WAHA. `businessKey` produz chave estável por ambiente/empresa/contato/ocorrência/finalidade/regra. Um UNIQUE durável, lease de processamento e auditoria ainda devem ser implementados. Antes de enviar, revalidar ownership, consentimento específico, opt-out, pausa humana, expiração e allowlist de teste.

AppBarber permanece dono das finalidades existentes. Sem registro compartilhado de envio não existe deduplicação garantida entre dois sistemas independentes: bloquear sobreposição até um corte aprovado. `businessEligibility` é apenas avaliação, não autorização de transporte; `dispatchMessage` sempre falha com OUTBOUND_DISABLED, mesmo para intenção elegível.

`classifySendOutcome` não confunde aceite com entrega; timeout/falha de transporte sem resposta confiável vira UNKNOWN e não autoriza retry. Persistir ACK correlacionado sem repetir efeito nem rebaixar estado confirmado. Faltam worker durável, retries limitados, dead letter, reconciliação e métricas para produção.

## Configuração segura futura

API key WAHA, HMAC e credencial de callback n8n devem ser inseridos diretamente no armazenamento seguro do backend/n8n por fluxo autorizado. Não há campos de segredo no painel, nenhum segredo em arquivo deste pacote e nenhum segredo necessário para os testes. A chave API é distinta do login do Dashboard. A autorização de ativação e do piloto de mensagens continua pendente; salvar esse código não a concede.

Fontes oficiais: [WAHA Events](https://waha.devlike.pro/docs/how-to/events/), [Send messages](https://waha.devlike.pro/docs/how-to/send-messages/), [Security](https://waha.devlike.pro/docs/how-to/security/), [n8n Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook).
