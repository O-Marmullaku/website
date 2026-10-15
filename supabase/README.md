# Private résumés and sibling accounts

The GitHub Pages frontend contains public family cards only. Supabase project
`vxokxjqhvmicdpxsjomv` (**Family Database**) supplies its separate Auth, `marmullaku_profiles`, `marmullaku_links`,
`marmullaku_archive_chunks`, and the `marmullaku-access` Edge Function. Work applications use a different project. See the shared infrastructure registry in
`../../Lexy/docs/SHARED_INFRASTRUCTURE.md` before changes to shared Auth.

Only a confirmed email explicitly assigned to a sibling's `invite_email` can
claim that profile. All other shared Auth users receive 403. Provision invitations
through trusted SQL; clients cannot assign email or ownership. One user owns one
profile. The homepage Sign in dialog uses email and password. First-time setup
and password reset verify an invited email code before the user chooses a password.
Neither passwords nor codes are retained in browser storage. The shared session
is tab-local; the password is shared with any other apps using the same Auth account.
No invitations are sent by deployment. The `app: marmullaku` signup routing marker
is descriptive; it grants no Marmullaku access. Existing profiles and the private archive were copied; owners reclaim their assigned profile with a verified email code after the project move.

Company links use 32 random bytes in a URL fragment. SHA-256 hashes authorize
requests; an AES-GCM encrypted copy lets the owner copy a link again. The wrapping
key is derived from the server service key, which never reaches the frontend.
Rotating that key leaves existing URLs working, but owners must replace older
links to copy them. New links have no expiry; old expiry dates are still enforced.
Owners can turn links off or on. Anyone holding an active link can forward it.
Downloaded CVs cannot be recalled.
Private responses use `Cache-Control: no-store`; the service key never enters
frontend code. Edit text is escaped before HTML rendering; contact URL schemes
are restricted to HTTP(S), mailto, and tel.

Deploy `schema.sql` once with the Supabase migration tool. `auth-routing.sql` is legacy shared-project setup and must not be applied to Family Database. Run `node --test tests/private-access.test.mjs tests/session.test.mjs` before deployment.
Apply `migrations/20261015113520_inline_profiles_sharing_assets.sql` after the base
schema. The Edge Function deployment includes `index.ts`, `handler.mjs` and
`editor.mjs`. Run `node --test tests/*.test.mjs` and the rollback-only
`tests/private-access.sql` checks before publishing account changes. The original
archive is stored in service-only `marmullaku_archive_chunks`, covered by the
Family PostgreSQL backups. The archive is **not** committed or served by Pages.
A local recovery copy lives in ignored `work/private-legacy.json`.

The `/legacy/` public route is a sign-in landing page. Original files are returned
only to sibling accounts and rendered in a sandboxed archive viewer. Old Git
commits still contain the previously published archive; restricting the live site
does not remove historical copies. Never add real private CV content, tokens,
service keys, or the private legacy bundle to Git.

To invite another sibling, set their row's `invite_email` to their email through
trusted SQL. Do not replace an existing `owner_user_id` casually. Their first
verified email-code sign-in claims only that row. The homepage opens the CV editor
and settings in the same page; `/admin/` redirects there. Owners edit their title
and CV in place. Canonical editor rows live in `cv.editor`; legacy CV fields stay
readable by older clients. Saves use `updated_at` to reject conflicting edits
from another tab. Private content never uses the mockup's browser storage.

`marmullaku_family` contains each CV owner's outgoing view/share grants. A
company link includes its sender plus owners who have enabled a grant to that
sender. Every read rechecks grants; links cannot grant access themselves.
Only senders can read their link's activity. Counts describe link activity, not
unique people, and are capped at 60 events per minute per link. The overview
loads the latest 1,000 events across the owner's latest 100 links.

`marmullaku_assets` describes private PDFs and raster images. Storage bucket
`marmullaku-private` denies direct access with a restrictive policy, including
for other apps sharing this project. Only the Edge Function reads or uploads
objects. File byte signatures, limits, ownership, exact storage paths and CV
attachment IDs are checked. Removed PDFs are soft-deleted; detached files stay
private and consume storage until an operator removes unused objects.

Company suggestions query the official Zefix dataset at `lindas.admin.ch/query`
after a short delay. Search works without credentials; manual entry and local
fuzzy suggestions remain available when the register is slow or unavailable.

The full-site design preview is `/mockup/`. It mirrors the shipped homepage but
uses `mockup/preview-session.mjs` and browser storage for sample accounts, CVs,
files, links and activity. Its first load carries over the previous mockup draft.
It does not load production account configuration or call the live backend.
Production editor markup, styles and components live under `/profile/`; the
PDF.js vendor files are shared static assets. Keep design experiments in the
mockup until they are explicitly approved for the live site.
