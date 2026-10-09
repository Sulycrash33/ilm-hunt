# Solo reward and lifeline database checks

`check-solo-rewards-concurrency.mjs` runs against an empty disposable PostgreSQL database on `127.0.0.1`, named `solo_rewards_concurrency`. It refuses other hosts, database names, or a populated public schema. Use a fresh test cluster because it creates the `anon` and `authenticated` roles. Never run it against a deployed Supabase project.

Install `pg` in separate test tooling or set `PG_MODULE` to an existing installation. Then run:

```sh
PG_MODULE=/absolute/path/to/node_modules/pg node scripts/check-solo-rewards-concurrency.mjs postgresql://postgres@127.0.0.1:55440/solo_rewards_concurrency
```

The optional second argument selects the migration file. The default is the accompanying reliable-solo-rewards migration. The caller manages and stops the disposable PostgreSQL cluster.

The fixture uses synthetic questions and accounts, the production reward trigger definitions inspected on 4 October 2026, and a UTC timezone helper. Real `authenticated` callers exercise duplicate answers, first-wrong answers, coin and inventory purchase retries, spending versus answering in both orders, double points, paid 50:50 initialization and retries, ledger ownership, direct-write restrictions, and anonymous execution denial. Every concurrency assertion verifies an actual blocking transaction before allowing it to commit.

This test does not reproduce the entire production schema, timezone catalogue, authentication service, browser, or Realtime subscriptions. Production rollout requires a separate transaction rehearsal with rollback and post-rollout verification. Historical records are not repaired by this migration.
