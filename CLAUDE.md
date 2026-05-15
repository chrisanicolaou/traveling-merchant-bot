# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Discord bot for trading Riftbound TCG cards in a private Discord guild. TypeScript, run with `tsx` (no build step). Package manager is `pnpm`.

## Common commands

- `pnpm dev:local` — start Postgres + Redis via `docker-compose.local.yaml`, load `.env.local`, run `src/index.ts` with `tsx`.
- `pnpm db:update` — ensure local Postgres is up, then `drizzle-kit push` using `drizzle-local.config.ts` (reads `.env.local`). Use this after editing `src/db/schema.ts` to sync the local DB.
- `docker compose up` — production-shaped stack (bot + db + redis) reading root `.env`.
- No test runner or lint script wired up. `pnpm test` is the npm-init placeholder. `prettier` is installed but not script-bound.

Type-check on demand: `pnpm exec tsc --noEmit` (tsconfig has `noEmit: true`, `strict`, `noUncheckedIndexedAccess`).

Env files: `.env.local` for `dev:local`, `.env.production` when `NODE_ENV=production`, `.env` for the docker-compose stacks. `ConfigService.initializeConfig()` selects the file by `NODE_ENV`.

## Architecture

Entry point `src/index.ts` builds a `Services` bag and hands it to `Bot`. Wiring is manual constructor injection — there is no DI container. All services are constructed once at startup.

```
index.ts
 └─ initializeServices(): Services
     ├─ ConfigService           env access via CONFIG_KEY enum, throws on missing
     ├─ CacheService            Redis client with retry-on-connect
     ├─ DbConnection            pg.Pool + drizzle, retries select 1 until ready
     ├─ PrintingTraitsService   bitflag helpers over PrintingTraits enum
     ├─ CardsService            cache + provider + db, owns card sync + lookups
     ├─ TradesService           db-only, buys/sells
     └─ EventsService           events provider + config (geo bounds)
 └─ new Bot(services).run()
```

`Services` (`src/shared/types/services.ts`) is the shape every command receives via `BaseCommand`.

### Provider pattern
External integrations sit behind interfaces in `src/api/`:
- `CardDataProvider` (`src/api/card-data/cardDataProvider.ts`) — implementations under `card-data/<name>/`. Currently `riftcodex`.
- `EventsProvider` (`src/api/events/eventsProvider.ts`) — currently `riftfound`.

`index.ts` picks the implementation via `CONFIG_KEY.CARD_DATA_PROVIDER` / `CONFIG_KEY.EVENTS_PROVIDER` in a switch. Add a provider = new folder under `src/api/<kind>/<name>/`, implement the interface, add a case to the loader in `index.ts`.

### Discord command pipeline
`Bot.run()` (`src/bot/bot.ts`) registers a single `InteractionCreate` listener and dispatches by name to `client.commands` (augmented onto discord.js via `discordClientAugments.ts`). Handles both `ChatInputCommand` and `Autocomplete` interactions; commands opt into autocomplete by implementing the optional `autocomplete` method.

`CommandLoader` (`src/bot/commandLoader.ts`) currently has commands **hardcoded in an array**, then PUTs them to Discord as guild commands (`Routes.applicationGuildCommands(appId, guildId)`) on every startup. The commented-out filesystem loader at the bottom is the eventual goal but not active — when adding a command, instantiate it in that array.

Commands extend `BaseCommand` (`src/bot/commands/command.ts`), which holds `services` and forces `data: SharedSlashCommand` + `execute`. Command name/option-name string constants live in `src/bot/constants.ts` (`CommandName`, `CommandOptionName`) — use these everywhere instead of string literals so autocomplete dispatch in commands stays in sync with builder option names.

### Database (drizzle-orm)
Schema in `src/db/schema.ts`, `casing: "snake_case"` configured both in drizzle config and the runtime drizzle instance — keep TS camelCase column names; drizzle does the mapping. `defineRelations` is used (drizzle 1.0 beta style); pre-built `BuildQueryResult` types (e.g. `TradeWithDetails`, `CardPrintingWithCardDataAndSet`) are exported for nested-query callers.

`PrintingTraits` and `TradeDirection` (`src/shared/enums.ts`) are stored as `smallint` via `customType` wrappers. `PrintingTraits` is a **bitflag** enum — combine with `|`, test with `&`. `CardsService.getPrintingOptionsFromCardName` builds the bitmask from card-name parenthetical suffixes (e.g. `"Foo (Signature)"`).

Two drizzle configs: `drizzle.config.ts` (hardcoded local creds, used by the docker stack path) and `drizzle-local.config.ts` (loads `.env.local`, used by `pnpm db:update`).

### Caching
`CardsService` caches two derived lists in Redis: `full_card_names` (raw, with printing suffixes) and `card_names` (deduped base names). `getCardNames` will derive from the full-names cache if available before hitting the provider. No TTL set on either key.

## Things to know

- `tsconfig` has `allowImportingTsExtensions: true` and the codebase uses explicit `.ts` extensions in imports — preserve that style.
- `noUncheckedIndexedAccess` is on; array/index access returns `T | undefined`.
- Discord commands are registered **as guild commands** to a single guild from `CONFIG_KEY.DISCORD_GUILD_ID`. This bot is not designed for multi-guild deployment.
- README explicitly states use outside the owner's private Discord is not permitted; the public repo exists for the Riot API key application.
- Status snapshot at the time of writing: `buyCommand.ts` still hardcodes `printingId: "TODO"` when creating a trade — buy flow is not wired to actual printing lookup yet.
