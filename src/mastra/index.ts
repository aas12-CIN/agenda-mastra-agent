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

async function main() {
  const run = await mastra.getWorkflow("agendaWorkflow").createRunAsync();

  const result = await run.start({
    inputData: {
      // opcional: sobrescrever via CLI/ENV
      tz: process.env.USER_TZ,
      city: process.env.WEATHER_CITY,
      // channel: "telegram" | "whatsapp" | "console"
    },
  });

  if (result.status === "success") {
    console.log("Resumo enviado:", result.result.message);
  } else {
    console.error("Execução não-sucedida:", result);
  }
}

main().catch(console.error);
