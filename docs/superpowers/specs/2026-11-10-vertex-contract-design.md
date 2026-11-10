# Vertex Contract — approved architecture

Approved in chat on 2026-11-10. Product: Vertex Contract; parent: Vertex Studio; secondary branding: Digital Contract by Vertex Studio and A Vertex Studio Product.

One Next.js App Router application with Supabase Auth, PostgreSQL and private Storage. Authenticated creators; recipients use expiring, revocable capability links without registration. No fake persistence or localStorage substitute. Without configuration, show a clear connection state; editable unsaved content may be previewed.

Shared tokens: graphite #111318, dark surface #20242D, white #FFFFFF, background #F5F6F8, accent #635BFF, success #16A37A. Inter, small radii, fine borders, restrained shadows. Shared sidebar/layout, buttons, cards, fields, badges, dialogs. Russian first, localization dictionary ready for expansion.

Creator signs a frozen version before sending; recipient fills details and signs that version. State machine: Draft → Sent → Signed → Closed; Draft/Sent → Cancelled. Revocation terminates the current invite. Editing after send requires a new draft. Only draft deletion; closed content, parties, versions, signatures and files are protected in the database and Storage access layer.

DOCX original retained and sanitized content extracted for Tiptap. PDF source pages retained with appended execution sheet. Final PDF includes both parties and signatures, unique CTR-year-sequence number, closing timestamp. Store its actual SHA-256 externally, never a self-referential PDF hash. Finalization is retryable; reserve number once, publish Closed only after file persistence and byte verification. Gaps in numbers allowed.

Tables: profiles, contracts, contract_parties, contract_versions, contract_files, contract_signatures, contract_links, contract_events, contract_templates, contract_finalizations. Private buckets: originals, versions, signatures, finals. RLS owner reads; state-changing SQL functions only callable by the trusted server, which validates authentication. Guest access always token-scoped. Audit metadata minimized. No qualified electronic-signature or automatic legal-validity claims.

Production hosting/data residency remains a separate choice; use synthetic data until reviewed. No deployment requested in this implementation turn.
