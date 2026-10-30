# Extensão futura: atendimento assistido

Uma extensão futura de atendimento assistido pode produzir sugestões a partir de amostras autorizadas de conversas. A fonte e a amostra ainda precisam ser definidas. Este pacote não procura, importa nem exporta históricos.

A composição local já separa rascunho de envio. Uma extensão futura pode produzir sugestões revisáveis, mas não deve conceder capacidade de envio nem atribuição. Não há agente de IA, modelo, memória ou tool ativa neste pacote.

Contrato proposto, ainda não implementado:

```text
SuggestionRequest: conversationId, lastMessageId, policyVersion
Suggestion: id, conversationId, basedOnMessageId, text, intent,
  policyVersion, evidenceRefs[], needsHumanReview:true, expiresAt
HandoffIntent: conversationId, expectedVersion, reasonCode, queue:'reception'
```

O backend deriva tenant/ator/permissões e escolhe somente a amostra autorizada; o navegador não recebe segredo/model credentials. Sugestões são invalidadas por nova mensagem, troca de escopo, expiração, mudança de política, opt-out ou tomada de atendimento humano. O usuário revisa a sugestão antes de copiar para o rascunho. Mesmo essa cópia não envia mensagem.

Encaminhamento à recepção é uma intenção separada de resposta ao cliente. Exige autorização servidor e compare-and-swap da versão de atribuição. Pausar automação durante atendimento humano; não permitir robô e recepção responderem simultaneamente. Regras e envios ainda mantidos pelo AppBarber continuam exclusivos dele.

Antes de implementar: escolher fonte e amostra mínima de conversas, finalidade e retenção; remover identificadores desnecessários; analisar intenções/dúvidas/tom/políticas/falhas; validar regras com responsáveis autorizados; definir critérios de encaminhamento e aprovação humana. Textos de clientes são dados não confiáveis e não podem alterar instruções, credenciais, escopo, destinos ou ferramentas do agente.

Nenhuma edição, execução, publicação ou ativação de qualquer workflow é autorizada por este documento.
