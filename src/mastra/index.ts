import "dotenv/config";
import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";

import { agendaWorkflow } from "./workflows/agenda-workflow";
import { agendaAgent } from "./agents/agenda-agent";

export const mastra = new Mastra({
  workflows: { agendaWorkflow },
  agents: { agendaAgent },
  storage: new LibSQLStore({ url: ":memory:" }),
  logger: new PinoLogger({ name: "Mastra", level: "info" }),
});

// Função main removida para evitar execução automática
// O workflow agora é executado apenas pelo scheduler.ts
