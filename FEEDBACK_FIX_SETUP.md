# Sprout feedback persistence fix

The production bug was caused by writing feedback to `/tmp/app_store.json` on
Vercel. Each serverless instance has its own temporary filesystem, so the
feedback POST and admin GET often read different files.

This change stores production feedback in Upstash Redis and retains the current
file-backed store for local development and automated tests.

## Vercel setup

1. Open the Sprout project in Vercel.
2. Open **Storage** or **Marketplace**, install **Upstash Redis**, and connect it
   to this project. The free tier is sufficient for the current parent demo.
3. Confirm that Vercel added these environment variables to Production:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Push the changed files to GitHub and redeploy the production deployment.
5. Submit one labelled test response from a generated plan.
6. Open `/admin` and confirm that the entry appears after a refresh.

If the Redis variables are missing in production, the feedback endpoint returns
an error instead of falsely claiming that an ephemeral write was saved.

## Verification completed

- TypeScript check passed
- ESLint passed
- Production build passed
- 45 automated tests passed ten consecutive times
- New tests cover durable save/read ordering, resolved status, and missing
  production configuration

## Important follow-up

The admin page and admin APIs are currently publicly accessible. Protect them
with authentication before sharing Sprout beyond a small private beta.
