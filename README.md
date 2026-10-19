# NAL Fan Choice Friday

Standalone public poll and protected admin page, backed by the existing NAL Fan Polls Supabase project.

## Status
Database tables exist. Frontend and backend code are prepared but are **not deployed**. Guest voting is not live until the Edge Function and website are deployed and tested.

## Setup
1. Deploy `edge-function.ts` as Supabase Edge Function `fcf-api` in project `rcoaprzmutcwlpugobry` with `verify_jwt=false` (the function verifies administrator JWTs on admin routes). Configure the standard Supabase URL and service role secret **server-side only**.
2. Get the project's publishable key from Supabase and add `window.FCF_PUBLISHABLE_KEY='...'` to `config.js`. Publishable keys may be public; **never put service-role keys in the website**.
3. Ensure an authorized admin has an active `profiles` row with `role='admin'`. The admin login uses Supabase email/password authentication.
4. Deploy `index.html`, `admin.html`, `app.js`, `admin.js`, `style.css`, `config.js` to Cloudflare Pages. Route `/admin.html` to the private admin screen.
5. Configure custom hostname and social OG image; test desktop/mobile Facebook link previews.
6. Create a test poll through admin, vote from public page, verify duplicate voting is rejected, verify close time enforcement, and test results.

## Security and production considerations
Guest vote deduplication uses a persistent browser UUID hashed on the server and a unique database constraint. It is **not** identity verification: private browsers, clearing storage, and multiple devices can produce extra votes. Before high-traffic promotion, add Cloudflare Turnstile and server-side token verification, per-IP rate limits, and monitoring. Do not display a public vote tally until you choose the results-release policy. Admin is restricted to existing active NAL profiles with role admin; audit this before adding staff.

Existing NAL tables are not modified. Polls can be edited while they have no votes; once votes exist, game choices are locked to preserve integrity. Creating the next week's poll requires a new poll rather than editing the previous one; admin UI currently edits the latest poll, so add an explicit New Poll workflow before weekly operational use. No automatic winner announcement yet.
