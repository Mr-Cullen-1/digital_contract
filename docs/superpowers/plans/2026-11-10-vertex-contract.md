# Vertex Contract Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task. User already approved architecture and authorized implementation.

**Goal:** Deliver the shared Vertex design system and complete create → send → sign → close → download application with real Supabase integration.
**Architecture:** Next.js server routes validate requests and call transaction-oriented PostgreSQL functions. Private Storage holds source and final files; owner access is authenticated and guest access token-scoped.
**Tech Stack:** Next.js, React, TypeScript, Tailwind, shadcn/ui conventions, Radix primitives, Supabase SSR, Tiptap, signature_pad, mammoth, pdf-lib/fontkit, Vitest.
**Spec:** ../specs/2026-11-10-vertex-contract-design.md

## Global Constraints
- Russian interface; Inter; #111318 / #20242D / #FFFFFF / #F5F6F8 / #635BFF / #16A37A.
- No fake integration, no real customer data in tests, no cloud deployment without configured destination.
- Closed records cannot be edited via API or direct application database roles.
- Token secrets never stored in cleartext in database or application logs.

## Review Focus
- Foreign-owner access and guest tokens cannot enumerate contracts.
- Replayed sends, signatures and closes must not duplicate identity or signatures.
- Invalid/malformed uploads and oversized payloads fail safely.
- PDF preserves Cyrillic, both signatures, original pages and actual-byte integrity.
- Mobile signing, navigation, unsaved edits and connection errors remain usable.

## Task 1: Foundation and shared UI
Files: package.json, app/layout.tsx, app/globals.css, components/ui/*, components/app-shell.tsx, lib/domain.ts, tests/domain.test.ts.
Interfaces: ContractStatus, Party, Contract, draftSchema, signatureSchema; Button/Card/Input/Badge/Modal.
- [x] Install pinned dependencies and create typed configuration.
- [x] Write and run validation tests rejecting missing identity, malformed signatures and invalid states.
- [x] Implement shared tokens and components before screen layouts; build responsive shell and honest unconfigured state.
- [x] Run npm test and npm run typecheck.

## Task 2: Supabase persistence and lifecycle
Files: supabase/migrations/*, lib/supabase/*, lib/contracts.ts, app/api/contracts/*, tests/database.test.ts.
Interfaces: authenticated owner CRUD; server-only RPCs for save/send/sign/close/cancel; readContract(ownerId,id).
- [x] Test owner isolation, frozen version enforcement, revoked links and idempotent closing against PostgreSQL-compatible local engine.
- [x] Implement schema, RLS, storage restrictions, transactional lifecycle functions and server routes.
- [x] Document live verification deferred: user explicitly selected local project without cloud connection.
- [x] Run database and domain suite.

## Task 3: Editor, import and signing
Files: components/contract-editor.tsx, components/signature-pad.tsx, components/party-fields.tsx, app/contracts/*, app/sign/*, lib/documents.ts.
Interfaces: shared Party fields; Tiptap JSON content; POST draft/import/send/public-sign; signature PNG.
- [x] Test sanitized DOCX import and PDF assembly with Cyrillic fixture and signature.
- [x] Implement editor toolbar, templates, original upload, preview, signature dialog and token-scoped recipient form.
- [x] Preserve form state on recoverable errors and confirm destructive deletion.
- [x] Run tests and typecheck.

## Task 4: Finalization and verification
Files: lib/pdf.ts, app/api/contracts/[id]/action/route.ts, components/contract-details.tsx, README.md.
Interfaces: retryable final PDF with stable unique number, SHA-256, audit event, immutable Closed state.
- [x] Implement original-page merge, execution sheet, final file verification and guarded DB completion.
- [x] Run full tests, typecheck, production build and HTTP smoke checks.
- [ ] Desktop/tablet/mobile browser checks: host unavailable in this environment; explicitly deferred.
- [x] Record verified results and cloud/environment limitations in README and docs/verification.md.

## Execution notes
Empty workspace has no Git history or existing branch; implemented directly in the user-selected directory. No commits or deployment needed for this handoff. Shared interfaces are centralized in lib/domain.ts. User selected local development without cloud connection. Final checks: 21 tests, TypeScript, production build and HTTP smoke passed; see docs/verification.md.
