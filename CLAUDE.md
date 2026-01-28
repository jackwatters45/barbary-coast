# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install              # Install dependencies
bun run dev              # Start dev server (http://localhost:4321)
bun run build            # Production build to dist/
bun run typecheck        # TypeScript checking (astro check)
bun run lint             # Run Biome linter
bun run fix              # Auto-fix lint/format issues
bun run sync             # Fetch ULAX schedule data (see below)
bun run sync winter      # Sync specific season (winter|spring|summer)
```

Pre-push hooks run typecheck and lint automatically.

## Architecture

**Astro 5 static site** for Barbary Coast Lacrosse club. Deployed to Netlify.

### Key Patterns

**ULAX Data Integration** (`src/lib/ulax.ts`, `src/scripts/sync-ulax.ts`):
- Uses Effect.ts for composable async operations with schema validation
- Two-phase approach: CLI script fetches → JSON cached → components read at build time
- Schedule: JSON API at `ulax.org/assets/getData/getDataSeasons.php`
- Standings: HTML scraping with Cheerio from `ulax.org/sanfrancisco/men/`
- Cached data: `src/data/ulax.json` (committed, refreshed via `bun run sync`)

**Component Data Flow**:
- Pages import cached JSON: `import ulaxData from "../data/ulax.json"`
- Pass to components: `<Schedule ulaxGames={ulaxData.schedule} />`
- `UlaxGameSerialized` type for JSON (dates as strings vs Date objects in `UlaxGame`)

**Event Types**:
- ULAX games: `gameType: "regular" | "playoff" | "championship"`
- Manual events: `type: "game" | "practice" | "scrimmage" | "tournament"`

### Styling

Tailwind CSS v4 with custom theme in `src/styles/global.css`:
- Fonts: Geist (sans) and Geist Mono
- Colors: `powder` (#5a9bc4), `gold` (#c4962e), `muted`, `subtle`, `border`
- `.label` class: monospace uppercase for tags like `[league]`, `[practice]`

## Non-Technical User Edits

The README documents how team members use Claude Code for common tasks like adding games or updating practice times. Events are in `src/pages/schedule.astro` and `src/pages/index.astro`.

## Effect.ts Usage

This codebase uses Effect for ULAX API integration:

```typescript
// Generator syntax for async operations
Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client.execute(HttpClientRequest.get(url));
  return yield* response.json;
});

// Schema validation
Schema.decodeUnknownEither(UlaxGameRaw)(item);

// Layer-based dependency injection for runtime
const MainLayer = Layer.mergeAll(BunContext.layer, FetchHttpClient.layer);
BunRuntime.runMain(program.pipe(Effect.provide(MainLayer)));
```

**Prefer Effect Schemas over interfaces** for data types:
```typescript
// ✅ Preferred - Effect Schema with derived type
export const UlaxStanding = Schema.Struct({
  team: Schema.String,
  wins: Schema.Number,
});
export type UlaxStanding = typeof UlaxStanding.Type;

// ❌ Avoid - plain interface
export interface UlaxStanding {
  team: string;
  wins: number;
}
```
