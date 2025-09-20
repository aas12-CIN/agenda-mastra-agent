import { createTool } from "@mastra/core";
import { z } from "zod";

// Open‑Meteo: no need for API key.
// 1) Geocoding by city; 2) Daily forecast (max/min).
export const climaTool = createTool({
  id: "get-weather",
  description: "Busca temperatura máxima e mínima de hoje para uma cidade",
  inputSchema: z.object({
    city: z.string().describe("Ex.: São Paulo"),
    tz: z.string().optional().describe("IANA TZ, ex.: America/Sao_Paulo"),
  }),
  outputSchema: z.object({
    city: z.string(),
    tz: z.string(),
    min: z.number().nullable(),
    max: z.number().nullable(),
    units: z.string().default("°C"),
    summary: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { city } = context;
    let tz = context.tz;

    try {
      // 1) Geocoding
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          city
        )}&count=1&language=pt&format=json`
      );
      const geo = await geoRes.json();
      if (!geo?.results?.length) {
        return {
          city,
          tz: tz || "UTC",
          min: null,
          max: null,
          units: "°C",
          summary: "Cidade não encontrada",
        };
      }

      const { latitude, longitude, timezone } = geo.results[0];
      tz = tz || timezone || "UTC";

      // 2) Daily forecast
      const wxRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=${encodeURIComponent(
          tz
        )}`
      );
      const wx = await wxRes.json();

      const max = wx?.daily?.temperature_2m_max?.[0] ?? null;
      const min = wx?.daily?.temperature_2m_min?.[0] ?? null;

      return {
        city,
        tz,
        min: min === null ? null : Number(min),
        max: max === null ? null : Number(max),
        units: "°C",
        summary:
          max && min
            ? `Hoje em ${city}: mín ${min}°C, máx ${max}°C`
            : "Sem dados disponíveis",
      };
    } catch (err) {
      return {
        city,
        tz: tz || "UTC",
        min: null,
        max: null,
        units: "°C",
        summary: "Erro ao consultar clima",
      };
    }
  },
});
