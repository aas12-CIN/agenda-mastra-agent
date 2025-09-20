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

// Main function removed to prevent automatic execution
// The workflow is now executed only by scheduler.ts
