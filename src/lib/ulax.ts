import { HttpClient, HttpClientRequest } from "@effect/platform";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { Context, Effect, Layer, Schema } from "effect";

// ============================================================================
// Types
// ============================================================================

// Score: number, null, or empty string -> normalized to number | null
const ScoreSchema = Schema.transform(
  Schema.Union(Schema.Number, Schema.Null, Schema.Literal("")),
  Schema.NullOr(Schema.Number),
  {
    decode: (val) => (val === "" ? null : val),
    encode: (val) => val,
  },
);

export const UlaxGameRaw = Schema.Struct({
  id: Schema.Number,
  gamedate: Schema.String,
  gametime: Schema.String,
  field: Schema.String,
  awayteam: Schema.String,
  awayscore: ScoreSchema,
  hometeam: Schema.String,
  homescore: ScoreSchema,
  gametype: Schema.Number,
  typename: Schema.String,
});

export type UlaxGameRaw = typeof UlaxGameRaw.Type;

export interface UlaxGame {
  id: number;
  date: string; // YYYY-MM-DD format
  time: string;
  field: string;
  awayTeam: string;
  awayScore: number | null;
  homeTeam: string;
  homeScore: number | null;
  gameType: "regular" | "playoff" | "championship";
  typeName: string;
  isBarbaryCoast: boolean;
  barbaryCoastIsHome: boolean | null;
}

// Alias for backwards compatibility
export type UlaxGameSerialized = UlaxGame;

export interface UlaxStanding {
  team: string;
  gp: number;
  w: number;
  l: number;
  t: number;
  pts: number;
  gf: number;
  ga: number;
}

export interface UlaxData {
  schedule: UlaxGame[];
  standings: UlaxStanding[];
  fetchedAt: string;
  season: string;
}

export const SeasonSchema = Schema.Literal("winter", "spring", "summer");
export type Season = typeof SeasonSchema.Type;

// Player stats from stats page
export const UlaxPlayerStats = Schema.Struct({
  name: Schema.String,
  number: Schema.String,
  team: Schema.String,
  gp: Schema.Number,
  goals: Schema.Number,
  assists: Schema.Number,
  points: Schema.Number,
});
export type UlaxPlayerStats = typeof UlaxPlayerStats.Type;

// Goalie stats from stats page
export const UlaxGoalieStats = Schema.Struct({
  name: Schema.String,
  number: Schema.String,
  team: Schema.String,
  wins: Schema.Number,
  losses: Schema.Number,
  goalsAgainst: Schema.Number,
  saves: Schema.Number,
  savePercentage: Schema.Number,
});
export type UlaxGoalieStats = typeof UlaxGoalieStats.Type;

// Roster player from rosters page
export const UlaxRosterPlayer = Schema.Struct({
  name: Schema.String,
  number: Schema.String,
  position: Schema.String,
  height: Schema.String,
  weight: Schema.String,
  age: Schema.String,
  homeTown: Schema.String,
  team: Schema.String,
  isCaptain: Schema.Boolean,
  isAssistantCaptain: Schema.Boolean,
});
export type UlaxRosterPlayer = typeof UlaxRosterPlayer.Type;

// Championship from archives
export const UlaxChampionship = Schema.Struct({
  year: Schema.Number,
  season: SeasonSchema,
  division: Schema.String,
  champion: Schema.String,
});
export type UlaxChampionship = typeof UlaxChampionship.Type;

// Barbary Coast summary stats
export const BarbaryCoastSeasonSummary = Schema.Struct({
  season: Schema.String,
  wins: Schema.Number,
  losses: Schema.Number,
  ties: Schema.Number,
  goalsFor: Schema.Number,
  goalsAgainst: Schema.Number,
  result: Schema.String,
  isChampion: Schema.Boolean,
});
export type BarbaryCoastSeasonSummary = typeof BarbaryCoastSeasonSummary.Type;

export const BarbaryCoastAllTime = Schema.Struct({
  wins: Schema.Number,
  losses: Schema.Number,
  ties: Schema.Number,
  titles: Schema.Number,
  goalsFor: Schema.Number,
  goalsAgainst: Schema.Number,
});
export type BarbaryCoastAllTime = typeof BarbaryCoastAllTime.Type;

