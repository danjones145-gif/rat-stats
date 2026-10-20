# Rats Stats (Supabase + Netlify)

Files: index.html (the app), store.js (database layer), supabase-config.js (your keys),
supabase-setup.sql (one-time database setup), seed.json (starting data).

## One-time setup
1. supabase.com > New project. Wait for it to finish starting.
2. SQL Editor > New query > paste supabase-setup.sql > Run.
3. Project Settings > API. Copy the Project URL and the anon public key into supabase-config.js.
4. app.netlify.com/drop > drag this whole folder onto the page.
5. Open the Netlify address and tap "Load the Rats starting data" once. Share the address.

## Later changes
Edit index.html, then drag the folder onto your site's Deploys page in Netlify.
