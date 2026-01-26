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

- **Add a game:** "Add a game on March 22nd at 2pm against Marin Lacrosse at Kezar Stadium"
- **Add a scrimmage:** "Add a scrimmage against Stanford MCLA on April 5th at noon"
- **Add a tournament:** "Add a tournament called 'Vegas Shootout' on June 15th in Las Vegas"
- **Update practice info:** "Change practice time to 6:30 PM on Tuesdays"
- **Edit text:** "Change the tagline on the homepage"
- **Update contact info:** "Change the email address to newcontact@barbarycoastlax.com"

After making changes, ask Claude to "commit and push" to update the site.

### Schedule Data

Events are stored in `src/pages/schedule.astro` (full schedule) and `src/pages/index.astro` (homepage preview).

Event types: `game`, `practice`, `scrimmage`, `tournament`

## TODO

### Deployment
- [ ] Deploy to Netlify (config in `netlify.toml`)
- [ ] Set up custom domain
- [ ] Create team Netlify account
  - Create "Barbary Coast" GitHub org and transfer repo
  - Create Netlify team linked to org
  - This gives Harrison (and others) their own credentials

### ULAX Integration
- [ ] Fetch current season schedule programmatically
- [ ] Add historical season data page

### Harrison Onboarding
- [ ] Give repo access
- [ ] Give Netlify access
- [ ] Walk through Claude Code workflow

### Future Features
- [ ] Team store
- [ ] Photo gallery
- [ ] Player profiles

### Content/Styling
- Defer to Harrison

## Tech Stack

- [Astro](https://astro.build) - Static site framework
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Biome](https://biomejs.dev) - Linting & formatting