// Composite types use interfaces since they reference other complex types
export interface UlaxSeasonData {
  schedule: UlaxGame[];
  standings: UlaxStanding[];
  playerStats: UlaxPlayerStats[];
  goalieStats: UlaxGoalieStats[];
  roster: UlaxRosterPlayer[];
}

export interface UlaxSeasonDataSerialized extends Omit<UlaxSeasonData, "schedule"> {
  schedule: UlaxGameSerialized[];
}

export interface UlaxAllData {
  currentSeason: string;
  seasons: Record<string, UlaxSeasonData>;
  championships: UlaxChampionship[];
  barbaryCoast: {
    allTime: BarbaryCoastAllTime;
    seasons: BarbaryCoastSeasonSummary[];
  };
  fetchedAt: string;
}

export interface UlaxAllDataSerialized extends Omit<UlaxAllData, "seasons"> {
  seasons: Record<string, UlaxSeasonDataSerialized>;
}

// ============================================================================
// Helpers
// ============================================================================

export const BARBARY_COAST = "Barbary Coast";

/**
 * Find a table element that contains all the specified header texts.
 * Returns null if no matching table is found.
 */
function findTableWithHeaders(
  $: cheerio.CheerioAPI,
  requiredHeaders: string[],
): cheerio.Cheerio<Element> | null {
  let foundTable: cheerio.Cheerio<Element> | null = null;
  $("table").each((_, table) => {
    const headers = $(table)
      .find("th")
      .map((_, th) => $(th).text().trim())
      .get();
    if (requiredHeaders.every((h) => headers.includes(h))) {
      foundTable = $(table);
      return false; // break
    }
  });
  return foundTable;
}

/**
 * Extract team name from the preceding team logo image (x50.png).
 * Used on stats/roster pages where team logo precedes each team's table.
 */
function extractTeamFromImage($: cheerio.CheerioAPI, table: cheerio.Cheerio<Element>): string {
  const prevImg = $(table).prevAll("img[src*='x50.png']").first();
  const src = prevImg.attr("src") || "";
  const match = src.match(/\/([^/]+)_x50\.png/);
  return match
    ? match[1]
        .replace(/_/g, " ")
        .replace(/\s*\(.*\)/, "")
        .trim()
    : "";
}

