# API Fix Task

## Problem
- `/api/auth-user?action=login` returns FUNCTION_INVOCATION_FAILED
- ALL `/api/*` routes fail — even `/api/health`
- Root cause: `api/[[...route]].ts` catch-all imports `hono/vercel` which has build/runtime errors
- This catch-all intercepts ALL api routes before `auth-user.js` etc. can run

## Fix Plan
1. Remove `api/[[...route]].ts` — it breaks everything
2. Ensure `auth-user.js` and other API functions work standalone
3. Check if DB tables exist in Turso — seed users if needed
4. Deploy and test

## Users to Seed
- deemah: superadmin, password: noT1333Deemahseeq
- robbmobb: admin, password: yesm81337carlitto

## Deploy Process
- Edit source → copy to both paths → deploy with deploy.sh
