/**
 * Default detailed task notes for admin deliverables, matched by keywords in
 * `deliverable_text` (case-insensitive). Used when expanding notes in team
 * management and when seeding DB notes for Emmanuel's plan.
 */

const NOTES_CODEBASE_REVIEW =
  "Read through every major file before touching anything. Start with: app/page.tsx (homepage), components/marketplace/fishnet-home-marketplace.tsx (listings), components/dashboard/agent-dashboard.tsx (most important file), components/dashboard/agent-pipeline-tab.tsx (pipeline and documents), app/properties/[id]/page.tsx (property detail), app/api/create-viewing-request/route.ts (viewing request flow), components/chat/agent-chat-inbox.tsx (Stream Chat). After reading send a Upwork message summarizing the architecture and flagging anything unclear. Do NOT change any code on day 1.";

const NOTES_PIPELINE_BADGE =
  "The Pipeline tab sidebar badge count does not update after a lead is deleted or declined. Find where the badge count is fetched in components/dashboard/agent-dashboard.tsx and make it refetch after any lead status change or delete. Count should only include leads where pipeline_stage is not declined and not closed.";

const NOTES_ACTIVITY_LOG =
  "Open browser console on the agent public profile page at /agents/[id]. You will see 400 Bad Request errors hitting the Supabase activity_log table. The error happens because agent_id is undefined when the query fires. Find the activity log fetch in app/agents/[id]/page.tsx and add a guard — only fire the query if agent_id exists and is a valid UUID. Do not change the activity log logic itself.";

const NOTES_DUPLICATE =
  "When a client submits a viewing request for a property they already requested before the system throws a duplicate key error. Fix is in app/api/create-viewing-request/route.ts — before inserting a new lead check if one already exists for the same client_id and agent_id and property_id combination. If it exists update the existing lead instead of inserting a new one. Return success either way.";

const NOTES_E2E_PIPELINE =
  "Walk through this exact flow and document every step: 1. Log in as client turonboyd16@gmail.com on one browser. 2. Log in as agent testagent5@gmail.com on another browser. 3. Client submits a viewing request on any property. 4. Confirm a Lead appears in agent pipeline under Lead tab. 5. Agent clicks View Documents and requests a Valid ID from client. 6. Client goes to notification center and sees the document request. 7. Client uploads Valid ID. 8. Agent receives notification that document was received. 9. Agent clicks Move to Viewing. 10. Lead moves to Viewing tab. 11. Client receives viewing confirmation notification. Fix every breaking point. This flow must work perfectly before Josh lists real properties.";

const NOTES_DOCUMENT_AUDIT =
  "Do not rebuild anything yet. First audit the current document system across all three files: components/dashboard/agent-pipeline-tab.tsx (agent side), components/client/mobile-client-dashboard.tsx (client side), and app/settings/page.tsx (settings documents). List every inconsistency, missing feature, and confusing UI element. Send the audit as a Upwork message before writing a single line of code.";

const NOTES_DAILY_UPDATE =
  "Every day at the end of your 4 hour session send this message on Upwork: TODAY [Date] / Done: [what you completed] / In Progress: [what you are working on] / Blocker: [anything blocking you or None] / Hours logged: [X hours]. If there is a blocker message immediately do not wait until end of day.";

/** Returns default notes text when `deliverable_text` matches a known task, else null. */
export function getDefaultDeliverableTaskNotes(deliverableText: string): string | null {
  const t = deliverableText.trim().toLowerCase();
  if (t.includes("codebase review")) return NOTES_CODEBASE_REVIEW;
  if (t.includes("pipeline badge")) return NOTES_PIPELINE_BADGE;
  if (t.includes("activity log")) return NOTES_ACTIVITY_LOG;
  if (t.includes("duplicate")) return NOTES_DUPLICATE;
  if (t.includes("end to end") || t.includes("pipeline flow")) return NOTES_E2E_PIPELINE;
  if (t.includes("daily update")) return NOTES_DAILY_UPDATE;
  if (/\bdocuments?\b/i.test(deliverableText) && !/\bdaily\b/i.test(deliverableText)) {
    return NOTES_DOCUMENT_AUDIT;
  }
  return null;
}
