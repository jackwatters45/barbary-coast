# Barbary Coast Lacrosse

Website for Barbary Coast Lacrosse, San Francisco's premier men's lacrosse club.

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Type check
bun run typecheck

# Lint & format
bun run fix
```

## Editing the Site

### For Non-Technical Team Members

You can edit this site using [Claude Code](https://claude.ai/claude-code) without needing to know how to code.

**Setup:**
1. Install Claude Code from the link above
2. Open this project folder in Claude Code
3. Ask Claude to make changes in plain English

**Common tasks:**

- **Update schedule:** "Add a game on March 22nd at 2pm against Marin Lacrosse at Kezar Stadium"
- **Edit text:** "Change the tagline on the homepage to 'Bay Area's Best Lacrosse Club'"
- **Update contact info:** "Change the email address to newcontact@barbarycoastlax.com"

After making changes, ask Claude to "commit and push" to update the live site.

### Schedule Data

Games are currently stored in `src/pages/schedule.astro` and `src/pages/index.astro`.

TODO: Add ULAX integration for automatic schedule updates.

## Tech Stack

- [Astro](https://astro.build) - Static site framework
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Biome](https://biomejs.dev) - Linting & formatting
