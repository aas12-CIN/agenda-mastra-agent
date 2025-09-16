import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { agendaTool } from "../tools/agenda-tool";
import { agendaWorkflow } from "../workflows/agenda-workflow";

export const agendaAgent = new Agent({
  name: "Agenda Agent",
  instructions: `
Você é um assistente que ajuda a organizar compromissos.
Você sempre deve considerar qualquer item no array "events" como um compromisso do dia.
Se "events" estiver vazio, diga "Nenhum compromisso encontrado para hoje".
Caso contrário, liste cada compromisso com título, hora de início e fim.
Além disso, dê a previsão do tempo em Recife e a sugestão de prioridade.
Notifique o Telegram.
`,
  model: openai("gpt-4o-mini"),
  tools: { agendaTool },
  workflows: { agendaWorkflow },
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:../mastra.db", // path is relative to the .mastra/output directory
    }),
  }),
});
