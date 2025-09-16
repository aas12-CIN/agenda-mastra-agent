import { createTool } from "@mastra/core";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";

// Variables for OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

// Output typing (appointments)
interface EventData {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
}

// Tool definition
export const agendaTool = createTool({
  id: "get-calendar-events",
  description: "Busca compromissos do Google Calendar",
  inputSchema: z.object({
    timeMin: z.string().optional(),
    timeMax: z.string().optional(),
  }),
  outputSchema: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      start: z.string(),
      end: z.string(),
      location: z.string().optional(),
    })
  ),
  execute: async (context) => {
    const timeMin =
      context.input?.timeMin ??
      new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const timeMax =
      context.input?.timeMax ??
      new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

    const events = await fetchCalendarEvents(timeMin, timeMax);
    return events;
  },
});

// Function that generates the access token
async function getAccessToken(): Promise<string> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error("Faltam variáveis de OAuth no .env");
  }

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(
      "Erro ao renovar access token: " + (data?.error || resp.status)
    );
  }
  return data.access_token as string;
}

/**
 * Normalizes dates:
 * - Keeps full ISO
 * - YYYY-MM-DD → YYYY-MM-DDT00:00:00Z
 * - dd/MM/yyyy → converts to ISO
 */
function safeNormalizeDate(dateStr: string): string {
  if (!dateStr) throw new Error("Data inválida");

  // Fix formats
  const fixed = dateStr.replace("GMT", "").trim();

  const d = new Date(fixed);
  if (!isNaN(d.getTime())) {
    return d.toISOString();
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(fixed)) {
    return new Date(`${fixed}T00:00:00Z`).toISOString();
  }

  // dd/MM/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(fixed)) {
    const [day, month, year] = fixed.split("/");
    return new Date(`${year}-${month}-${day}T00:00:00Z`).toISOString();
  }

  throw new Error("Data inválida após normalização: " + dateStr);
}

// Function that calls the Google Calendar API
async function fetchCalendarEvents(
  timeMin: string,
  timeMax: string
): Promise<EventData[]> {
  try {
    console.log("ENV carregado:", {
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET ? "definido" : "faltando",
      GOOGLE_REFRESH_TOKEN: GOOGLE_REFRESH_TOKEN ? "definido" : "faltando",
    });

    const accessToken = await getAccessToken();
    const normalizedMin = safeNormalizeDate(timeMin);
    const normalizedMax = safeNormalizeDate(timeMax);

    const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      CALENDAR_ID
    )}/events?timeMin=${encodeURIComponent(
      normalizedMin
    )}&timeMax=${encodeURIComponent(
      normalizedMax
    )}&singleEvents=true&orderBy=startTime`;

    console.log("ENDPOINT:", endpoint);
    console.log("HEADERS: Bearer <token>");
    console.log("timeMin normalizado:", normalizedMin);
    console.log("timeMax normalizado:", normalizedMax);

    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error("Google Calendar API error: " + data.error?.message);
    }

    return (data.items || []).map((event: any) => ({
      id: event.id,
      title: event.summary || "Sem título",
      start: event.start?.dateTime || event.start?.date || "",
      end: event.end?.dateTime || event.end?.date || "",
      location: event.location,
    }));
  } catch (error) {
    console.error("Error fetching calendar events", error);
    throw error;
  }
}
