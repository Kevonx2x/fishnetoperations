-- Populate detailed task notes on Emmanuel's onboarding deliverables (employee_deliverables.notes).
-- Same keyword rules as lib/deliverable-task-note-templates.ts (equivalent to PATCH body field `notes`).

UPDATE public.employee_deliverables AS ed
SET
  notes = CASE
    WHEN ed.deliverable_text ILIKE '%codebase review%' THEN $cbc$
Read through every major file before touching anything. Start with: app/page.tsx (homepage), components/marketplace/fishnet-home-marketplace.tsx (listings), components/dashboard/agent-dashboard.tsx (most important file), components/dashboard/agent-pipeline-tab.tsx (pipeline and documents), app/properties/[id]/page.tsx (property detail), app/api/create-viewing-request/route.ts (viewing request flow), components/chat/agent-chat-inbox.tsx (Stream Chat). After reading send a Upwork message summarizing the architecture and flagging anything unclear. Do NOT change any code on day 1.
$cbc$
    WHEN ed.deliverable_text ILIKE '%pipeline badge%' THEN $pbd$
The Pipeline tab sidebar badge count does not update after a lead is deleted or declined. Find where the badge count is fetched in components/dashboard/agent-dashboard.tsx and make it refetch after any lead status change or delete. Count should only include leads where pipeline_stage is not declined and not closed.
$pbd$
    WHEN ed.deliverable_text ILIKE '%activity log%' THEN $act$
Open browser console on the agent public profile page at /agents/[id]. You will see 400 Bad Request errors hitting the Supabase activity_log table. The error happens because agent_id is undefined when the query fires. Find the activity log fetch in app/agents/[id]/page.tsx and add a guard — only fire the query if agent_id exists and is a valid UUID. Do not change the activity log logic itself.
$act$
    WHEN ed.deliverable_text ILIKE '%duplicate%' THEN $dup$
When a client submits a viewing request for a property they already requested before the system throws a duplicate key error. Fix is in app/api/create-viewing-request/route.ts — before inserting a new lead check if one already exists for the same client_id and agent_id and property_id combination. If it exists update the existing lead instead of inserting a new one. Return success either way.
$dup$
    WHEN ed.deliverable_text ILIKE '%end to end%' OR ed.deliverable_text ILIKE '%pipeline flow%' THEN $e2e$
Walk through this exact flow and document every step: 1. Log in as client turonboyd16@gmail.com on one browser. 2. Log in as agent testagent5@gmail.com on another browser. 3. Client submits a viewing request on any property. 4. Confirm a Lead appears in agent pipeline under Lead tab. 5. Agent clicks View Documents and requests a Valid ID from client. 6. Client goes to notification center and sees the document request. 7. Client uploads Valid ID. 8. Agent receives notification that document was received. 9. Agent clicks Move to Viewing. 10. Lead moves to Viewing tab. 11. Client receives viewing confirmation notification. Fix every breaking point. This flow must work perfectly before Josh lists real properties.
$e2e$
    WHEN ed.deliverable_text ILIKE '%daily update%' THEN $dly$
Every day at the end of your 4 hour session send this message on Upwork: TODAY [Date] / Done: [what you completed] / In Progress: [what you are working on] / Blocker: [anything blocking you or None] / Hours logged: [X hours]. If there is a blocker message immediately do not wait until end of day.
$dly$
    WHEN ed.deliverable_text ILIKE 'document%' AND ed.deliverable_text NOT ILIKE '%daily%' THEN $doc$
Do not rebuild anything yet. First audit the current document system across all three files: components/dashboard/agent-pipeline-tab.tsx (agent side), components/client/mobile-client-dashboard.tsx (client side), and app/settings/page.tsx (settings documents). List every inconsistency, missing feature, and confusing UI element. Send the audit as a Upwork message before writing a single line of code.
$doc$
  END,
  updated_at = now()
FROM public.team_members AS tm
WHERE tm.id = ed.employee_id
  AND tm.agent_id IS NULL
  AND tm.name ILIKE '%emmanuel%'
  AND (
    ed.deliverable_text ILIKE '%codebase review%'
    OR ed.deliverable_text ILIKE '%pipeline badge%'
    OR ed.deliverable_text ILIKE '%activity log%'
    OR ed.deliverable_text ILIKE '%duplicate%'
    OR ed.deliverable_text ILIKE '%end to end%'
    OR ed.deliverable_text ILIKE '%pipeline flow%'
    OR ed.deliverable_text ILIKE '%daily update%'
    OR (ed.deliverable_text ILIKE 'document%' AND ed.deliverable_text NOT ILIKE '%daily%')
  );
