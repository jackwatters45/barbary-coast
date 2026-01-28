# feat: ULAX Schedule & Historical Data Sync

## Overview

Scrape Barbary Coast schedule/scores from ULAX and sync to Astro site. Add historical data page.

## Research Findings

### ULAX API Discovery

**Schedule API (AJAX endpoint):**
```
https://ulax.org/assets/getData/getDataSeasons.php?type=schedule&league=sanfran&season={winter|spring|summer}&team=
```

Returns JSON array:
```json
{
  "id": 132,
  "gamedate": "January 11, 2026",
  "gametime": "5:00 pm",
  "field": "Beach Chalet Fields Pitch #4",
  "awayteam": "Bar Down Boys",
  "awayscore": 4,
  "hometeam": "Barbary Coast",
  "homescore": 8,
  "gametype": 0,
  "typename": "Regular Season"
}
```

**Server-rendered pages (HTML scraping required):**
- Standings: `/sanfrancisco/men/{season}/standings`
- Rosters: `/sanfrancisco/men/{season}/rosters`
- Stats: `/sanfrancisco/men/{season}/stats`
- Archives: `/sanfrancisco/men/{season}/archives`

### URL Structure

```
/sanfrancisco/men/{season}/           # league home
/sanfrancisco/men/{season}/schedule   # AJAX-loaded
/sanfrancisco/men/{season}/standings  # HTML table
/sanfrancisco/men/{season}/rosters    # HTML tables by team
/sanfrancisco/men/{season}/stats      # HTML, player/team leaders
/sanfrancisco/men/{season}/archives   # expandable list, champions by year
```

Seasons: `winter`, `spring`, `summer`

### Barbary Coast Historical Champions (from archives)

- **Winter 2025**: Barbary Coast
- **Summer 2025**: Barbary Coast
- **Spring 2025**: Barbary Coast (A Div)
- **Winter 2024**: SFLC Black
- **Summer 2024**: San Francisco Lacrosse
- **Winter 2023**: Blue Ballers
- **Winter 2022**: SFLC
- **Winter 2020**: Palo Alto Ducks

## Proposed Solution

### Phase 1: Schedule Sync Script

Build-time data fetcher using ULAX AJAX API:

```
src/
  lib/
    ulax.ts          # API client + types
  data/
    schedule.json    # cached ULAX data (git-ignored)
  scripts/
    sync-ulax.ts     # CLI: bun run sync
```

**Data flow:**
1. `sync-ulax.ts` fetches current season schedule via AJAX endpoint
2. Writes to `src/data/schedule.json`
3. Astro pages import JSON at build time
4. Netlify build hook triggers on schedule (or manual)

### Phase 2: HTML Scraping for Standings/Stats

Use cheerio or parse raw HTML for:
- Current standings table
- Barbary Coast roster
- Team/player stats

### Phase 3: Historical Data Page

New page `/history` showing:
- Championship banners by season
- Historical standings (scraped from archives)
- All-time Barbary Coast records

## Data Types

```typescript
interface UlaxGame {
  id: number
  gamedate: string      // "January 11, 2026"
  gametime: string      // "5:00 pm"
  field: string
  awayteam: string
  awayscore: number | null
  hometeam: string
  homescore: number | null
  gametype: number      // 0=regular, 1=playoff, 2=championship
  typename: string
}

interface UlaxStanding {
  team: string
  gp: number
  w: number
  l: number
  t: number
  pts: number
  gf: number
  ga: number
}

interface SeasonArchive {
  season: 'winter' | 'spring' | 'summer'
  year: number
  champion: string
  division?: string     // A/B div for spring
}
```

## Acceptance Criteria

- [ ] `bun run sync` fetches current ULAX schedule
- [ ] Schedule page shows real ULAX games (not hardcoded)
- [ ] Scores update automatically when games complete
- [ ] Filter: show only Barbary Coast games
- [ ] `/history` page with championship list
- [ ] Standings table on schedule page
- [ ] Build succeeds on Netlify

## Implementation Tasks

1. **Create ULAX client** (`src/lib/ulax.ts`)
   - `fetchSchedule(season)` - uses AJAX endpoint
   - `fetchStandings(season)` - HTML scrape
   - `fetchArchives()` - HTML scrape
   - Types for all data structures

2. **Create sync script** (`src/scripts/sync-ulax.ts`)
   - CLI command to fetch and cache data
   - Output to `src/data/` as JSON

3. **Update schedule page**
   - Import from JSON instead of hardcoded
   - Add standings section
   - Filter to Barbary Coast games

4. **Create history page** (`src/pages/history.astro`)
   - Championship banners
   - Season-by-season results

5. **Netlify scheduled build**
   - Add build hook for daily refresh
   - Or GitHub Action on cron

## Dependencies

```bash
bun add cheerio       # HTML parsing
bun add -d @types/cheerio
```

## Open Questions

1. **Caching strategy?** Git-commit JSON vs fetch at build time?
2. **Other seasons?** Just winter or all three?
3. **Roster sync?** Include player names or just schedule/standings?
4. **Update frequency?** Daily? Weekly? Manual?

## References

- ULAX SF Men Winter: https://ulax.org/sanfrancisco/men/winter/
- Schedule API: `getDataSeasons.php?type=schedule&league=sanfran&season=winter`
- Current schedule.astro: `src/pages/schedule.astro`
- README TODOs mention ULAX integration
