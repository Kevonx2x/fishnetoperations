/** Seed rows for Emmanuel’s 30-day plan (matched by name on `team_members`). */

export type OnboardingDeliverableSeed = {
  week_number: 1 | 2 | 3 | 4;
  deliverable_text: string;
  priority: "Critical" | "High" | "Medium" | "Low";
};

export const ONBOARDING_WEEK_TITLES: Record<1 | 2 | 3 | 4, string> = {
  1: "Week 1 — Onboard Audit Fix Critical Bugs",
  2: "Week 2 — Badges, automation & communications",
  3: "Week 3 — Mobile, performance & compliance",
  4: "Week 4 — Referrals, analytics & review",
};

export const EMMANUEL_UNLOCK_REWARDS: string[] = [
  "Formal employment contract",
  "1% equity stake with 4 year vesting and 1 year cliff",
  "IT Executive and CTO title",
  "Authorization to hire one junior developer",
  "Junior developer salary paid by BahayGo",
  "Rate review based on performance",
];

export const EMMANUEL_DELIVERABLE_SEEDS: OnboardingDeliverableSeed[] = [
  {
    week_number: 1,
    deliverable_text:
      "Full codebase review and understand every major component and API route",
    priority: "High",
  },
  {
    week_number: 1,
    deliverable_text: "Fix pipeline badge count not updating after lead is deleted",
    priority: "Critical",
  },
  {
    week_number: 1,
    deliverable_text: "Fix activity log 400 Bad Request errors in browser console",
    priority: "High",
  },
  {
    week_number: 1,
    deliverable_text: "Fix duplicate lead constraint error on viewing request submission",
    priority: "High",
  },
  {
    week_number: 1,
    deliverable_text: "Confirm end to end pipeline flow viewing request creates a Lead in pipeline",
    priority: "Critical",
  },
  {
    week_number: 1,
    deliverable_text: "Document all additional bugs found during audit with priority ranking",
    priority: "High",
  },
  {
    week_number: 1,
    deliverable_text: "Send daily update message every day without being asked",
    priority: "Critical",
  },
  {
    week_number: 2,
    deliverable_text: "Add remaining 18 badges to the client badge system with hexagonal display",
    priority: "High",
  },
  {
    week_number: 2,
    deliverable_text: "Set up pg_cron on Supabase for viewing appointment reminders 24hr in-app 1hr SMS",
    priority: "High",
  },
  {
    week_number: 2,
    deliverable_text: "Build auto-reply system tied to agent Away toggle in agent profile settings",
    priority: "High",
  },
  {
    week_number: 2,
    deliverable_text:
      "Add listing performance snapshot on each agent listing card views saves inquiries",
    priority: "Medium",
  },
  {
    week_number: 2,
    deliverable_text: "Confirm Twilio SMS fires correctly when phone number is added to environment",
    priority: "High",
  },
  {
    week_number: 2,
    deliverable_text: "Weekly summary report submitted Friday",
    priority: "Critical",
  },
  {
    week_number: 3,
    deliverable_text:
      "Mobile UI polish audit all mobile screens and fix spacing sizing and layout issues",
    priority: "High",
  },
  {
    week_number: 3,
    deliverable_text: "Stream Chat mobile stability ensure no white screens or connection errors",
    priority: "High",
  },
  {
    week_number: 3,
    deliverable_text: "Page load speed audit identify the slowest pages and optimize",
    priority: "Medium",
  },
  {
    week_number: 3,
    deliverable_text: "Filter bar phase 2 add more filter options to the property search",
    priority: "Medium",
  },
  {
    week_number: 3,
    deliverable_text: "Fix all remaining console errors across the entire app",
    priority: "High",
  },
  {
    week_number: 3,
    deliverable_text: "DPA disclosure modal for clients on first document action",
    priority: "Medium",
  },
  {
    week_number: 4,
    deliverable_text:
      "Agent referral system unique referral links track signups auto-apply subscription credit",
    priority: "High",
  },
  {
    week_number: 4,
    deliverable_text: "FAQ page polish and About page final review",
    priority: "Low",
  },
  {
    week_number: 4,
    deliverable_text: "PostHog analytics integration for session tracking and funnel analysis",
    priority: "Medium",
  },
  {
    week_number: 4,
    deliverable_text: "Full end to end demo record a Loom showing the complete agent and client journey",
    priority: "Critical",
  },
  {
    week_number: 4,
    deliverable_text: "Technical documentation update update handoff doc with any changes made",
    priority: "High",
  },
  {
    week_number: 4,
    deliverable_text: "30 day performance review presented to CEO with summary of all work done",
    priority: "Critical",
  },
];
