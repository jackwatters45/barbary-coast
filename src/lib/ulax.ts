import { HttpClient, HttpClientRequest } from "@effect/platform";
import * as cheerio from "cheerio";
import { Effect, Schema } from "effect";

// ============================================================================
// Types
// ============================================================================

export const UlaxGameRaw = Schema.Struct({
	id: Schema.Number,
	gamedate: Schema.String,
	gametime: Schema.String,
	field: Schema.String,
	awayteam: Schema.String,
	awayscore: Schema.Union(Schema.Number, Schema.Null),
	hometeam: Schema.String,
	homescore: Schema.Union(Schema.Number, Schema.Null),
	gametype: Schema.Number,
	typename: Schema.String,
});

export type UlaxGameRaw = typeof UlaxGameRaw.Type;

export interface UlaxGame {
	id: number;
	date: Date;
	time: string;
	field: string;
	awayTeam: string;
	awayScore: number | null;
	homeTeam: string;
	homeScore: number | null;
	gameType: "regular" | "playoff" | "championship";
	isBarbaryCoast: boolean;
	barbaryCoastIsHome: boolean | null;
}

// Serialized version for JSON import (Date becomes string)
export interface UlaxGameSerialized extends Omit<UlaxGame, "date"> {
	date: string;
}

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

export type Season = "winter" | "spring" | "summer";

// ============================================================================
// Helpers
// ============================================================================

const BARBARY_COAST = "Barbary Coast";

function parseGameDate(dateStr: string): Date {
	// Format: "January 11, 2026"
	return new Date(dateStr);
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
		raw.hometeam.includes(BARBARY_COAST) ||
		raw.awayteam.includes(BARBARY_COAST);
	const barbaryCoastIsHome = isBarbaryCoast
		? raw.hometeam.includes(BARBARY_COAST)
		: null;

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
		isBarbaryCoast,
		barbaryCoastIsHome,
	};
}

// ============================================================================
// API Functions
// ============================================================================

const SCHEDULE_API =
	"https://ulax.org/assets/getData/getDataSeasons.php?type=schedule&league=sanfran&season=";
const STANDINGS_URL = "https://ulax.org/sanfrancisco/men/";

export const fetchSchedule = (season: Season) =>
	Effect.gen(function* () {
		const client = yield* HttpClient.HttpClient;
		const url = `${SCHEDULE_API}${season}`;

		const response = yield* client.execute(HttpClientRequest.get(url));
		const json = yield* response.json;

		if (!Array.isArray(json)) {
			return yield* Effect.fail(new Error("Expected array response"));
		}

		const games: UlaxGame[] = [];
		for (const item of json) {
			const parsed = Schema.decodeUnknownEither(UlaxGameRaw)(item);
			if (parsed._tag === "Right") {
				games.push(transformGame(parsed.right));
			}
		}

		return games;
	});

export const fetchStandings = (season: Season) =>
	Effect.gen(function* () {
		const client = yield* HttpClient.HttpClient;
		const url = `${STANDINGS_URL}${season}/standings`;

		const response = yield* client.execute(HttpClientRequest.get(url));
		const html = yield* response.text;

		const $ = cheerio.load(html);
		const standings: UlaxStanding[] = [];

		// Find the standings table - look for table with GP, W, L columns
		$("table").each((_, table) => {
			const headers = $(table)
				.find("th")
				.map((_, th) => $(th).text().trim())
				.get();

			// Check if this is the standings table
			if (headers.includes("GP") && headers.includes("W") && headers.includes("L")) {
				$(table)
					.find("tbody tr")
					.each((_, row) => {
						const cells = $(row).find("td");
						if (cells.length >= 8) {
							const team = $(cells[0]).text().trim();
							if (team) {
								standings.push({
									team,
									gp: Number.parseInt($(cells[1]).text().trim()) || 0,
									w: Number.parseInt($(cells[2]).text().trim()) || 0,
									l: Number.parseInt($(cells[3]).text().trim()) || 0,
									t: Number.parseInt($(cells[4]).text().trim()) || 0,
									pts: Number.parseInt($(cells[5]).text().trim()) || 0,
									gf: Number.parseInt($(cells[6]).text().trim()) || 0,
									ga: Number.parseInt($(cells[7]).text().trim()) || 0,
								});
							}
						}
					});
			}
		});

		return standings;
	});

export const fetchAll = (season: Season) =>
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
