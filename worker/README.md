# Classroom server (Cloudflare Worker + D1)

Classroom mode for the eCTD Dossier Builder. The app itself stays a static site; only classroom
mode talks to this small API. Instructors create a class and share a join code; students join,
start assigned missions, and submit their project files; instructors see scores and validation
results, re-score each submission in their own browser, comment, and see a leaderboard.
Optional deadline reminders go out by email through Brevo.

Tables are prefixed `ectd_` and every route sits under `/ectd/v1`, so the Worker and its D1
database can be shared with other apps.

## Deploy with one click (GitHub Actions)

1. Create a Cloudflare API token (My Profile > API Tokens > Create Token) with **Workers Scripts: Edit** and **D1: Edit** permissions, and note your **Account ID** (Workers & Pages overview).
2. In the GitHub repository, open **Settings > Secrets and variables > Actions** and add the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (and `BREVO_API_KEY` if you want email reminders).
3. Open **Actions > Deploy classroom server > Run workflow**.

The workflow creates the D1 database if it does not exist, creates the tables, deploys the Worker, then rebuilds the site with the classroom server built in and publishes it to GitHub Pages. The run summary shows the API address.

## Deploy by hand

You need a Cloudflare account (the free plan is enough) and Node.js 18 or newer.

```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create ectd-classroom        # copy the database_id it prints into wrangler.toml
npm run db:remote                             # creates the tables
npx wrangler deploy                           # prints https://ectd-classroom.<you>.workers.dev
```

The API address to give the app is the Worker URL plus `/ectd/v1`, for example
`https://ectd-classroom.<you>.workers.dev/ectd/v1`. Either enter it on the app's Classroom page,
or build the app with it baked in:

```bash
VITE_CLASSROOM_API=https://ectd-classroom.<you>.workers.dev/ectd/v1 npm run build
```

`ALLOWED_ORIGINS` in `wrangler.toml` lists the sites allowed to call the API (localhost is always
allowed for development). Add your own Pages address if you host the app elsewhere.

## Email reminders (optional)

Reminders go to students who gave an email address and have not submitted, once per assignment,
when the due date is within `REMINDER_HOURS` (48 by default). The cron trigger runs hourly.

```bash
npx wrangler secret put BREVO_API_KEY
```

Then set `BREVO_SENDER_EMAIL` (a sender verified in Brevo) and, if you like, `BREVO_SENDER_NAME`
in `wrangler.toml`, and deploy again. Without a key, reminders are simply off.

## Security model

- A class key (instructor) and a student key are random 256-bit bearer tokens; the database
  stores only their SHA-256 hashes. The instructor's key is shown once, so download it.
- Students see only their own submissions and comments; the leaderboard shows names and totals.
- Reported scores come from the student's browser. The instructor's "Re-score in this browser"
  runs the app's own scoring on the submitted project file and stores a verified score, which
  the leaderboard prefers.
- Project files are limited to 1.5 MB. Everything in them is fictional training content.

## Develop and test locally

```bash
npm run db:local
npx wrangler dev --local          # http://localhost:8787/ectd/v1
npm test                          # in another terminal
```
