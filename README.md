# TravelingMerchantBot

A Discord bot that runs a card-trading marketplace for [Riftbound TCG](https://riftbound.leagueoflegends.com/en-us) inside a single private Discord guild. Members post the cards they want to buy or sell with `/buy` and `/sell`; the bot pins counterpart listings together and tags whoever can fill the other side of the trade.

## What it does

- Tracks buy/sell listings per user, per card printing (set + traits like foil, signature, etc.).
- Looks up market prices (TCGplayer via [tcgcsv.com](https://tcgcsv.com/)) and converts them to GBP via [Frankfurter](https://frankfurter.dev/).
- On every new listing, replies with the matching counterpart users and `@`-mentions them so trades get noticed.
- Pulls upcoming local Riftbound events from [Riftfound](https://riftfound.com/) and mirrors them into the guild's scheduled events.
- Auto-completes card names, sets, and printing traits from cached card data (sourced from [Riftcodex](https://riftcodex.com/)).

## Slash commands

| Command           | Purpose                                                                               |
| ----------------- | ------------------------------------------------------------------------------------- |
| `/buy`            | List a card you want to buy (single, with set + trait pickers).                       |
| `/sell`           | List a card you want to sell.                                                         |
| `/buybulk`        | Open a modal to paste a multi-line buy list (`<qty> <card name>` per line).           |
| `/sellbulk`       | Same as `/buybulk` for selling.                                                       |
| `/remove`         | Remove one of your open listings (full or partial quantity).                          |
| `/help`           | Print the available commands.                                                         |
| `/sync-card-data` | Admin only. Re-sync card/set/printing data from the card-data provider.               |
| `/sync-events`    | Admin only. Pull events from the events provider and create Discord scheduled events. |

Admin commands gate on `DISCORD_GUILD_ADMIN_ROLE_ID`.

## Stack

- **TypeScript** run directly with [`tsx`](https://github.com/privatenumber/tsx) — no build step.
- [discord.js](https://discord.js.org/) v14 for the gateway + slash commands.
- **PostgreSQL** with [drizzle-orm](https://orm.drizzle.team/) (1.0 beta). Migrations live in `src/db/migrations/` and are applied automatically at production startup.
- **Redis** for short-lived caches (card-name lists, sync locks, exchange rates, market prices).
- Package manager: `pnpm` (10.x).

## Running locally

Prereqs: Node 22+, `pnpm`, Docker (for Postgres + Redis).

```bash
pnpm install
cp .env.example .env.local         # then fill in values
pnpm db:migrate:local              # starts local Postgres + applies migrations
pnpm dev:local                     # starts Redis, loads .env.local, runs the bot
```

Type-check:

```bash
pnpm exec tsc --noEmit
```

Generate a new migration after editing `src/db/schema.ts`:

```bash
pnpm db:generate
```

## Production-shaped stack

```bash
pnpm dev:prod    # docker compose up --build — bot + db + redis from root .env
```

The container entrypoint runs `src/db/migrate.ts` against the configured database before starting the bot.

## Configuration

All config keys are defined in `src/services/configService.ts` (`CONFIG_KEY`). The notable ones:

| Key                                                                          | Purpose                                         |
| ---------------------------------------------------------------------------- | ----------------------------------------------- |
| `DISCORD_APP_ID`, `DISCORD_APP_TOKEN`, `DISCORD_PUBLIC_KEY`                  | Discord application credentials.                |
| `DISCORD_GUILD_ID`                                                           | The single guild the bot registers commands to. |
| `DISCORD_GUILD_ADMIN_ROLE_ID`                                                | Role gate for admin-only commands.              |
| `POSTGRES_*`, `REDIS_HOST`, `REDIS_PORT`                                     | Datastore connections.                          |
| `CARD_DATA_PROVIDER`                                                         | Currently only `riftcodex`.                     |
| `EVENTS_PROVIDER`, `EVENTS_LATITUDE`, `EVENTS_LONGITUDE`, `EVENTS_RADIUS_KM` | Events source + geo filter.                     |
| `MARKET_PRICE_PROVIDER`, `TCGCSV_CATEGORY_ID`                                | Pricing source.                                 |
| `RIOT_API_KEY`                                                               | Reserved for Riot API integration.              |

`NODE_ENV` selects the env file: `local` → `.env.local`, `production` → container-injected.
