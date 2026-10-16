# Marmullaku website

## Local development

Serve this directory with `python -m http.server 8000 --bind 127.0.0.1` and open http://localhost:8000/.

On localhost, every profile opens with inline editing. CV drafts, uploaded files and sample links stay in this browser; they do not read or change live CVs. Drafts use the `marmullaku-local-profiles-v1` browser storage key, separate from the mockup. Local sample links include `?local=1` and work only in the browser holding their data.

Public hosting always uses the normal authenticated backend. Ordinary company invitation links on localhost also use that backend unless marked as local sample links. The local mode accepts only loopback hostnames, not LAN addresses or domains.

The reader and inline editor share the white A4 presentation in `main/profile-live.css`. `profile/` is the production editor; `mockup/` holds the isolated sample experience. Backend setup is documented in [supabase/README.md](supabase/README.md).
