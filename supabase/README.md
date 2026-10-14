# Private résumés and sibling accounts

The GitHub Pages frontend contains public family cards only. Supabase project
`qacuixzgkcejlnsnjlhe` supplies Auth, `marmullaku_profiles`, `marmullaku_links`,
`marmullaku_archive_chunks`, and the `marmullaku-access` Edge Function. It shares the existing project without
changing other applications' tables. See the shared infrastructure registry in
`../../Lexy/docs/SHARED_INFRASTRUCTURE.md` before changes to shared Auth.

Only a confirmed email explicitly assigned to a sibling's `invite_email` can
claim that profile. All other shared Auth users receive 403. Provision invitations
through trusted SQL; clients cannot assign email or ownership. One user owns one
profile. The homepage Sign in dialog uses email and password. First-time setup
and password reset verify an invited email code before the user chooses a password.
Neither passwords nor codes are retained in browser storage. The shared session
is tab-local; the password is shared with any other apps using the same Auth account.
No invitations are sent by deployment. The `app: marmullaku` signup routing marker
prevents creating an unrelated Cards profile; it grants no Marmullaku access.

Company links use 32 random bytes in a URL fragment. Only their SHA-256 hashes
are stored. The token authorizes one sibling's current CV; both welcome and CV
requests enforce expiry/revocation. URLs are shown once at creation, can be
revoked, and can be forwarded by a recipient. Downloaded CVs cannot be recalled.
Private responses use `Cache-Control: no-store`; the service key never enters
frontend code. Edit text is escaped before HTML rendering; contact URL schemes
are restricted to HTTP(S), mailto, and tel.

Deploy `schema.sql` once with the Supabase migration tool, and apply the narrowly
scoped routing update in `auth-routing.sql` after checking the current shared
signup trigger. Run `node --test tests/private-access.test.mjs tests/session.test.mjs` before deployment.
The Edge Function deployment includes `index.ts` and `handler.mjs`. The original
archive is stored in service-only `marmullaku_archive_chunks`, covered by the
shared PostgreSQL backups. The archive is **not** committed or served by Pages.
A local recovery copy lives in ignored `work/private-legacy.json`.

The `/legacy/` public route is a sign-in landing page. Original files are returned
only to sibling accounts and rendered in a sandboxed archive viewer. Old Git
commits still contain the previously published archive; restricting the live site
does not remove historical copies. Never add real private CV content, tokens,
service keys, or the private legacy bundle to Git.

To invite another sibling, set their row's `invite_email` to their email through
trusted SQL. Do not replace an existing `owner_user_id` casually. Their first
verified email-code sign-in claims only that row. The admin UI edits CVs and
creates/revokes links; it does not administer shared Auth users or other apps.
