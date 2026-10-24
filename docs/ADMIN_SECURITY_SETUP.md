# Sprout administrator setup

Issue #1 introduces a separate admin session. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET as different random strings of at least 32 characters in the deployment environment. Do not commit their values or reuse the anonymous SESSION_SECRET. Without these settings, admin access fails closed with HTTP 503.

The Next.js 16 proxy restricts admin APIs, requires same-origin JSON for admin writes, and denies public feedback listing. The console uses an HttpOnly signed cookie lasting eight hours. This does not create public user accounts.

Before inviting beta testers, run npm ci, npm test, npm run lint and npm run build. Verify in an incognito browser that admin endpoints reject anonymous visitors and that the public feedback GET returns 405. Test valid admin login, non-admin access, cross-origin mutation rejection and the cookie flags. Check the deployed proxy rather than assuming it is active.

Apply distributed rate limiting to admin login at the hosting layer. This first patch does not implement MFA or a distributed brute-force throttle. Do not call it production-ready without the manual checks.
