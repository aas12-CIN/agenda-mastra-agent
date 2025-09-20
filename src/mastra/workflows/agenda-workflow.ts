import { createWorkflow, createStep } from "@mastra/core/workflows";
import { RuntimeContext } from "@mastra/core/di";
import { z } from "zod";

import { agendaTool } from "../tools/agenda-tool";
import { climaTool } from "../tools/clima-tool";
import { notifyTool } from "../tools/notify-tool";
import { resumoAgent } from "../agents/resumo-agent";
import { resumoScorer } from "../scorers/resumo-scorer";

const runtimeContext = new RuntimeContext();

// Helpers — calculate "today" interval in the desired timezone
function getTodayBoundsISO(tz: string) {
  const now = new Date();

  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const offsetPart =
    new Intl.DateTimeFormat("en", {
      timeZone: tz,
      hour: "2-digit",
      timeZoneName: "longOffset",
    })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value || "UTC+00:00";

  const offset = offsetPart.replace("UTC", "");

  return {
    timeMin: `${ymd}T00:00:00${offset}`,
    timeMax: `${ymd}T23:59:59${offset}`,
  };
}

// Initial Context
const buildContext = createStep({
  id: "build-context",
  description: "Define timezone, cidade e intervalo de hoje",
  inputSchema: z.object({
    tz: z.string().optional(),
    city: z.string().optional(),
    send: z.boolean().optional(),
    channel: z.enum(["telegram", "console"]).optional(),
  }),
  outputSchema: z.object({
    tz: z.string(),
    city: z.string(),
    timeMin: z.string(),
    timeMax: z.string(),
    send: z.boolean(),
    channel: z.enum(["telegram", "console"]),
  }),
  execute: async ({ inputData }) => {
    const tz =
      inputData.tz ||
      process.env.USER_TZ ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC";

    const city = inputData.city || process.env.WEATHER_CITY || "São Paulo";
    const { timeMin, timeMax } = getTodayBoundsISO(tz);

    const channel =
      inputData.channel ||
      (process.env.TELEGRAM_BOT_TOKEN ? "telegram" : "console");

    const send = inputData.send ?? false;

    return { tz, city, timeMin, timeMax, send, channel };
  },
});

// Google Calendar's events
const fetchEvents = createStep({
  id: "fetch-events",
  description: "Busca compromissos do Google Calendar",
  inputSchema: z.object({
    tz: z.string(),
    city: z.string(),
    timeMin: z.string(),
    timeMax: z.string(),
    send: z.boolean(),
    channel: z.enum(["telegram", "console"]),
  }),
  outputSchema: z.object({
    tz: z.string(),
    city: z.string(),
    send: z.boolean(),
    channel: z.enum(["telegram", "console"]),
    events: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        start: z.string(),
        end: z.string(),
        location: z.string().optional(),
      })
    ),
  }),
  execute: async ({ inputData }) => {
    const { timeMin, timeMax, tz, city, send, channel } = inputData;
    const events = await agendaTool.execute({
      context: { timeMin, timeMax },
      runtimeContext,
    });
    return { tz, city, send, channel, events };
  },
});

// Weather of the day
const fetchWeather = createStep({
  id: "fetch-weather",
  description: "Busca clima do dia",
  inputSchema: z.object({
    tz: z.string(),
    city: z.string(),
    send: z.boolean(),
    channel: z.enum(["telegram", "console"]),
    events: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        start: z.string(),
        end: z.string(),
        location: z.string().optional(),
      })
    ),
  }),
  outputSchema: z.object({
    tz: z.string(),
    city: z.string(),
    send: z.boolean(),
    channel: z.enum(["telegram", "console"]),
    events: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        start: z.string(),
        end: z.string(),
        location: z.string().optional(),
      })
    ),
    weather: z.object({
      city: z.string(),
      tz: z.string(),
      min: z.number().nullable(),
      max: z.number().nullable(),
      units: z.string(),
      summary: z.string().optional(),
    }),
  }),
  execute: async ({ inputData }) => {
    const { city, tz, events, send, channel } = inputData;
    const weather = await climaTool.execute({
      context: { city, tz },
      runtimeContext,
    });
    return { tz, city, send, channel, events, weather };
  },
});


// Recap
const summarize = createStep({
  id: "summarize",
  description: "Gera resumo curto com eventos e clima + calcula score usando Mastra Scorer",
  inputSchema: z.object({
    tz: z.string(),
    city: z.string(),
    send: z.boolean(),
    channel: z.enum(["telegram", "console"]),
    events: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        start: z.string(),
        end: z.string(),
        location: z.string().optional(),
      })
    ),
    weather: z.object({
      city: z.string(),
      tz: z.string(),
      min: z.number().nullable(),
      max: z.number().nullable(),
      units: z.string(),
      summary: z.string().optional(),
    }),
  }),
  outputSchema: z.object({
    message: z.string(),
    send: z.boolean(),
    channel: z.enum(["telegram", "console"]),
  }),
  scorers: {
    resumoQuality: {
      scorer: resumoScorer,
      sampling: {
        type: "ratio",
        rate: 1.0, // Score 100% of executions
      },
    },
  },
  execute: async ({ inputData }) => {
    const { events, weather, city, tz, send, channel } = inputData;

    const { text } = await resumoAgent.generate([
      {
        role: "user",
        content: JSON.stringify(
          {
            instrucoes:
              'Monte um texto curto em PT-BR no formato: "Hoje você tem X compromissos. Máx Y°C, mín Z°C. Sugestão: ..."',
            dados: { city, tz, eventos: events, clima: weather },
          },
          null,
          2
        ),
      },
    ]);

    const baseMessage = text.trim();
    
    return { 
      message: baseMessage, 
      send, 
      channel 
    };
  },
});

// Delivery (Telegram/Console)
const deliver = createStep({
  id: "deliver",
  description: "Entrega mensagem no Telegram ou console com score incluído",
  inputSchema: z.object({
    message: z.string(),
    send: z.boolean(),
    channel: z.enum(["telegram", "console"]),
  }),
  outputSchema: z.object({
    message: z.string(),
    deliveredTo: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const { message, send, channel } = inputData;
    
    if (!send) {
      console.log(`📱 Mensagem: ${message}`);
      return { 
        message, 
        deliveredTo: "skipped" 
      };
    }

    const ret = await notifyTool.execute({
      context: { message, channel },
      runtimeContext,
    });

    console.log(`Enviado via ${ret.channel || channel}: ${message}`);

    return {
      message,
      deliveredTo: ret.channel || channel,
    };
  },
});

// Final Workflow
export const agendaWorkflow = createWorkflow({
  id: "agenda-workflow",
  description: "Agenda + clima + resumo + score (via Mastra Scorer) + envio para Telegram/console",
  inputSchema: z.object({
    tz: z.string().optional(),
    city: z.string().optional(),
    send: z.boolean().optional(),
    channel: z.enum(["telegram", "console"]).optional(),
  }),
  outputSchema: z.object({
    message: z.string(),
    deliveredTo: z.string().optional(),
  }),
})
  .then(buildContext)
  .then(fetchEvents)
  .then(fetchWeather)
  .then(summarize)
  .then(deliver)
  .commit();