function parseGameDate(dateStr: string): string {
  // Format: "January 11, 2026" -> "2026-01-11"
  // Return as YYYY-MM-DD string to avoid timezone issues in JSON serialization
  const parsed = new Date(dateStr);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseGameType(type: number): "regular" | "playoff" | "championship" {
  switch (type) {
    case 1:
      return "playoff";
    case 2:
      return "championship";
    default:
      return "regular";
  }
}

function transformGame(raw: UlaxGameRaw): UlaxGame {
  const isBarbaryCoast =
    raw.hometeam.includes(BARBARY_COAST) || raw.awayteam.includes(BARBARY_COAST);
  const barbaryCoastIsHome = isBarbaryCoast ? raw.hometeam.includes(BARBARY_COAST) : null;

  return {
    id: raw.id,
    date: parseGameDate(raw.gamedate),
    time: raw.gametime,
    field: raw.field,
    awayTeam: raw.awayteam.trim(),
    awayScore: raw.awayscore,
    homeTeam: raw.hometeam.trim(),
    homeScore: raw.homescore,
    gameType: parseGameType(raw.gametype),
    typeName: raw.typename,
    isBarbaryCoast,
    barbaryCoastIsHome,
  };
}

// ============================================================================
// Service Definition
// ============================================================================

const SCHEDULE_API =
  "https://ulax.org/assets/getData/getDataSeasons.php?type=schedule&league=sanfran&season=";
const BASE_URL = "https://ulax.org/sanfrancisco/men/";

export class UlaxService extends Context.Tag("UlaxService")<
  UlaxService,
  {
    readonly fetchSchedule: (season: Season) => Effect.Effect<UlaxGame[], Error>;
    readonly fetchStandings: (season: Season) => Effect.Effect<UlaxStanding[], Error>;
    readonly fetchStats: (
      season: Season,
    ) => Effect.Effect<{ players: UlaxPlayerStats[]; goalies: UlaxGoalieStats[] }, Error>;
    readonly fetchRoster: (season: Season) => Effect.Effect<UlaxRosterPlayer[], Error>;
    readonly fetchArchives: () => Effect.Effect<UlaxChampionship[], Error>;
    readonly fetchSeason: (season: Season) => Effect.Effect<UlaxSeasonData, Error>;
    readonly fetchAll: (season: Season) => Effect.Effect<UlaxData, Error>;
  }
>() {}

// ============================================================================
// Live Implementation
// ============================================================================

const makeFetchSchedule = (client: HttpClient.HttpClient) => (season: Season) =>
  Effect.gen(function* () {
    const url = `${SCHEDULE_API}${season}`;

    const response = yield* client.execute(HttpClientRequest.get(url));
    const json = yield* response.json;

    if (!Array.isArray(json)) {
      return yield* Effect.fail(new Error("Expected array response"));
    }

    const games: UlaxGame[] = [];
    let errorCount = 0;
    for (const item of json) {
      const parsed = Schema.decodeUnknownEither(UlaxGameRaw)(item);
      if (parsed._tag === "Right") {
        games.push(transformGame(parsed.right));
      } else {
        errorCount++;
        yield* Effect.logWarning(`Failed to parse game: ${JSON.stringify(item)}`);
      }
    }

    if (errorCount > 0) {
      yield* Effect.logWarning(
        `Schedule parsing: ${errorCount} of ${json.length} games failed validation`,
      );
    }

    return games;
  });

const makeFetchStandings = (client: HttpClient.HttpClient) => (season: Season) =>
  Effect.gen(function* () {
    const url = `${BASE_URL}${season}/standings`;

    const response = yield* client.execute(HttpClientRequest.get(url));
    const html = yield* response.text;

    const $ = cheerio.load(html);
    const standings: UlaxStanding[] = [];

    // Find the standings table - look for table with GP, W, L columns
    const table = findTableWithHeaders($, ["GP", "W", "L"]);
    if (table) {
      table.find("tbody tr").each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length >= 8) {
          const team = $(cells[0]).text().trim();
          if (team) {
            standings.push({
              team,
              gp: Number.parseInt($(cells[1]).text().trim(), 10) || 0,
              w: Number.parseInt($(cells[2]).text().trim(), 10) || 0,
              l: Number.parseInt($(cells[3]).text().trim(), 10) || 0,
              t: Number.parseInt($(cells[4]).text().trim(), 10) || 0,
              pts: Number.parseInt($(cells[5]).text().trim(), 10) || 0,
              gf: Number.parseInt($(cells[6]).text().trim(), 10) || 0,
              ga: Number.parseInt($(cells[7]).text().trim(), 10) || 0,
            });
          }
        }
      });
    }

    return standings;
  });

