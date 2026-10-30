import type { ParameterReadEntry } from "./model.ts";

/** Explicit public allowlist extracted from the documented source; no raw evidence import. */
export const PARAMETERS_READ_PROVENANCE = Object.freeze({
  contractRevision: "L17-PARAM-READ-01-v1",
  sourceDocument: "appbarber-parametros-recuperados-2026-10-30.json",
  sourceRevision: "2026-10-30",
  sourceSha256:
    "7950fd3693ba2bbb056d95a0159a69a2c4a7c79ac85b94337235b5be003ebde6",
});

const entries: readonly ParameterReadEntry[] = [
  {
    localId: "parameter-read-001",
    sourceNumber: 1,
    label: "Dias para Data de Expiração de Pontos",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "declared",
      kinds: ["days"],
      label: "dias",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/0",
    },
  },
  {
    localId: "parameter-read-002",
    sourceNumber: 2,
    label: "Limite de tolerância de cancelamento de horário pelo Cliente (app)",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "15 minutos",
          kind: "choice",
        },
        {
          label: "30 minutos",
          kind: "choice",
        },
        {
          label: "45 minutos",
          kind: "choice",
        },
        {
          label: "1 hora",
          kind: "choice",
        },
        {
          label: "2 horas",
          kind: "choice",
        },
        {
          label: "3 horas",
          kind: "choice",
        },
        {
          label: "4 horas",
          kind: "choice",
        },
        {
          label: "5 horas",
          kind: "choice",
        },
        {
          label: "6 horas",
          kind: "choice",
        },
        {
          label: "7 horas",
          kind: "choice",
        },
        {
          label: "8 horas",
          kind: "choice",
        },
        {
          label: "9 horas",
          kind: "choice",
        },
        {
          label: "10 horas",
          kind: "choice",
        },
        {
          label: "11 horas",
          kind: "choice",
        },
        {
          label: "12 horas",
          kind: "choice",
        },
        {
          label: "24 horas",
          kind: "choice",
        },
        {
          label: "48 horas",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "declared",
      kinds: ["minutes", "hours"],
      label: "minutos e horas",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/1",
    },
  },
  {
    localId: "parameter-read-003",
    sourceNumber: 3,
    label:
      "Tempo (em minutos) Padrão para o Agendamento (ex: de 15 em 15 ou de 30 em 30min)",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "10 minutos",
          kind: "choice",
        },
        {
          label: "15 minutos",
          kind: "choice",
        },
        {
          label: "20 minutos",
          kind: "choice",
        },
        {
          label: "30 minutos",
          kind: "choice",
        },
        {
          label: "40 minutos",
          kind: "choice",
        },
        {
          label: "45 minutos",
          kind: "choice",
        },
        {
          label: "60 minutos",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "declared",
      kinds: ["minutes"],
      label: "minutos",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/2",
    },
  },
  {
    localId: "parameter-read-004",
    sourceNumber: 4,
    label: "Tema/Layout WebAdmin",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/3",
    },
  },
  {
    localId: "parameter-read-005",
    sourceNumber: 5,
    label: "Limite de Antecedência para Agendamento de Horário Pelo App",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "10 minutos",
          kind: "choice",
        },
        {
          label: "20 minutos",
          kind: "choice",
        },
        {
          label: "30 minutos",
          kind: "choice",
        },
        {
          label: "40 minutos",
          kind: "choice",
        },
        {
          label: "50 minutos",
          kind: "choice",
        },
        {
          label: "1 hora",
          kind: "choice",
        },
        {
          label: "2 horas",
          kind: "choice",
        },
        {
          label: "3 horas",
          kind: "choice",
        },
        {
          label: "4 horas",
          kind: "choice",
        },
        {
          label: "5 horas",
          kind: "choice",
        },
        {
          label: "6 horas",
          kind: "choice",
        },
        {
          label: "7 horas",
          kind: "choice",
        },
        {
          label: "8 horas",
          kind: "choice",
        },
        {
          label: "9 horas",
          kind: "choice",
        },
        {
          label: "10 horas",
          kind: "choice",
        },
        {
          label: "11 horas",
          kind: "choice",
        },
        {
          label: "12 horas",
          kind: "choice",
        },
        {
          label: "13 horas",
          kind: "choice",
        },
        {
          label: "14 horas",
          kind: "choice",
        },
        {
          label: "15 horas",
          kind: "choice",
        },
        {
          label: "16 horas",
          kind: "choice",
        },
        {
          label: "17 horas",
          kind: "choice",
        },
        {
          label: "18 horas",
          kind: "choice",
        },
        {
          label: "19 horas",
          kind: "choice",
        },
        {
          label: "20 horas",
          kind: "choice",
        },
        {
          label: "21 horas",
          kind: "choice",
        },
        {
          label: "22 horas",
          kind: "choice",
        },
        {
          label: "23 horas",
          kind: "choice",
        },
        {
          label: "1 dia",
          kind: "choice",
        },
        {
          label: "2 dias",
          kind: "choice",
        },
        {
          label: "3 dias",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "declared",
      kinds: ["minutes", "hours", "days"],
      label: "minutos, horas e dias",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/4",
    },
  },
  {
    localId: "parameter-read-006",
    sourceNumber: 6,
    label:
      "Habilitar Envio de Mensagem quando Agendar/Cancelar pelo Aplicativo",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/5",
    },
  },
  {
    localId: "parameter-read-007",
    sourceNumber: 7,
    label: "Permitir Agendamento no mesmo Horário pelo Cliente (Aplicativo)",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/6",
    },
  },
  {
    localId: "parameter-read-008",
    sourceNumber: 8,
    label:
      "Obrigatoriedade da Seleção da Bandeira na Comanda e na Venda de Pacotes",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/7",
    },
  },
  {
    localId: "parameter-read-009",
    sourceNumber: 9,
    label: "Limite de Agendamento Futuro pelo Cliente (em dias)",
    observedControl: {
      tag: "input",
      inputType: "text",
    },
    options: {
      completeness: "not-applicable",
    },
    unit: {
      status: "declared",
      kinds: ["days"],
      label: "dias",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/8",
    },
  },
  {
    localId: "parameter-read-010",
    sourceNumber: 10,
    label: "Não Deixar Cancelar Horários (Profissional Não-Gestor)",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Apenas App",
          kind: "choice",
        },
        {
          label: "Apenas WebAdmin",
          kind: "choice",
        },
        {
          label: "App/WebAdmin",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/9",
    },
  },
  {
    localId: "parameter-read-011",
    sourceNumber: 11,
    label: "Aprovar Solicitação de Cadastro Automaticamente",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/10",
    },
  },
  {
    localId: "parameter-read-012",
    sourceNumber: 12,
    label:
      "No Aplicativo, mostrar Comandas Abertas SOMENTE para Profissionais Envolvidos e Gestores",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Sim",
          kind: "choice",
        },
        {
          label: "Não",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/11",
    },
  },
  {
    localId: "parameter-read-013",
    sourceNumber: 13,
    label:
      "Habilitar Fechamento de Comanda no Aplicativo para Usuários Não-Gestores",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Sim",
          kind: "choice",
        },
        {
          label: "Não",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/12",
    },
  },
  {
    localId: "parameter-read-014",
    sourceNumber: 14,
    label:
      "Permitir inserção de Comandas de Profissionais no Caixa (para profissionais que pagam comandas)",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/13",
    },
  },
  {
    localId: "parameter-read-015",
    sourceNumber: 15,
    label: "Campo de Edição de Comissões na Comanda",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Mostrar",
          kind: "choice",
        },
        {
          label: "Bloquear",
          kind: "choice",
        },
        {
          label: "Não Mostrar",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/14",
    },
  },
  {
    localId: "parameter-read-016",
    sourceNumber: 16,
    label: "Não Deixar Agendar Horários pelo App Profissionais Não-Gestor",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/15",
    },
  },
  {
    localId: "parameter-read-017",
    sourceNumber: 17,
    label:
      "Ativar Baixa Automática do Contas a Receber quando chegar o Vencimento",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/16",
    },
  },
  {
    localId: "parameter-read-018",
    sourceNumber: 18,
    label: "Ativar Controle de Clientes por número de Celular",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/17",
    },
  },
  {
    localId: "parameter-read-019",
    sourceNumber: 19,
    label:
      "Tempo (em horas) para envio de Lembrete automático para agendamentos feitos pelo Aplicativo",
    observedControl: {
      tag: "input",
      inputType: "text",
    },
    options: {
      completeness: "not-applicable",
    },
    unit: {
      status: "declared",
      kinds: ["hours"],
      label: "horas",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/18",
    },
  },
  {
    localId: "parameter-read-020",
    sourceNumber: 20,
    label: "Fonte WebAdmin",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/19",
    },
  },
  {
    localId: "parameter-read-021",
    sourceNumber: 21,
    label:
      "Contabilizar pontos no programa de fidelidade apenas para agendamentos feitos pelo App / Site pelo cliente",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/20",
    },
  },
  {
    localId: "parameter-read-022",
    sourceNumber: 22,
    label:
      "Ativar envio automático de lembrete via SMS para agendamentos pelo aplicativo (caso tenha saldo de SMS)",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/21",
    },
  },
  {
    localId: "parameter-read-023",
    sourceNumber: 23,
    label:
      "Envio automático de mensagens de aniversário via Notificação no Aplicativo",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/22",
    },
  },
  {
    localId: "parameter-read-024",
    sourceNumber: 24,
    label:
      "Não mostrar telefone do cliente no Aplicativo e agendamentos do ChatBot para Usuários Não-Gestores",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/23",
    },
  },
  {
    localId: "parameter-read-025",
    sourceNumber: 25,
    label: "Limite de Dias Para Agendamento Passado",
    observedControl: {
      tag: "input",
      inputType: "text",
    },
    options: {
      completeness: "not-applicable",
    },
    unit: {
      status: "declared",
      kinds: ["days"],
      label: "dias",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/24",
    },
  },
  {
    localId: "parameter-read-026",
    sourceNumber: 26,
    label: "Mostrar Lista de Clientes no App para Usuários Não-Gestores",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/25",
    },
  },
  {
    localId: "parameter-read-027",
    sourceNumber: 27,
    label:
      "Permitir o Cadastro de Novo Cliente no App para Usuários Não-Gestores",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/26",
    },
  },
  {
    localId: "parameter-read-028",
    sourceNumber: 28,
    label:
      "Habilitar Alteração de Profissional da Agenda do App para Usuários Não-Gestores",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/27",
    },
  },
  {
    localId: "parameter-read-029",
    sourceNumber: 29,
    label: "Não Enviar Emails de Confirmação de Agendamento para o Cliente",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/28",
    },
  },
  {
    localId: "parameter-read-030",
    sourceNumber: 30,
    label: "Não Permitir a Reabertura de Caixa por Profissionais Não-Gestores",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/29",
    },
  },
  {
    localId: "parameter-read-031",
    sourceNumber: 31,
    label:
      "Não Permitir a Reabertura de Comandas por Profissionais Não-Gestores",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/30",
    },
  },
  {
    localId: "parameter-read-032",
    sourceNumber: 32,
    label:
      "Enviar link de Confirmação de Agendamento para o Cliente no Lembrete via Email, SMS e WhatsApp",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/31",
    },
  },
  {
    localId: "parameter-read-033",
    sourceNumber: 33,
    label: "Não Deixar Bloquear Horários pelo App Profissional Não-Gestor",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/32",
    },
  },
  {
    localId: "parameter-read-034",
    sourceNumber: 34,
    label: "Habilitar configuração de auxiliar",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/33",
    },
  },
  {
    localId: "parameter-read-035",
    sourceNumber: 35,
    label:
      "Ativar envio automático de mensagens de aniversário via SMS (caso tenha saldo de SMS)",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/34",
    },
  },
  {
    localId: "parameter-read-036",
    sourceNumber: 36,
    label:
      "Ativar envio automático de mensagens de retorno via SMS (caso tenha saldo de SMS)",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/35",
    },
  },
  {
    localId: "parameter-read-037",
    sourceNumber: 37,
    label: "Ativar Controle Jornada x Profissional x Serviço",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/36",
    },
  },
  {
    localId: "parameter-read-038",
    sourceNumber: 38,
    label: "Mostrar opção do sem preferência na lista de profissionais",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/37",
    },
  },
  {
    localId: "parameter-read-039",
    sourceNumber: 39,
    label:
      "Habilitar Envio de Mensagem quando Agendar/Cancelar pelo Aplicativo para Todos os Gestores",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/38",
    },
  },
  {
    localId: "parameter-read-040",
    sourceNumber: 40,
    label: "Habilitar Associação Automática do Pacote ao Agendamento",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/39",
    },
  },
  {
    localId: "parameter-read-041",
    sourceNumber: 41,
    label: "Habilitar Caixinha",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/40",
    },
  },
  {
    localId: "parameter-read-042",
    sourceNumber: 42,
    label: "Mostrar VER DIA no Caixa",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/41",
    },
  },
  {
    localId: "parameter-read-043",
    sourceNumber: 43,
    label: "Zerar Comissão ao realizar Resgate do Programa de Fidelidade",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/42",
    },
  },
  {
    localId: "parameter-read-044",
    sourceNumber: 44,
    label:
      "Não Permitir Agendamento sem Cliente por Profissionais Não-Gestores",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/43",
    },
  },
  {
    localId: "parameter-read-045",
    sourceNumber: 45,
    label: "Não Permitir a Criação de Encaixes por Profissionais Não-Gestores",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/44",
    },
  },
  {
    localId: "parameter-read-046",
    sourceNumber: 46,
    label:
      "Não gerar comissão na comanda para serviços associados a pacotes comissionados",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/45",
    },
  },
  {
    localId: "parameter-read-047",
    sourceNumber: 47,
    label:
      "Ativar envio automático de Lembrete via WhatsApp para agendamentos (caso tenha saldo de WhatsApp)",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/46",
    },
  },
  {
    localId: "parameter-read-048",
    sourceNumber: 48,
    label: "Limite de Agendamento Diários para o Cliente (Mesmo Serviço)",
    observedControl: {
      tag: "input",
      inputType: "text",
    },
    options: {
      completeness: "not-applicable",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/47",
    },
  },
  {
    localId: "parameter-read-049",
    sourceNumber: 49,
    label: "Fuso horário",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/48",
    },
  },
  {
    localId: "parameter-read-050",
    sourceNumber: 50,
    label: "Mostrar Produtos no App Cliente / Site",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/49",
    },
  },
  {
    localId: "parameter-read-051",
    sourceNumber: 51,
    label:
      "Ativar envio automático de Mensagens de Retorno via WhatsApp (caso tenha saldo de WhatsApp)",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/50",
    },
  },
  {
    localId: "parameter-read-052",
    sourceNumber: 52,
    label:
      "Ativar envio automático de Aniversário via WhatsApp (caso tenha saldo de WhatsApp)",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/51",
    },
  },
  {
    localId: "parameter-read-053",
    sourceNumber: 53,
    label: "Desativar programa de fidelidade",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/52",
    },
  },
  {
    localId: "parameter-read-054",
    sourceNumber: 54,
    label: "Início de horário da Agenda do Webadmin/App PRO",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "sampled",
      samples: {
        first: [
          {
            label: "Selecione uma Opção",
            kind: "placeholder",
          },
          {
            label: "0:05",
            kind: "choice",
          },
          {
            label: "0:10",
            kind: "choice",
          },
          {
            label: "0:15",
            kind: "choice",
          },
          {
            label: "0:20",
            kind: "choice",
          },
        ],
        last: [
          {
            label: "23:35",
            kind: "choice",
          },
          {
            label: "23:40",
            kind: "choice",
          },
          {
            label: "23:45",
            kind: "choice",
          },
          {
            label: "23:50",
            kind: "choice",
          },
          {
            label: "23:55",
            kind: "choice",
          },
        ],
      },
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/53",
    },
  },
  {
    localId: "parameter-read-055",
    sourceNumber: 55,
    label: "Mostrar caixa no App Pro para profissionais não-gestores",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Sim",
          kind: "choice",
        },
        {
          label: "Não",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/54",
    },
  },
  {
    localId: "parameter-read-056",
    sourceNumber: 56,
    label:
      "Nos agendamentos do clube de assinatura, gerar comissão com base no valor original do serviço (Sem desconto)",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Sim",
          kind: "choice",
        },
        {
          label: "Não",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/55",
    },
  },
  {
    localId: "parameter-read-057",
    sourceNumber: 57,
    label: "Não gerar comissões para itens que forem cortesias",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/56",
    },
  },
  {
    localId: "parameter-read-058",
    sourceNumber: 58,
    label: "Tamanho dos Slots da Agenda no Web",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "20px",
          kind: "choice",
        },
        {
          label: "30px",
          kind: "choice",
        },
        {
          label: "40px",
          kind: "choice",
        },
        {
          label: "50px",
          kind: "choice",
        },
        {
          label: "60px",
          kind: "choice",
        },
        {
          label: "70px",
          kind: "choice",
        },
        {
          label: "80px",
          kind: "choice",
        },
        {
          label: "90px",
          kind: "choice",
        },
        {
          label: "100px",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "declared",
      kinds: ["pixels"],
      label: "pixels",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/57",
    },
  },
  {
    localId: "parameter-read-059",
    sourceNumber: 59,
    label: "Limite de Agendamentos Futuros em Aberto por Cliente",
    observedControl: {
      tag: "input",
      inputType: "text",
    },
    options: {
      completeness: "not-applicable",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/58",
    },
  },
  {
    localId: "parameter-read-060",
    sourceNumber: 60,
    label: "Ativar Envio automático de Aniversário via Email",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/59",
    },
  },
  {
    localId: "parameter-read-061",
    sourceNumber: 61,
    label: "Final dos horários na Agenda do WebAdmin",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "sampled",
      samples: {
        first: [
          {
            label: "Selecione uma Opção",
            kind: "placeholder",
          },
          {
            label: "0:05",
            kind: "choice",
          },
          {
            label: "0:10",
            kind: "choice",
          },
          {
            label: "0:15",
            kind: "choice",
          },
          {
            label: "0:20",
            kind: "choice",
          },
        ],
        last: [
          {
            label: "23:35",
            kind: "choice",
          },
          {
            label: "23:40",
            kind: "choice",
          },
          {
            label: "23:45",
            kind: "choice",
          },
          {
            label: "23:50",
            kind: "choice",
          },
          {
            label: "23:55",
            kind: "choice",
          },
        ],
      },
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/60",
    },
  },
  {
    localId: "parameter-read-062",
    sourceNumber: 62,
    label:
      "Enviar Notificação no Aplicativo quando o Cliente estiver com Pacote Expirando",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/61",
    },
  },
  {
    localId: "parameter-read-063",
    sourceNumber: 63,
    label: "Bloquear Edição de Agendamento para Profissionais não-gestores",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Apenas App",
          kind: "choice",
        },
        {
          label: "Apenas WebAdmin",
          kind: "choice",
        },
        {
          label: "App/WebAdmin",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/62",
    },
  },
  {
    localId: "parameter-read-064",
    sourceNumber: 64,
    label:
      "Ativar envio automático de Avaliação do Atendimento via WhatsApp (caso tenha saldo de WhatsApp)",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/63",
    },
  },
  {
    localId: "parameter-read-065",
    sourceNumber: 65,
    label: "Não permitir abertura de comanda por profissionais não gestores",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/64",
    },
  },
  {
    localId: "parameter-read-066",
    sourceNumber: 66,
    label:
      "Mostrar lista de Categorias para Seleção de profissionais na agenda",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/65",
    },
  },
  {
    localId: "parameter-read-067",
    sourceNumber: 67,
    label: 'Não mostrar opção de "Não quero conversar..." no app',
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/66",
    },
  },
  {
    localId: "parameter-read-068",
    sourceNumber: 68,
    label: "Mostrar opção de assinatura por dias da semana",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/67",
    },
  },
  {
    localId: "parameter-read-069",
    sourceNumber: 69,
    label: "Mostrar Avaliação individual dos profissionais",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/68",
    },
  },
  {
    localId: "parameter-read-070",
    sourceNumber: 70,
    label: "Não deixar desbloquear horários (Profissionais não gestores)",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/69",
    },
  },
  {
    localId: "parameter-read-071",
    sourceNumber: 71,
    label: "Ativar Bloqueio por Ausência",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "complete",
      items: [
        {
          label: "Selecione uma Opção",
          kind: "placeholder",
        },
        {
          label: "Desabilitado",
          kind: "choice",
        },
        {
          label: "Habilitado",
          kind: "choice",
        },
      ],
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/70",
    },
  },
  {
    localId: "parameter-read-072",
    sourceNumber: 72,
    label:
      "Não mostrar opção de redirect para agendamentos via google (A atualização ocorre a partir de 24 horas da alteração do parâmetro )",
    observedControl: {
      tag: "select",
      inputType: null,
    },
    options: {
      completeness: "not-recovered",
    },
    unit: {
      status: "unknown",
    },
    sourceRef: {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: "/rows/71",
    },
  },
];

// Freeze only this module's fresh metadata tree, never caller-owned application state.
function freezeMetadata(value: object): void {
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === "object") freezeMetadata(child);
  }
  Object.freeze(value);
}
freezeMetadata(entries);

export const PARAMETERS_READ_CATALOG: readonly ParameterReadEntry[] = entries;
