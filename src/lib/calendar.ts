import { HttpClient, HttpClientRequest } from "@effect/platform";
import { Context, Effect, Layer, Schema } from "effect";

// ============================================================================
// Types
// ============================================================================

export const CalendarEvent = Schema.Struct({
  id: Schema.String,
  summary: Schema.String,
  description: Schema.optionalWith(Schema.String, { default: () => "" }),
  location: Schema.optionalWith(Schema.String, { default: () => "" }),
  start: Schema.String, // YYYY-MM-DD (all-day) or ISO datetime
  end: Schema.String,
  allDay: Schema.Boolean,
});

export type CalendarEvent = typeof CalendarEvent.Type;

export interface CalendarData {
  events: CalendarEvent[];
  fetchedAt: string;
}

// ============================================================================
// Google Calendar API response types
// ============================================================================

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

interface GoogleCalendarResponse {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
}

// ============================================================================
// Service Definition
// ============================================================================

const CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars";

export class CalendarService extends Context.Tag("CalendarService")<
  CalendarService,
  {
    readonly fetchEvents: (
      calendarId: string,
      apiKey: string,
    ) => Effect.Effect<CalendarEvent[], Error>;
  }
>() {}

// ============================================================================
// Live Implementation
// ============================================================================

function transformEvent(raw: GoogleCalendarEvent): CalendarEvent | null {
  if (!raw.id || !raw.start) return null;

  const allDay = !!raw.start.date && !raw.start.dateTime;
  const start = (allDay ? raw.start.date : raw.start.dateTime) ?? "";
  if (!start) return null;
  const end = allDay ? (raw.end?.date ?? start) : (raw.end?.dateTime ?? start);

  return {
    id: raw.id,
    summary: raw.summary ?? "",
    description: raw.description ?? "",
    location: raw.location ?? "",
    start,
    end,
    allDay,
  };
}

const makeFetchEvents = (client: HttpClient.HttpClient) => (calendarId: string, apiKey: string) =>
  Effect.gen(function* () {
    const allEvents: CalendarEvent[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        key: apiKey,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "2500",
      });
      if (pageToken) params.set("pageToken", pageToken);

      const url = `${CALENDAR_API}/${encodeURIComponent(calendarId)}/events?${params}`;
      const response = yield* client.execute(HttpClientRequest.get(url));
      const json = (yield* response.json) as GoogleCalendarResponse & {
        error?: { message?: string; code?: number };
      };

      if (json.error) {
        return yield* Effect.fail(
          new Error(`Google Calendar API error ${json.error.code}: ${json.error.message}`),
        );
      }

      for (const item of json.items ?? []) {
        const event = transformEvent(item);
        if (event) allEvents.push(event);
      }

      pageToken = json.nextPageToken;
    } while (pageToken);

    return allEvents;
  });

export const CalendarServiceLive = Layer.effect(
  CalendarService,
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    return { fetchEvents: makeFetchEvents(client) };
  }),
);
