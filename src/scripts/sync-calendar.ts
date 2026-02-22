#!/usr/bin/env bun
import { FetchHttpClient, FileSystem, Path } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Console, Effect, Layer } from "effect";
import { type CalendarData, CalendarService, CalendarServiceLive } from "../lib/calendar";

const writeData = (data: CalendarData) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const __dirname = new URL(".", import.meta.url).pathname;
    const dataDir = path.join(__dirname, "..", "data");
    const filePath = path.join(dataDir, "calendar.json");

    yield* fs.makeDirectory(dataDir, { recursive: true });
    yield* fs.writeFileString(filePath, `${JSON.stringify(data, null, 2)}\n`);

    yield* Console.log(`✓ Wrote ${data.events.length} events to ${filePath}`);
  });

const program = Effect.gen(function* () {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!calendarId || !apiKey) {
    return yield* Effect.fail(
      new Error("Missing GOOGLE_CALENDAR_ID or GOOGLE_API_KEY environment variables"),
    );
  }

  yield* Console.log("Syncing Google Calendar data...");
  yield* Console.log(`  Calendar ID: ${calendarId}`);

  const service = yield* CalendarService;
  const events = yield* service.fetchEvents(calendarId, apiKey);

  yield* Console.log(`  Fetched ${events.length} events`);

  const data: CalendarData = {
    events,
    fetchedAt: new Date().toISOString(),
  };

  yield* writeData(data);
});

const CalendarLive = CalendarServiceLive.pipe(Layer.provide(FetchHttpClient.layer));
const MainLayer = Layer.mergeAll(BunContext.layer, CalendarLive);

BunRuntime.runMain(program.pipe(Effect.provide(MainLayer)));
