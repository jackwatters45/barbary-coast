#!/usr/bin/env bun
import { FetchHttpClient, FileSystem, Path } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Console, Effect, Layer, Option } from "effect";
import {
  BARBARY_COAST,
  type BarbaryCoastAllTime,
  type BarbaryCoastSeasonSummary,
  fetchArchives,
  fetchSeason,
  type Season,
  type UlaxAllData,
  type UlaxChampionship,
  type UlaxSeasonData,
  UlaxServiceLive,
} from "../lib/ulax";

const SEASONS: Season[] = ["winter", "spring", "summer"];

// Determine current season based on month
function getCurrentSeason(): Season {
  const month = new Date().getMonth();
  if (month >= 0 && month <= 2) return "winter"; // Jan-Mar
  if (month >= 3 && month <= 5) return "spring"; // Apr-Jun
  return "summer"; // Jul-Dec (summer runs through fall)
}

// Compute Barbary Coast stats from season data
function computeBarbaryCoastSummary(
  seasonKey: string,
  data: UlaxSeasonData,
  championships: UlaxChampionship[],
): BarbaryCoastSeasonSummary | null {
  const bc = data.standings.find((s) => s.team.includes(BARBARY_COAST));
  if (!bc) return null;

  const isChampion = championships.some(
    (c) => c.champion.includes(BARBARY_COAST) && seasonKey.includes(c.season),
  );

  let result = "Regular Season";
  if (isChampion) {
    result = "Champions";
  } else if (bc.w > bc.l) {
    result = "Playoffs"; // Assume winning record = playoffs
  }

  return {
    season: seasonKey,
    wins: bc.w,
    losses: bc.l,
    ties: bc.t,
    goalsFor: bc.gf,
    goalsAgainst: bc.ga,
    result,
    isChampion,
  };
}

// Aggregate all-time stats
function computeAllTimeStats(seasons: BarbaryCoastSeasonSummary[]): BarbaryCoastAllTime {
  return seasons.reduce(
    (acc, s) => ({
      wins: acc.wins + s.wins,
      losses: acc.losses + s.losses,
      ties: acc.ties + s.ties,
      titles: acc.titles + (s.isChampion ? 1 : 0),
      goalsFor: acc.goalsFor + s.goalsFor,
      goalsAgainst: acc.goalsAgainst + s.goalsAgainst,
    }),
    { wins: 0, losses: 0, ties: 0, titles: 0, goalsFor: 0, goalsAgainst: 0 },
  );
}

const writeData = (data: UlaxAllData) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const __dirname = new URL(".", import.meta.url).pathname;
    const dataDir = path.join(__dirname, "..", "data");
    const filePath = path.join(dataDir, "ulax.json");

    yield* fs.makeDirectory(dataDir, { recursive: true });
    yield* fs.writeFileString(filePath, JSON.stringify(data, null, 2));

    const seasonCount = Object.keys(data.seasons).length;
    const gameCount = Object.values(data.seasons).reduce((acc, s) => acc + s.schedule.length, 0);

    yield* Console.log(`✓ Wrote ${seasonCount} seasons, ${gameCount} games to ${filePath}`);
  });

const printSummary = (data: UlaxAllData) =>
  Effect.gen(function* () {
    yield* Console.log("\nSummary:");
    yield* Console.log(`  Seasons: ${Object.keys(data.seasons).length}`);
    yield* Console.log(`  Championships: ${data.championships.length}`);
    yield* Console.log(`  Current season: ${data.currentSeason}`);

    const bc = data.barbaryCoast;
    yield* Console.log(
      `\nBarbary Coast All-Time: ${bc.allTime.wins}-${bc.allTime.losses}-${bc.allTime.ties}`,
    );
    yield* Console.log(`  Titles: ${bc.allTime.titles}`);
    yield* Console.log(`  Goals: ${bc.allTime.goalsFor} for, ${bc.allTime.goalsAgainst} against`);
  });

const fetchAllSeasons = Effect.gen(function* () {
  yield* Console.log("Fetching all seasons...");

  const results = yield* Effect.all(
    SEASONS.map((season) =>
      Effect.gen(function* () {
        yield* Console.log(`  Fetching ${season}...`);
        const result = yield* Effect.option(fetchSeason(season));
        if (Option.isSome(result)) {
          const data = result.value;
          if (data.schedule.length > 0 || data.standings.length > 0) {
            return [season, data] as const;
          }
        }
        yield* Console.log(`    (no data for ${season})`);
        return null;
      }),
    ),
    { concurrency: 3 },
  );

  const seasons: Record<string, UlaxSeasonData> = {};
  for (const result of results) {
    if (result) {
      seasons[result[0]] = result[1];
    }
  }

  return seasons;
});

const fetchCurrentSeasonOnly = (season: Season) =>
  Effect.gen(function* () {
    yield* Console.log(`Fetching ${season} season only...`);
    const data = yield* fetchSeason(season);
    return { [season]: data };
  });

const program = Effect.gen(function* () {
  const args = process.argv.slice(2);
  const currentOnly = args.includes("--current-only");
  const currentSeason = getCurrentSeason();

  yield* Console.log(`Syncing ULAX data...`);
  yield* Console.log(`  Current season: ${currentSeason}`);

  // Fetch championships first
  yield* Console.log("Fetching archives...");
  const championships = yield* fetchArchives();
  yield* Console.log(`  Found ${championships.length} championships`);

  // Fetch season data
  const seasons = currentOnly
    ? yield* fetchCurrentSeasonOnly(currentSeason)
    : yield* fetchAllSeasons;

  // Compute Barbary Coast stats
  const bcSeasons: BarbaryCoastSeasonSummary[] = [];
  for (const [key, data] of Object.entries(seasons)) {
    const summary = computeBarbaryCoastSummary(key, data, championships);
    if (summary) bcSeasons.push(summary);
  }

  const allData: UlaxAllData = {
    currentSeason,
    seasons,
    championships,
    barbaryCoast: {
      allTime: computeAllTimeStats(bcSeasons),
      seasons: bcSeasons,
    },
    fetchedAt: new Date().toISOString(),
  };

  yield* writeData(allData);
  yield* printSummary(allData);
});

const UlaxLive = UlaxServiceLive.pipe(Layer.provide(FetchHttpClient.layer));
const MainLayer = Layer.mergeAll(BunContext.layer, UlaxLive);

BunRuntime.runMain(program.pipe(Effect.provide(MainLayer)));
