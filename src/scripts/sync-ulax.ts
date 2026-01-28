#!/usr/bin/env bun
import { Console, Effect, Layer } from "effect";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { FileSystem, Path } from "@effect/platform";
import { FetchHttpClient } from "@effect/platform";
import { fetchAll, type Season, type UlaxData } from "../lib/ulax";

const writeData = (data: UlaxData) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;

		const dataDir = path.join(import.meta.dir, "..", "data");
		const filePath = path.join(dataDir, "ulax.json");

		yield* fs.makeDirectory(dataDir, { recursive: true });
		yield* fs.writeFileString(filePath, JSON.stringify(data, null, 2));

		yield* Console.log(
			`✓ Wrote ${data.schedule.length} games and ${data.standings.length} standings to ${filePath}`,
		);
	});

const printSummary = (data: UlaxData) =>
	Effect.gen(function* () {
		const barbaryGames = data.schedule.filter((g) => g.isBarbaryCoast);
		const bc = data.standings.find((s) => s.team.includes("Barbary Coast"));

		yield* Console.log(`\nSummary:`);
		yield* Console.log(`  Total games: ${data.schedule.length}`);
		yield* Console.log(`  Barbary Coast games: ${barbaryGames.length}`);
		yield* Console.log(`  Teams in standings: ${data.standings.length}`);

		if (bc) {
			yield* Console.log(
				`\nBarbary Coast: ${bc.w}-${bc.l}-${bc.t} (${bc.pts} pts)`,
			);
		}
	});

const program = Effect.gen(function* () {
	const season: Season = (process.argv[2] as Season) || "winter";

	yield* Console.log(`Syncing ULAX data for ${season} season...`);

	const data = yield* fetchAll(season);

	yield* writeData(data);
	yield* printSummary(data);
});

const MainLayer = Layer.mergeAll(BunContext.layer, FetchHttpClient.layer);

BunRuntime.runMain(program.pipe(Effect.provide(MainLayer)));