const makeFetchStats = (client: HttpClient.HttpClient) => (season: Season) =>
  Effect.gen(function* () {
    const url = `${BASE_URL}${season}/stats`;

    const response = yield* client.execute(HttpClientRequest.get(url));
    const html = yield* response.text;

    const $ = cheerio.load(html);
    const players: UlaxPlayerStats[] = [];
    const goalies: UlaxGoalieStats[] = [];

    // Find all stats tables - need to iterate since there are multiple tables per team
    $("table").each((_, tableEl) => {
      const $table = $(tableEl);
      const headers = $table
        .find("th")
        .map((_, th) => $(th).text().trim())
        .get();

      // Player stats table: Name, #, GP, G, A, PTS (but not W, which indicates goalie table)
      if (
        headers.includes("GP") &&
        headers.includes("G") &&
        headers.includes("A") &&
        headers.includes("PTS") &&
        !headers.includes("W")
      ) {
        const team = extractTeamFromImage($, $table);

        $table.find("tbody tr").each((_, row) => {
          const cells = $(row).find("td");
          if (cells.length >= 6) {
            const name = $(cells[0]).text().trim();
            if (name) {
              players.push({
                name,
                number: $(cells[1]).text().trim(),
                team,
                gp: Number.parseInt($(cells[2]).text().trim(), 10) || 0,
                goals: Number.parseInt($(cells[3]).text().trim(), 10) || 0,
                assists: Number.parseInt($(cells[4]).text().trim(), 10) || 0,
                points: Number.parseInt($(cells[5]).text().trim(), 10) || 0,
              });
            }
          }
        });
      }

      // Goalie stats table: Name, #, W, L, GA, SV, SV%
      if (
        headers.includes("W") &&
        headers.includes("L") &&
        headers.includes("GA") &&
        headers.includes("SV")
      ) {
        const team = extractTeamFromImage($, $table);

        $table.find("tbody tr").each((_, row) => {
          const cells = $(row).find("td");
          if (cells.length >= 7) {
            const name = $(cells[0]).text().trim();
            if (name) {
              goalies.push({
                name,
                number: $(cells[1]).text().trim(),
                team,
                wins: Number.parseInt($(cells[2]).text().trim(), 10) || 0,
                losses: Number.parseInt($(cells[3]).text().trim(), 10) || 0,
                goalsAgainst: Number.parseInt($(cells[4]).text().trim(), 10) || 0,
                saves: Number.parseInt($(cells[5]).text().trim(), 10) || 0,
                savePercentage: Number.parseFloat($(cells[6]).text().trim()) || 0,
              });
            }
          }
        });
      }
    });

    return { players, goalies };
  });

const makeFetchRoster = (client: HttpClient.HttpClient) => (season: Season) =>
  Effect.gen(function* () {
    const url = `${BASE_URL}${season}/rosters`;

    const response = yield* client.execute(HttpClientRequest.get(url));
    const html = yield* response.text;

    const $ = cheerio.load(html);
    const roster: UlaxRosterPlayer[] = [];

    // Find roster tables - need to iterate since there are multiple tables per team
    $("table").each((_, tableEl) => {
      const $table = $(tableEl);
      const headers = $table
        .find("th")
        .map((_, th) => $(th).text().trim())
        .get();

      if (headers.includes("Position") && headers.includes("Height")) {
        const team = extractTeamFromImage($, $table);

        $table.find("tbody tr").each((_, row) => {
          const cells = $(row).find("td");
          if (cells.length >= 7) {
            const nameCell = $(cells[0]).text().trim();
            const isCaptain = nameCell.includes("(C)") || $(cells[0]).find(".captain").length > 0;
            const isAssistantCaptain =
              nameCell.includes("(A)") || $(cells[0]).find(".assistant").length > 0;
            const name = nameCell.replace(/\s*\([CA]\)\s*/g, "").trim();

            if (name) {
              roster.push({
                name,
                number: $(cells[1]).text().trim(),
                position: $(cells[2]).text().trim(),
                height: $(cells[3]).text().trim(),
                weight: $(cells[4]).text().trim(),
                age: $(cells[5]).text().trim(),
                homeTown: $(cells[6]).text().trim(),
                team,
                isCaptain,
                isAssistantCaptain,
              });
            }
          }
        });
      }
    });

    return roster;
  });

