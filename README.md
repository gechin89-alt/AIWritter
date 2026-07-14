# XHS Writer

Generates Xiaohongshu (小红书) and Instagram post content from a guided questionnaire, for two flows:

- **Individual** — a logged-in user uploads a photo/video, answers a few questions (identity, tone, style), and gets a ready-to-copy post.
- **Commercial** — a brand-run campaign page (e.g. `/commercial/demo`) where the brand's customers generate a post and submit their published link to enter a lucky draw.

## Local setup

1. Copy `.env.example` to `.env` and fill in `ANTHROPIC_API_KEY` (get one at https://console.anthropic.com/). `DATABASE_URL` and `AUTH_SECRET` are already set for local dev.
2. Install dependencies and set up the database:
   ```bash
   npm install
   npx prisma migrate dev
   npm run db:seed
   ```
   The seed creates a demo campaign at `/en/commercial/demo` and an admin login (phone `0000000000`, password `changeme123` by default — override via `SEED_ADMIN_PHONE` / `SEED_ADMIN_PASSWORD` env vars before seeding).
3. Run the dev server:
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000.

## Project structure

- `app/[locale]/...` — all pages, localized under `/en` or `/zh` (next-intl).
- `app/api/...` — API routes (auth, generate, upload, submissions, admin).
- `lib/prisma.ts`, `lib/auth.ts`, `lib/anthropic.ts` — DB client, session/auth helpers, Claude API wrapper.
- `prisma/schema.prisma` — data model (User, IndividualPost, Campaign, CommercialSubmission).
- `messages/en.json`, `messages/zh.json` — UI translations.

## Moving to a real web host later

- **Database**: swap `provider = "sqlite"` to `"postgresql"` (or `"mysql"`) in `prisma/schema.prisma` and point `DATABASE_URL` at your hosted DB, then run `npx prisma migrate deploy`. No application code changes needed — everything goes through Prisma.
- **Uploaded media**: `public/uploads/` works locally, but most hosts don't persist local disk writes across deploys. Before going live, swap `app/api/upload/route.ts` to write to an S3-compatible bucket instead.
- **Secrets**: set `ANTHROPIC_API_KEY` and `AUTH_SECRET` as environment variables on the host (never commit `.env`).
- **Admin account**: re-run the seed script (or create a user directly in the DB) with a real phone number and a strong password before going live — the seed defaults are for local dev only.
