# Supabase migration audit log

Newest entries first. Add a row **before** running each migration; update **Status** and **Executed by** immediately after execution.

---

## 2026-05-20 12:00 — Create articles table

**Migration file:** supabase/migrations/20260520120000_create_articles.sql
**Executed by:** TJ (pending)
**Status:** Pending
**Tables affected:** articles
**Summary:** Articles & guides for `/blog`, homepage featured cards, and Admin → Articles CRUD.
**Rollback notes:** `DROP TABLE IF EXISTS public.articles CASCADE;`

---

## 2026-05-19 12:00 — Create agency_inquiries table

**Migration file:** supabase/migrations/20260519120000_create_agency_inquiries.sql
**Executed by:** TJ (pending)
**Status:** Ran successfully  
**Tables affected:** agency_inquiries
**Summary:** Adds `agency_inquiries` for marketplace contact form submissions, with RLS for public insert and agency/admin read/update.
**Rollback notes:** `DROP TABLE IF EXISTS public.agency_inquiries CASCADE;` (see migration file)

---

## 2026-05-18 12:00 — Rename brokers to agencies

**Migration file:** supabase/migrations/20260518120000_rename_brokers_to_agencies.sql
**Executed by:** Cursor (Supabase MCP)
**Status:** ran successfully
**Tables affected:** brokers→agencies, agents, agent_brokers→agent_agencies, storage.buckets, RLS policies, triggers, notifications
**Summary:** Renames the broker company table and related columns/policies to agency terminology while keeping legacy role/tier string values unchanged.
**Rollback notes:** see migration file (complex; restore from backup if production data exists)

---

