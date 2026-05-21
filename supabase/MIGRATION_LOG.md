# Supabase migration audit log

Newest entries first. Add a row **before** running each migration; update **Status** and **Executed by** immediately after execution.

---

## 2026-05-20 12:00 — Dormspace likes (hearts)

**Migration file:** supabase/migrations/20260520120000_dormspace_likes.sql
**Executed by:** (pending)
**Status:** Pending
**Tables affected:** dormspace_likes (new)
**Summary:** User hearts on approved dorm listings; RLS scoped to own rows for select/insert/delete.
**Rollback notes:** `drop table if exists public.dormspace_likes cascade;`

---

## 2026-05-21 16:00 — Dormspaces: landlord role + inquiry CRM

**Migration file:** supabase/migrations/20260521160000_dormspaces_landlord_crm.sql
**Executed by:** TJ (pending)
**Status:** Pending
**Tables affected:** profiles (role check), dormspace_inquiries (status constraint, responded_at), dormspaces (RLS)
**Summary:** Adds `landlord` profile role; inquiry status workflow; landlord SELECT/UPDATE on inquiries for owned listings; landlord UPDATE/DELETE on own dormspaces.
**Rollback notes:** Restore prior `profiles_role_check`; drop new inquiry/dormspace policies; restore `dormspaces_update_own_pending` if needed.

---

## 2026-05-21 14:00 — Dormspaces: show pending listings publicly

**Migration file:** supabase/migrations/20260521140000_dormspaces_allow_pending_visible.sql
**Executed by:** TJ (pending)
**Status:** Pending
**Tables affected:** dormspaces, dormspace_photos (RLS policies only)
**Summary:** Public browse/detail can read `pending` and `approved` listings; rejected/archived stay hidden. Photos policy updated to match.
**Rollback notes:** Restore `dormspaces_select_public` to `status = 'approved'` only; restore photos policy likewise (see prior migration).

---

## 2026-05-21 12:00 — Create dormspaces tables

**Migration file:** supabase/migrations/20260521120000_create_dormspaces.sql
**Executed by:** TJ (pending)
**Status:** Pending
**Tables affected:** dormspaces, dormspace_photos, dormspace_inquiries; storage buckets `dormspace-photos`, `dormspace-verification`
**Summary:** Bedspace/coliving MVP — landlord submissions, moderation workflow, public browse, inquiries, Supabase Storage for listing photos and verification docs.
**Rollback notes:** `DROP TABLE IF EXISTS public.dormspace_inquiries CASCADE; DROP TABLE IF EXISTS public.dormspace_photos CASCADE; DROP TABLE IF EXISTS public.dormspaces CASCADE;` (see migration for storage policies)

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