const makeFetchArchives = (client: HttpClient.HttpClient) => () =>
  Effect.gen(function* () {
    const url = `${BASE_URL}winter/archives`;

    const response = yield* client.execute(HttpClientRequest.get(url));
    const html = yield* response.text;

    const $ = cheerio.load(html);
    const championships: UlaxChampionship[] = [];

    // Archives page lists champions by season type (Winter, Spring, Summer)
    // Each section has year: champion pairs
    const seasons: Season[] = ["winter", "spring", "summer"];

    for (const season of seasons) {
      // Look for season headers and their champion lists
      $("h3, h4, strong").each((_, header) => {
        const text = $(header).text().toLowerCase();
        if (text.includes(season)) {
          // Find the list of champions following this header
          $(header)
            .nextAll()
            .each((_, el) => {
              const line = $(el).text().trim();
              // Match patterns like "2025: Barbary Coast" or "2025 - Barbary Coast"
              const match = line.match(/(\d{4})[:\s-]+(.+)/);
              if (match) {
                championships.push({
                  year: Number.parseInt(match[1], 10),
                  season,
                  division: "Men's Field",
                  champion: match[2].trim(),
                });
              }
            });
        }
      });
    }

    // Fallback: parse any year: team patterns on the page
    if (championships.length === 0) {
      const pageText = $("body").text();
      for (const season of seasons) {
        const sectionMatch = pageText.match(
          new RegExp(`${season}[:\\s]*([\\s\\S]*?)(?=winter|spring|summer|$)`, "i"),
        );
        if (sectionMatch) {
          const yearMatches = sectionMatch[1].matchAll(/(\d{4})[:\s-]+([^,\n]+)/g);
          for (const match of yearMatches) {
            championships.push({
              year: Number.parseInt(match[1], 10),
              season,
              division: "Men's Field",
              champion: match[2].trim(),
            });
          }
        }
      }
    }

    return championships;
  });

const makeFetchSeason =
  (
    fetchSchedule: (s: Season) => Effect.Effect<UlaxGame[], Error>,
    fetchStandings: (s: Season) => Effect.Effect<UlaxStanding[], Error>,
    fetchStats: (
      s: Season,
    ) => Effect.Effect<{ players: UlaxPlayerStats[]; goalies: UlaxGoalieStats[] }, Error>,
    fetchRoster: (s: Season) => Effect.Effect<UlaxRosterPlayer[], Error>,
  ) =>
  (season: Season) =>
    Effect.gen(function* () {
      const [schedule, standings, stats, roster] = yield* Effect.all([
        fetchSchedule(season),
        fetchStandings(season),
        fetchStats(season),
        fetchRoster(season),
      ]);

      return {
        schedule,
        standings,
        playerStats: stats.players,
        goalieStats: stats.goalies,
        roster,
      } satisfies UlaxSeasonData;
    });

export const UlaxServiceLive = Layer.effect(
  UlaxService,
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const fetchSchedule = makeFetchSchedule(client);
    const fetchStandings = makeFetchStandings(client);
    const fetchStats = makeFetchStats(client);
    const fetchRoster = makeFetchRoster(client);
    const fetchArchives = makeFetchArchives(client);
    const fetchSeason = makeFetchSeason(fetchSchedule, fetchStandings, fetchStats, fetchRoster);

    const fetchAll = (season: Season) =>
      Effect.gen(function* () {
        const [schedule, standings] = yield* Effect.all([
          fetchSchedule(season),
          fetchStandings(season),
        ]);

        return {
          schedule,
          standings,
          fetchedAt: new Date().toISOString(),
          season,
        } satisfies UlaxData;
      });

    return {
      fetchSchedule,
      fetchStandings,
      fetchStats,
      fetchRoster,
      fetchArchives,
      fetchSeason,
      fetchAll,
    };
  }),
);

// ============================================================================
// Accessor Functions (convenience wrappers)
// ============================================================================

export const fetchSchedule = (season: Season) =>
  Effect.gen(function* () {
    const service = yield* UlaxService;
    return yield* service.fetchSchedule(season);
  });

export const fetchStandings = (season: Season) =>
  Effect.gen(function* () {
    const service = yield* UlaxService;
    return yield* service.fetchStandings(season);
  });

export const fetchAll = (season: Season) =>
  Effect.gen(function* () {
    const service = yield* UlaxService;
    return yield* service.fetchAll(season);
  });

export const fetchStats = (season: Season) =>
  Effect.gen(function* () {
    const service = yield* UlaxService;
    return yield* service.fetchStats(season);
  });

export const fetchRoster = (season: Season) =>
  Effect.gen(function* () {
    const service = yield* UlaxService;
    return yield* service.fetchRoster(season);
  });

export const fetchArchives = () =>
  Effect.gen(function* () {
    const service = yield* UlaxService;
    return yield* service.fetchArchives();
  });

export const fetchSeason = (season: Season) =>
  Effect.gen(function* () {
    const service = yield* UlaxService;
    return yield* service.fetchSeason(season);
  });
