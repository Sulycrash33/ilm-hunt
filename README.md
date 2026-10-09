# ILM Hunt

ILM Hunt is an Islamic learning game with category quizzes, solo challenges, multiplayer rooms, and rewards. English is the default language; additional languages are available through the app's language settings.

[Play ILM Hunt](https://www.ilmhunt.app)

The app uses Next.js, Supabase, and Vercel. The GitHub repository is `Sulycrash33/ilm-hunt`.

## Local development

Install dependencies with `npm ci`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in an untracked `.env.local` file for the Supabase project you intend to use. Never commit credentials or put a service-role key in a public environment variable.

Run `npm run dev`, then open [localhost:9002](http://localhost:9002). Run `npm run typecheck` and `npm run build` to check the application. Focused checks are listed in the `scripts` section of `package.json`.

## Project documentation

- [Project handoff and historical context](docs/HANDOFF.md)
- [Question-bank runbook](docs/RUNBOOK.md)
- [Solo reward database verification](scripts/README-solo-rewards.md)

The handoff and runbook include historical notes. Verify the current repository and database state before applying an older instruction or migration. AI-generated questions enter a review queue before publication. The arena answer bank is imported from private Supabase Storage; keep answer-bearing bank files outside the public repository.
