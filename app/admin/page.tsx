"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Eye, EyeOff, X } from "lucide-react";
import { toast } from "sonner";
import { TeamManagementSection } from "@/components/admin/team-management-section";
import { useAuth } from "@/contexts/auth-context";
import { isAdminPanelRole, isFullAdminRole } from "@/lib/auth-roles";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";

interface Lead {
  /** bigint from PostgREST is often JSON-serialized as number */
  id: string | number;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  property_interest: string | null;
  message: string | null;
  stage?: string;
  /** @deprecated legacy column */
  status?: string;
}

interface Property {
  id: string;
  created_at: string;
  location: string;
  price: string;
  status?: string;
  sqft: string;
  beds: number;
  baths: number;
  image_url: string;
  listed_by?: string | null;
  featured?: boolean;
  availability_state?: string | null;
}

interface PendingBroker {
  id: string;
  created_at: string;
  name: string;
  company_name: string;
  license_number: string;
  license_expiry: string | null;
  phone: string | null;
  email: string;
  website: string | null;
  bio: string | null;
  status: string;
}

interface PendingAgent {
  id: string;
  created_at: string;
  name: string;
  license_number: string;
  license_expiry: string | null;
  phone: string | null;
  email: string;
  bio: string | null;
  broker_id: string | null;
  status: string;
}

interface AdminUserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  created_at: string;
  agent_verified: boolean | null;
  broker_verified: boolean | null;
  agent_id: string | null;
  broker_id: string | null;
  agent_status: string | null;
  broker_status: string | null;
}

interface AllAgentRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  license_number: string;
  score: number;
  closings: number;
  status: string;
  verified: boolean;
  verification_status?: string | null;
  broker_id: string | null;
  user_id: string;
  created_at: string;
  rejection_reason: string | null;
}

interface CoAgentRequestRow {
  id: string;
  created_at: string;
  status: string;
  property_id: string;
  agent_id: string;
  propertyName: string;
  propertyLocation: string;
  agentName: string;
}

interface ApplicantRow {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  age: number;
  email: string;
  notes: string | null;
  status: string;
}

interface VaLeadRow {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  platform: string | null;
  listing_link: string | null;
  status: string;
  follow_up_stage: string | null;
  last_contacted_at: string | null;
  assigned_to: string | null;
  notes: string | null;
  messages_sent: number;
}

interface VaDailyReportRow {
  id: string;
  created_at: string;
  va_name: string;
  report_date: string;
  leads_found: number;
  contacts_made: number;
  replies: number;
  meetings_booked: number;
}

interface AdminCredentialRow {
  id: string;
  created_at: string;
  service_name: string;
  username: string;
  password_plain: string;
  monthly_cost: number;
  notes: string | null;
}

interface ProfileReportRow {
  id: string;
  created_at: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  notes: string | null;
  reporter_name: string;
  reported_name: string;
}

interface TeamMemberRow {
  id: string;
  created_at: string;
  name: string;
  email: string;
  role: "owner" | "co_founder" | "va_admin";
  created_by: string | null;
}

const CREDENTIALS_SUPER_ADMIN_EMAIL = "ron.business101@gmail.com";

type ManualSubTab =
  | "overview"
  | "services"
  | "roles"
  | "pipeline"
  | "dailyOps"
  | "scale"
  | "emergency"
  | "team"
  | "legal";

const MANUAL_SUB_TABS: { id: ManualSubTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "services", label: "Services" },
  { id: "roles", label: "Roles" },
  { id: "pipeline", label: "Pipeline" },
  { id: "dailyOps", label: "Daily Ops" },
  { id: "scale", label: "Scale" },
  { id: "emergency", label: "Emergency" },
  { id: "team", label: "Team" },
  { id: "legal", label: "Legal" },
];

const LEGAL_MANUAL_STORAGE_KEY = "bahaygo-admin-manual-legal-checklist";

type LegalManualRisk = "High" | "Medium" | "Low";

const LEGAL_MANUAL_ITEMS: {
  id: string;
  title: string;
  description: string;
  risk: LegalManualRisk;
  steps: string[];
}[] = [
  {
    id: "npc_registration",
    title: "NPC Registration",
    description:
      "Required when you reach 1,000 personal data records. High risk if missed — fines up to 5 million pesos.",
    risk: "High",
    steps: [
      "Step 1 — Go to privacy.gov.ph and create an account.",
      "Step 2 — Register your organization as a Personal Information Controller.",
      "Step 3 — Submit your Data Protection Officer details (this can be you).",
      "Step 4 — Pay the registration fee (around PHP 1,000).",
      "Step 5 — Receive your NPC registration certificate.",
      "Do this before you hit 1,000 user accounts.",
    ],
  },
  {
    id: "dpa_compliance",
    title: "Data Privacy Act Compliance",
    description:
      "DPA consent on all forms; privacy policy live on the site and linked wherever you collect data.",
    risk: "High",
    steps: [
      "Step 1 — Confirm your Privacy Policy page is live at bahaygo.com/privacy.",
      "Step 2 — Confirm DPA consent checkbox exists on agent registration form.",
      "Step 3 — Confirm data consent modal appears before document uploads.",
      "Step 4 — Make sure users can delete their account in Settings (Right to Erasure).",
      "Step 5 — Appoint yourself as Data Protection Officer and document it.",
    ],
  },
  {
    id: "prc_disclaimer",
    title: "PRC Verification Disclaimer",
    description:
      "Agents are verified by BahayGo processes; verification is not a government guarantee of licensure status.",
    risk: "Medium",
    steps: [
      "Step 1 — Go to your Terms of Service page and confirm it states BahayGo verifies agents through document submission and is not affiliated with PRC.",
      "Step 2 — Confirm every agent profile shows Verified by BahayGo not Verified by PRC.",
      "Step 3 — Add a tooltip or info icon explaining what verification means on the agent profile page.",
    ],
  },
  {
    id: "hold_harmless",
    title: "Hold Harmless Clause",
    description:
      "Terms of Service should protect BahayGo from liability for fraudulent or inaccurate listings and user-generated content.",
    risk: "Medium",
    steps: [
      "Step 1 — Go to bahaygo.com/terms and confirm the hold harmless clause is in the Terms of Service.",
      "Step 2 — The clause should state users agree BahayGo is not liable for fraudulent listings, agent misconduct, or transaction disputes.",
      "Step 3 — Have a lawyer review the clause before public launch.",
    ],
  },
  {
    id: "aml",
    title: "Anti-Money Laundering",
    description:
      "Real estate transactions over 500k PHP may require AMLC reporting when BahayGo processes or facilitates payments.",
    risk: "High",
    steps: [
      "Step 1 — Go to amlc.gov.ph and read the real estate covered person guidelines.",
      "Step 2 — Register as a covered person if you process property transactions over PHP 500,000.",
      "Step 3 — Implement a Know Your Customer process for high-value transactions.",
      "Step 4 — Keep transaction records for 5 years.",
      "Note: This applies when you actually facilitate payments not just connect buyers and agents.",
    ],
  },
  {
    id: "sec_registration",
    title: "SEC Registration",
    description:
      "Required if you take investment or grant co-founders equity; structure the entity before taking outside capital.",
    risk: "High",
    steps: [
      "Step 1 — Decide your structure: sole proprietor (DTI registration) or corporation (SEC registration).",
      "Step 2 — If taking investment or adding co-founders with equity, register as a corporation at SEC.",
      "Step 3 — Go to esecure.sec.gov.ph to file online.",
      "Step 4 — Prepare Articles of Incorporation and By-Laws.",
      "Step 5 — Pay registration fees (around PHP 2,000 to 5,000).",
      "Step 6 — Get your Certificate of Incorporation.",
    ],
  },
  {
    id: "bir_registration",
    title: "BIR Registration",
    description:
      "Required once you have revenue; register as sole proprietor or corporation and issue receipts as required.",
    risk: "High",
    steps: [
      "Step 1 — Go to your local BIR Revenue District Office.",
      "Step 2 — Register your business using BIR Form 1901 (sole proprietor) or 1903 (corporation).",
      "Step 3 — Get your Certificate of Registration (Form 2303).",
      "Step 4 — Register your official receipts or invoices.",
      "Step 5 — Set up quarterly and annual tax filing.",
      "Hire an accountant — do not do this alone.",
    ],
  },
  {
    id: "business_permit",
    title: "Business Permit",
    description:
      "Local government unit permit for Taguig or wherever you operate the business.",
    risk: "Medium",
    steps: [
      "Step 1 — Go to your local city hall in Taguig (or wherever you operate).",
      "Step 2 — Secure a Barangay Clearance first from your barangay hall.",
      "Step 3 — Apply for a Mayor's Permit at the Business Permits and Licensing Office.",
      "Step 4 — Submit DTI or SEC registration, lease contract or address proof, and barangay clearance.",
      "Step 5 — Pay the permit fee and receive your Business Permit.",
      "Renew every January.",
    ],
  },
  {
    id: "intellectual_property",
    title: "Intellectual Property",
    description:
      "Trademark the BahayGo name and logo with IPOPHL to protect the brand in the Philippines.",
    risk: "Medium",
    steps: [
      "Step 1 — Go to ipophil.gov.ph and create an account.",
      "Step 2 — Search if BahayGo is already trademarked by someone else.",
      "Step 3 — File a trademark application for the BahayGo name and logo.",
      "Step 4 — Pay the filing fee (around PHP 2,000 to 4,000).",
      "Step 5 — Wait 18 to 24 months for approval.",
      "File as soon as possible — first to file wins in the Philippines.",
    ],
  },
  {
    id: "agent_liability",
    title: "Agent Liability",
    description:
      "Agents are independent contractors, not employees; reflect this in agent terms and onboarding.",
    risk: "Low",
    steps: [
      "Step 1 — Go to bahaygo.com/terms and confirm agents are listed as independent contractors not employees.",
      "Step 2 — Add a section stating BahayGo is not responsible for agent conduct outside the platform.",
      "Step 3 — Confirm agents agreed to Terms of Service during registration.",
      "Step 4 — Have a lawyer add an independent contractor clause before you reach 50 agents.",
    ],
  },
];

interface PropertyConnectedAgent {
  id: string;
  name: string;
  email: string;
  status: string;
  verified: boolean | null;
}

interface PropertyAgentOption {
  id: string;
  name: string;
  email: string;
}

type PropertyFormAvailability = "available" | "reserved" | "closed" | "removed";

const emptyPropertyForm = {
  location: "",
  price: "",
  sqft: "",
  beds: "",
  baths: "",
  image_url: "",
  availability_state: "available" as PropertyFormAvailability,
};

const MASKED_PRC_DISPLAY = "PRC-AG-202*-*****";

function maskPrcForAdminQueue(_licenseNumber: string | null | undefined): string {
  return MASKED_PRC_DISPLAY;
}

function verificationColumnLabel(v: string | null | undefined): string {
  if (v === "verified") return "Verified";
  if (v === "pending") return "Pending Docs";
  if (v === "rejected") return "Rejected";
  if (v === "suspended") return "Suspended";
  return "Unverified";
}

function verificationColumnClass(v: string | null | undefined): string {
  if (v === "verified") return "text-emerald-700";
  if (v === "pending") return "text-amber-700";
  if (v === "rejected") return "text-red-700";
  if (v === "suspended") return "text-red-800";
  return "text-gray-500";
}

function docQueueBadgeClass(v: string | null | undefined): string {
  if (v === "pending") return "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900";
  if (v === "rejected") return "rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-900";
  return "rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700";
}

const DOC_REJECT_REASONS = [
  "Documents unclear or unreadable",
  "PRC number doesn't match uploaded ID",
  "Selfie does not match ID photo",
  "Expired license",
  "Other",
] as const;

const DOC_SUSPEND_REASONS = [
  "Fraudulent listing reported",
  "Multiple client complaints",
  "Impersonation suspected",
  "Platform policy violation",
  "Other",
] as const;

const APPLICANT_STATUSES = ["New", "Interviewed", "Hired", "Rejected"] as const;

function applicantStatusPillClass(status: string): string {
  if (status === "New") return "bg-gray-200 text-gray-800";
  if (status === "Interviewed") return "bg-[#6B9E6E] text-white";
  if (status === "Hired") return "bg-[#D4A843] text-white";
  if (status === "Rejected") return "bg-red-600 text-white";
  return "bg-gray-200 text-gray-800";
}

const VA_LEAD_STATUSES = [
  "not_contacted",
  "contacted",
  "replied",
  "booked",
  "no_response",
] as const;

function vaLeadStatusPillClass(status: string): string {
  if (status === "not_contacted") return "bg-gray-200 text-gray-800";
  if (status === "contacted") return "bg-blue-600 text-white";
  if (status === "replied") return "bg-yellow-400 text-gray-900";
  if (status === "booked") return "bg-green-600 text-white";
  if (status === "no_response") return "bg-red-600 text-white";
  return "bg-gray-200 text-gray-800";
}

function vaLeadNeedsFollowUp(row: VaLeadRow): boolean {
  if (row.status === "booked" || row.status === "no_response") return false;
  if (!row.last_contacted_at) return true;
  const ms = Date.now() - new Date(row.last_contacted_at).getTime();
  return ms > 2 * 24 * 60 * 60 * 1000;
}

function formatPesoMonthly(n: number): string {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatVerificationErrorDetails(
  status: number,
  statusText: string,
  body: unknown,
): string {
  const payload =
    typeof body === "string"
      ? body
      : body === undefined || body === null
        ? "(empty body)"
        : JSON.stringify(body, null, 2);
  return [
    `HTTP ${status}${statusText ? ` ${statusText}` : ""}`,
    "",
    payload,
  ].join("\n");
}

export default function AdminPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [adminSection, setAdminSection] = useState<
    | "leads"
    | "properties"
    | "verification"
    | "agents"
    | "users"
    | "coagent"
    | "hiring"
    | "teamMembers"
    | "teamManagement"
    | "outreach"
    | "profileReports"
    | "vaReports"
    | "credentials"
    | "manual"
  >("leads");

  const [manualSubTab, setManualSubTab] = useState<ManualSubTab>("overview");
  const [legalManualChecked, setLegalManualChecked] = useState<Record<string, boolean>>({});
  const [legalManualAccordionOpen, setLegalManualAccordionOpen] = useState<Record<string, boolean>>({});
  const [legalManualHydrated, setLegalManualHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LEGAL_MANUAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        if (parsed && typeof parsed === "object") setLegalManualChecked(parsed);
      }
    } catch {
      /* ignore */
    }
    setLegalManualHydrated(true);
  }, []);

  useEffect(() => {
    if (!legalManualHydrated || typeof window === "undefined") return;
    try {
      localStorage.setItem(LEGAL_MANUAL_STORAGE_KEY, JSON.stringify(legalManualChecked));
    } catch {
      /* ignore */
    }
  }, [legalManualChecked, legalManualHydrated]);

  const [properties, setProperties] = useState<Property[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [propertyForm, setPropertyForm] = useState(emptyPropertyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [propertyError, setPropertyError] = useState("");
  const [propertySaving, setPropertySaving] = useState(false);
  const [featuredSettingId, setFeaturedSettingId] = useState<string | null>(null);
  const [propertyAvailabilityPatchingId, setPropertyAvailabilityPatchingId] = useState<string | null>(null);
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false);

  const [pendingBrokers, setPendingBrokers] = useState<PendingBroker[]>([]);
  const [pendingAgents, setPendingAgents] = useState<PendingAgent[]>([]);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [rejectOpen, setRejectOpen] = useState<
    | { kind: "broker"; id: string }
    | { kind: "agent"; id: string }
    | null
  >(null);
  const [rejectReason, setRejectReason] = useState("");

  const [docReviewAgent, setDocReviewAgent] = useState<AllAgentRow | null>(null);
  const [docReviewUrls, setDocReviewUrls] = useState<{
    license_number: string;
    prc_signed_url: string | null;
    selfie_signed_url: string | null;
    has_documents: boolean;
  } | null>(null);
  const [docReviewLoading, setDocReviewLoading] = useState(false);
  const [docRejectReasonKey, setDocRejectReasonKey] = useState("");
  const [docRejectOtherText, setDocRejectOtherText] = useState("");
  const [docSuspendReasonKey, setDocSuspendReasonKey] = useState("");
  const [docSuspendOtherText, setDocSuspendOtherText] = useState("");
  const [docActionSaving, setDocActionSaving] = useState(false);

  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [allAgentsList, setAllAgentsList] = useState<AllAgentRow[]>([]);
  const [allAgentsLoading, setAllAgentsLoading] = useState(false);
  const [editAgent, setEditAgent] = useState<AllAgentRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    license_number: "",
    score: "",
    closings: "",
    status: "pending",
    broker_id: "",
  });

  const [coAgentRequests, setCoAgentRequests] = useState<CoAgentRequestRow[]>([]);
  const [coAgentLoading, setCoAgentLoading] = useState(false);
  const [coAgentError, setCoAgentError] = useState("");

  const [applicants, setApplicants] = useState<ApplicantRow[]>([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [applicantsError, setApplicantsError] = useState("");
  const [addApplicantOpen, setAddApplicantOpen] = useState(false);
  const [newApplicantForm, setNewApplicantForm] = useState({
    first_name: "",
    last_name: "",
    age: "",
    email: "",
    notes: "",
    status: "New",
  });
  const [addApplicantSaving, setAddApplicantSaving] = useState(false);
  const [editingApplicantId, setEditingApplicantId] = useState<string | null>(null);
  const [editApplicantDraft, setEditApplicantDraft] = useState({
    status: "New",
    notes: "",
  });
  const [editApplicantSaving, setEditApplicantSaving] = useState(false);

  const [vaLeads, setVaLeads] = useState<VaLeadRow[]>([]);
  const [vaLeadsStats, setVaLeadsStats] = useState({
    totalLeads: 0,
    contactedToday: 0,
    repliesToday: 0,
    meetingsBookedToday: 0,
  });
  const [vaLeadsAssignOptions, setVaLeadsAssignOptions] = useState<string[]>([]);
  const [vaLeadsLoading, setVaLeadsLoading] = useState(false);
  const [vaLeadsError, setVaLeadsError] = useState("");
  const [outreachSearch, setOutreachSearch] = useState("");
  const [outreachStatusFilter, setOutreachStatusFilter] = useState("");
  const [outreachAssignedFilter, setOutreachAssignedFilter] = useState("");
  const [outreachExpandedId, setOutreachExpandedId] = useState<string | null>(null);
  const [outreachDraft, setOutreachDraft] = useState({
    status: "not_contacted",
    notes: "",
    follow_up_stage: "",
    messages_sent: 0,
    assigned_to: "",
  });
  const [outreachSaving, setOutreachSaving] = useState(false);
  const [newVaLeadOpen, setNewVaLeadOpen] = useState(false);
  const [newVaLeadForm, setNewVaLeadForm] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
    platform: "",
    listing_link: "",
    status: "not_contacted",
    follow_up_stage: "",
    notes: "",
    assigned_to: "",
    messages_sent: 0,
  });
  const [newVaLeadSaving, setNewVaLeadSaving] = useState(false);

  const [vaReports, setVaReports] = useState<VaDailyReportRow[]>([]);
  const [vaReportsWeekly, setVaReportsWeekly] = useState({
    leadsFound: 0,
    contactsMade: 0,
    replies: 0,
    meetingsBooked: 0,
  });
  const [vaReportsWeekRange, setVaReportsWeekRange] = useState({ start: "", end: "" });
  const [vaReportsLoading, setVaReportsLoading] = useState(false);
  const [vaReportsError, setVaReportsError] = useState("");
  const [submitReportOpen, setSubmitReportOpen] = useState(false);
  const [submitReportForm, setSubmitReportForm] = useState({
    va_name: "",
    report_date: new Date().toISOString().slice(0, 10),
    leads_found: 0,
    contacts_made: 0,
    replies: 0,
    meetings_booked: 0,
  });
  const [submitReportSaving, setSubmitReportSaving] = useState(false);

  const [profileReportsRows, setProfileReportsRows] = useState<ProfileReportRow[]>([]);
  const [profileReportsLoading, setProfileReportsLoading] = useState(false);
  const [profileReportsError, setProfileReportsError] = useState("");
  const [profileReportBusyId, setProfileReportBusyId] = useState<string | null>(null);

  const [credentialsRows, setCredentialsRows] = useState<AdminCredentialRow[]>([]);
  const [credentialsTotal, setCredentialsTotal] = useState(0);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsError, setCredentialsError] = useState("");
  const [credentialPwdVisible, setCredentialPwdVisible] = useState<Record<string, boolean>>({});
  const [newCredentialOpen, setNewCredentialOpen] = useState(false);
  const [newCredentialForm, setNewCredentialForm] = useState({
    service_name: "",
    username: "",
    password_plain: "",
    monthly_cost: "",
    notes: "",
  });
  const [newCredentialSaving, setNewCredentialSaving] = useState(false);
  const [editCredentialId, setEditCredentialId] = useState<string | null>(null);
  const [editCredentialForm, setEditCredentialForm] = useState({
    service_name: "",
    username: "",
    password_plain: "",
    monthly_cost: "",
    notes: "",
  });
  const [credentialSaving, setCredentialSaving] = useState(false);

  const [teamAccess, setTeamAccess] = useState<{
    loading: boolean;
    role: "owner" | "co_founder" | "va_admin" | null;
  }>({ loading: true, role: null });

  useEffect(() => {
    if (!user?.email || !isAdminPanelRole(profile?.role)) {
      setTeamAccess({ loading: false, role: null });
      return;
    }
    const email = user.email.trim().toLowerCase();
    if (email === CREDENTIALS_SUPER_ADMIN_EMAIL) {
      setTeamAccess({ loading: false, role: null });
      return;
    }
    setTeamAccess((prev) => ({ ...prev, loading: true }));
    void supabase
      .from("team_members")
      .select("role")
      .eq("email", email)
      .maybeSingle()
      .then(({ data }) => {
        const r = data?.role as "owner" | "co_founder" | "va_admin" | undefined;
        setTeamAccess({ loading: false, role: r ?? null });
      });
  }, [user?.email, profile?.role, supabase]);

  /** full = credentials + manual; cofounder = all but those; va = outreach + VA reports + hiring only */
  const isOpsAdminUser = profile?.role === "ops_admin";

  const adminNavKind = useMemo(() => {
    const email = (user?.email ?? "").trim().toLowerCase();
    if (email === CREDENTIALS_SUPER_ADMIN_EMAIL) return "full" as const;
    if (profile?.role === "ops_admin") return "cofounder" as const;
    if (teamAccess.loading) return "cofounder" as const;
    if (teamAccess.role === "owner") return "full" as const;
    if (teamAccess.role === "va_admin") return "va" as const;
    return "cofounder" as const;
  }, [user?.email, profile?.role, teamAccess.loading, teamAccess.role]);

  const canSeeCredentials = adminNavKind === "full" && isFullAdminRole(profile?.role);
  const canSeeManual = adminNavKind === "full" && isFullAdminRole(profile?.role);

  const isAdminSectionVisible = useCallback(
    (section: typeof adminSection): boolean => {
      if (isOpsAdminUser) {
        if (
          section === "credentials" ||
          section === "manual" ||
          section === "vaReports" ||
          section === "hiring"
        ) {
          return false;
        }
        return true;
      }
      if (adminNavKind === "full") return true;
      if (adminNavKind === "va") {
        return section === "outreach" || section === "vaReports" || section === "hiring";
      }
      return section !== "credentials" && section !== "manual";
    },
    [adminNavKind, isOpsAdminUser],
  );

  const canSeeTeamTab = isOpsAdminUser || adminNavKind !== "va";

  useEffect(() => {
    if (!isOpsAdminUser) return;
    if (["credentials", "manual", "vaReports", "hiring"].includes(adminSection)) {
      setAdminSection("leads");
    }
  }, [isOpsAdminUser, adminSection]);

  const [teamMembersRows, setTeamMembersRows] = useState<TeamMemberRow[]>([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [teamMemberModalOpen, setTeamMemberModalOpen] = useState(false);
  const [teamMemberSaving, setTeamMemberSaving] = useState(false);
  const [newTeamMember, setNewTeamMember] = useState({
    name: "",
    email: "",
    role: "co_founder" as TeamMemberRow["role"],
  });

  const fetchTeamMembers = useCallback(async () => {
    setTeamMembersLoading(true);
    try {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, created_at, name, email, role, created_by")
        .order("created_at", { ascending: false });
      if (error) {
        toast.error(error.message);
        setTeamMembersRows([]);
        return;
      }
      setTeamMembersRows((data ?? []) as TeamMemberRow[]);
    } finally {
      setTeamMembersLoading(false);
    }
  }, [supabase]);

  const submitTeamMember = async () => {
    const name = newTeamMember.name.trim();
    const email = newTeamMember.email.trim().toLowerCase();
    if (!name || !email) {
      toast.error("Name and email are required.");
      return;
    }
    setTeamMemberSaving(true);
    try {
      const { error } = await supabase.from("team_members").insert({
        name,
        email,
        role: newTeamMember.role,
        created_by: user?.id ?? null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Team member added.");
      setTeamMemberModalOpen(false);
      setNewTeamMember({ name: "", email: "", role: "co_founder" });
      await fetchTeamMembers();
    } finally {
      setTeamMemberSaving(false);
    }
  };

  const deleteTeamMember = async (id: string) => {
    if (!confirm("Remove this team member?")) return;
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removed.");
    await fetchTeamMembers();
  };

  function teamRoleLabel(role: TeamMemberRow["role"]): string {
    if (role === "co_founder") return "Co-Founder";
    if (role === "va_admin") return "VA Admin";
    return "Owner";
  }

  const [manageAgentsProperty, setManageAgentsProperty] = useState<Property | null>(null);
  const [manageAgentsConnected, setManageAgentsConnected] = useState<PropertyConnectedAgent[]>([]);
  const [manageAgentsAvailable, setManageAgentsAvailable] = useState<PropertyAgentOption[]>([]);
  const [manageAgentsLoading, setManageAgentsLoading] = useState(false);
  const [manageAgentsError, setManageAgentsError] = useState("");
  const [selectedAgentToAdd, setSelectedAgentToAdd] = useState("");
  const [manageAgentsMutating, setManageAgentsMutating] = useState(false);

  const documentQueueAgents = useMemo(() => {
    return allAgentsList.filter(
      (a) =>
        a.status === "approved" &&
        (a.verification_status === "pending" || a.verification_status === "rejected"),
    );
  }, [allAgentsList]);

  const hiringStats = useMemo(() => {
    const total = applicants.length;
    const interviewed = applicants.filter((a) => a.status === "Interviewed").length;
    const hired = applicants.filter((a) => a.status === "Hired").length;
    return { total, interviewed, hired };
  }, [applicants]);

  const [resetPasswordAgent, setResetPasswordAgent] = useState<AllAgentRow | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordSaving, setResetPasswordSaving] = useState(false);

  const profileReportsThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return profileReportsRows.filter((r) => new Date(r.created_at).getTime() >= weekAgo).length;
  }, [profileReportsRows]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/leads", { credentials: "include" });
      const json = (await res.json()) as {
        success?: boolean;
        data?: Lead[];
      };
      if (json.success && Array.isArray(json.data)) setLeads(json.data);
      else setLeads([]);
    } catch {
      setLeads([]);
    }
    setLoading(false);
  };

  const fetchProperties = async () => {
    setPropertiesLoading(true);
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setPropertyError(error.message);
      setProperties([]);
    } else {
      setPropertyError("");
      setProperties((data as Property[]) ?? []);
    }
    setPropertiesLoading(false);
  };

  const fetchVerification = async () => {
    setVerificationLoading(true);
    setVerificationError("");
    const path = "/api/admin/verification";
    const absoluteUrl =
      typeof window !== "undefined"
        ? new URL(path, window.location.origin).href
        : path;
    const requestInit: RequestInit = {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    };
    console.log("[admin verification] fetch URL:", absoluteUrl);
    console.log("[admin verification] request headers:", {
      ...Object.fromEntries(new Headers(requestInit.headers).entries()),
      credentials: requestInit.credentials ?? "same-origin",
    });
    try {
      const res = await fetch(path, requestInit);
      const rawText = await res.text();
      let body: unknown = rawText;
      try {
        body = rawText ? JSON.parse(rawText) : null;
      } catch {
        /* non-JSON body */
      }
      type VerificationJson = {
        success?: boolean;
        data?: { brokers: PendingBroker[]; agents: PendingAgent[] };
        error?: { code?: string; message?: string; details?: unknown };
      };
      const json = body as VerificationJson;

      if (!res.ok) {
        console.error("[admin verification] error response:", {
          status: res.status,
          statusText: res.statusText,
          body,
        });
        setVerificationError(
          formatVerificationErrorDetails(res.status, res.statusText, body),
        );
        setPendingBrokers([]);
        setPendingAgents([]);
        return;
      }
      if (!json.success || !json.data) {
        console.error("[admin verification] error response:", {
          status: res.status,
          statusText: res.statusText,
          body,
        });
        setVerificationError(
          formatVerificationErrorDetails(res.status, res.statusText, body),
        );
        setPendingBrokers([]);
        setPendingAgents([]);
        return;
      }
      // Ensure any prior error is cleared on success.
      setVerificationError("");
      setPendingBrokers(json.data.brokers ?? []);
      setPendingAgents(json.data.agents ?? []);
    } catch (e) {
      console.error("[admin verification] fetch threw:", e);
      const msg =
        e instanceof Error
          ? `${e.name}: ${e.message}${e.stack ? `\n\n${e.stack}` : ""}`
          : String(e);
      setVerificationError(msg);
      setPendingBrokers([]);
      setPendingAgents([]);
    } finally {
      setVerificationLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const rawText = await res.text();
      let body: unknown = rawText;
      try {
        body = rawText ? JSON.parse(rawText) : null;
      } catch {
        /* non-JSON */
      }
      const json = body as { success?: boolean; data?: AdminUserRow[]; error?: { message?: string } };
      if (!res.ok) {
        setUsersError(json?.error?.message ?? `HTTP ${res.status}`);
        setAdminUsers([]);
        return;
      }
      if (json.success && Array.isArray(json.data)) setAdminUsers(json.data);
      else setAdminUsers([]);
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : "Failed to load users");
      setAdminUsers([]);
    }
    setUsersLoading(false);
  };

  const fetchAllAgents = async () => {
    setAllAgentsLoading(true);
    try {
      const res = await fetch("/api/admin/agents", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: AllAgentRow[];
      };
      if (json.success && Array.isArray(json.data)) setAllAgentsList(json.data);
      else setAllAgentsList([]);
    } catch {
      setAllAgentsList([]);
    }
    setAllAgentsLoading(false);
  };

  const fetchCoAgentRequests = async () => {
    setCoAgentLoading(true);
    setCoAgentError("");
    try {
      const res = await fetch("/api/admin/co-agent-requests", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: CoAgentRequestRow[];
        error?: { message?: string };
      };
      if (!res.ok) {
        setCoAgentError(json?.error?.message ?? `HTTP ${res.status}`);
        setCoAgentRequests([]);
        return;
      }
      if (json.success && Array.isArray(json.data)) setCoAgentRequests(json.data);
      else setCoAgentRequests([]);
    } catch (e) {
      setCoAgentError(e instanceof Error ? e.message : "Failed to load");
      setCoAgentRequests([]);
    }
    setCoAgentLoading(false);
  };

  const fetchApplicants = async () => {
    setApplicantsLoading(true);
    setApplicantsError("");
    try {
      const res = await fetch("/api/admin/applicants", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: ApplicantRow[];
        error?: { message?: string };
      };
      if (!res.ok) {
        setApplicantsError(json?.error?.message ?? `HTTP ${res.status}`);
        setApplicants([]);
        return;
      }
      if (json.success && Array.isArray(json.data)) setApplicants(json.data);
      else setApplicants([]);
    } catch (e) {
      setApplicantsError(e instanceof Error ? e.message : "Failed to load applicants");
      setApplicants([]);
    }
    setApplicantsLoading(false);
  };

  const submitNewApplicant = async () => {
    const age = Number.parseInt(String(newApplicantForm.age).trim(), 10);
    if (!newApplicantForm.first_name.trim() || !newApplicantForm.last_name.trim()) {
      toast.error("First and last name are required");
      return;
    }
    if (!Number.isFinite(age) || age < 0 || age > 120) {
      toast.error("Enter a valid age (0–120)");
      return;
    }
    const email = newApplicantForm.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email");
      return;
    }
    setAddApplicantSaving(true);
    try {
      const res = await fetch("/api/admin/applicants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          first_name: newApplicantForm.first_name.trim(),
          last_name: newApplicantForm.last_name.trim(),
          age,
          email,
          notes: newApplicantForm.notes.trim() || null,
          status: newApplicantForm.status,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok) {
        toast.error(json.error?.message ?? "Could not add applicant");
        return;
      }
      toast.success("Applicant added");
      setAddApplicantOpen(false);
      setNewApplicantForm({
        first_name: "",
        last_name: "",
        age: "",
        email: "",
        notes: "",
        status: "New",
      });
      void fetchApplicants();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add applicant");
    } finally {
      setAddApplicantSaving(false);
    }
  };

  const startEditApplicant = (a: ApplicantRow) => {
    setEditingApplicantId(a.id);
    setEditApplicantDraft({ status: a.status, notes: a.notes ?? "" });
  };

  const cancelEditApplicant = () => {
    setEditingApplicantId(null);
  };

  const saveEditApplicant = async () => {
    if (!editingApplicantId) return;
    setEditApplicantSaving(true);
    try {
      const res = await fetch(`/api/admin/applicants/${editingApplicantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: editApplicantDraft.status,
          notes: editApplicantDraft.notes.trim() ? editApplicantDraft.notes.trim() : null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok) {
        toast.error(json.error?.message ?? "Update failed");
        return;
      }
      toast.success("Applicant updated");
      setEditingApplicantId(null);
      void fetchApplicants();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setEditApplicantSaving(false);
    }
  };

  const fetchVaLeads = async () => {
    setVaLeadsLoading(true);
    setVaLeadsError("");
    try {
      const params = new URLSearchParams();
      if (outreachSearch.trim()) params.set("search", outreachSearch.trim());
      if (outreachStatusFilter) params.set("status", outreachStatusFilter);
      if (outreachAssignedFilter) params.set("assigned_to", outreachAssignedFilter);
      const res = await fetch(`/api/admin/va-leads?${params.toString()}`, { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: {
          stats: {
            totalLeads: number;
            contactedToday: number;
            repliesToday: number;
            meetingsBookedToday: number;
          };
          leads: VaLeadRow[];
          assignOptions: string[];
        };
        error?: { message?: string };
      };
      if (!res.ok) {
        setVaLeadsError(json.error?.message ?? `HTTP ${res.status}`);
        setVaLeads([]);
        return;
      }
      if (json.success && json.data) {
        setVaLeadsStats(json.data.stats);
        setVaLeads(json.data.leads);
        setVaLeadsAssignOptions(json.data.assignOptions);
      } else {
        setVaLeads([]);
      }
    } catch (e) {
      setVaLeadsError(e instanceof Error ? e.message : "Failed to load");
      setVaLeads([]);
    } finally {
      setVaLeadsLoading(false);
    }
  };

  const openOutreachEdit = (row: VaLeadRow) => {
    setOutreachExpandedId(row.id);
    setOutreachDraft({
      status: row.status,
      notes: row.notes ?? "",
      follow_up_stage: row.follow_up_stage ?? "",
      messages_sent: row.messages_sent ?? 0,
      assigned_to: row.assigned_to ?? "",
    });
  };

  const saveOutreachEdit = async (id: string) => {
    setOutreachSaving(true);
    try {
      const res = await fetch(`/api/admin/va-leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: outreachDraft.status,
          notes: outreachDraft.notes.trim() ? outreachDraft.notes.trim() : null,
          follow_up_stage: outreachDraft.follow_up_stage.trim() || null,
          messages_sent: outreachDraft.messages_sent,
          assigned_to: outreachDraft.assigned_to.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok) {
        toast.error(json.error?.message ?? "Update failed");
        return;
      }
      toast.success("Lead updated");
      setOutreachExpandedId(null);
      void fetchVaLeads();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setOutreachSaving(false);
    }
  };

  const submitNewVaLead = async () => {
    if (!newVaLeadForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setNewVaLeadSaving(true);
    try {
      const res = await fetch("/api/admin/va-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newVaLeadForm.name.trim(),
          role: newVaLeadForm.role.trim() || null,
          phone: newVaLeadForm.phone.trim() || null,
          email: newVaLeadForm.email.trim() || null,
          platform: newVaLeadForm.platform.trim() || null,
          listing_link: newVaLeadForm.listing_link.trim() || null,
          status: newVaLeadForm.status,
          follow_up_stage: newVaLeadForm.follow_up_stage.trim() || null,
          notes: newVaLeadForm.notes.trim() || null,
          assigned_to: newVaLeadForm.assigned_to.trim() || null,
          messages_sent: newVaLeadForm.messages_sent,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok) {
        toast.error(json.error?.message ?? "Could not add lead");
        return;
      }
      toast.success("Lead added");
      setNewVaLeadOpen(false);
      setNewVaLeadForm({
        name: "",
        role: "",
        phone: "",
        email: "",
        platform: "",
        listing_link: "",
        status: "not_contacted",
        follow_up_stage: "",
        notes: "",
        assigned_to: "",
        messages_sent: 0,
      });
      void fetchVaLeads();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add lead");
    } finally {
      setNewVaLeadSaving(false);
    }
  };

  const fetchVaReports = async () => {
    setVaReportsLoading(true);
    setVaReportsError("");
    try {
      const res = await fetch("/api/admin/va-reports", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: {
          weeklyTotals: {
            leadsFound: number;
            contactsMade: number;
            replies: number;
            meetingsBooked: number;
          };
          weekRange: { start: string; end: string };
          reports: VaDailyReportRow[];
        };
        error?: { message?: string };
      };
      if (!res.ok) {
        setVaReportsError(json.error?.message ?? `HTTP ${res.status}`);
        setVaReports([]);
        return;
      }
      if (json.success && json.data) {
        setVaReportsWeekly(json.data.weeklyTotals);
        setVaReportsWeekRange(json.data.weekRange);
        setVaReports(json.data.reports);
      }
    } catch (e) {
      setVaReportsError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setVaReportsLoading(false);
    }
  };

  const submitVaReport = async () => {
    if (!submitReportForm.va_name.trim()) {
      toast.error("VA name is required");
      return;
    }
    setSubmitReportSaving(true);
    try {
      const res = await fetch("/api/admin/va-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(submitReportForm),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok) {
        toast.error(json.error?.message ?? "Submit failed");
        return;
      }
      toast.success("Report submitted");
      setSubmitReportOpen(false);
      void fetchVaReports();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitReportSaving(false);
    }
  };

  const fetchProfileReports = async () => {
    setProfileReportsLoading(true);
    setProfileReportsError("");
    try {
      const res = await fetch("/api/admin/user-profile-reports", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: ProfileReportRow[];
        error?: { message?: string };
      };
      if (!res.ok) {
        setProfileReportsError(json.error?.message ?? `HTTP ${res.status}`);
        setProfileReportsRows([]);
        return;
      }
      if (json.success && Array.isArray(json.data)) setProfileReportsRows(json.data);
      else setProfileReportsRows([]);
    } catch (e) {
      setProfileReportsError(e instanceof Error ? e.message : "Failed to load reports");
      setProfileReportsRows([]);
    } finally {
      setProfileReportsLoading(false);
    }
  };

  const dismissProfileReport = async (id: string) => {
    setProfileReportBusyId(id);
    try {
      const res = await fetch(`/api/admin/user-profile-reports?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok) {
        toast.error(json.error?.message ?? "Could not dismiss");
        return;
      }
      toast.success("Report dismissed");
      setProfileReportsRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not dismiss");
    } finally {
      setProfileReportBusyId(null);
    }
  };

  const warnReportedUser = async (row: ProfileReportRow) => {
    setProfileReportBusyId(row.id);
    try {
      const res = await fetch("/api/admin/user-profile-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reportedUserId: row.reported_user_id,
          reportId: row.id,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok) {
        toast.error(json.error?.message ?? "Could not send warning");
        return;
      }
      toast.success("Warning sent to user");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send warning");
    } finally {
      setProfileReportBusyId(null);
    }
  };

  const fetchCredentials = async () => {
    if (!canSeeCredentials) return;
    setCredentialsLoading(true);
    setCredentialsError("");
    try {
      const res = await fetch("/api/admin/admin-credentials", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { rows: AdminCredentialRow[]; totalMonthly: number };
        error?: { message?: string };
      };
      if (!res.ok) {
        setCredentialsError(json.error?.message ?? `HTTP ${res.status}`);
        setCredentialsRows([]);
        return;
      }
      if (json.success && json.data) {
        setCredentialsRows(json.data.rows);
        setCredentialsTotal(json.data.totalMonthly);
      }
    } catch (e) {
      setCredentialsError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setCredentialsLoading(false);
    }
  };

  const saveCredentialEdit = async () => {
    if (!editCredentialId) return;
    setCredentialSaving(true);
    try {
      const res = await fetch(`/api/admin/admin-credentials/${editCredentialId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          service_name: editCredentialForm.service_name.trim(),
          username: editCredentialForm.username,
          password_plain: editCredentialForm.password_plain,
          monthly_cost: parseFloat(editCredentialForm.monthly_cost) || 0,
          notes: editCredentialForm.notes.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok) {
        toast.error(json.error?.message ?? "Save failed");
        return;
      }
      toast.success("Saved");
      setEditCredentialId(null);
      void fetchCredentials();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setCredentialSaving(false);
    }
  };

  const deleteCredential = async (id: string) => {
    if (!confirm("Delete this credential row?")) return;
    const res = await fetch(`/api/admin/admin-credentials/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      toast.error(j.error?.message ?? "Delete failed");
      return;
    }
    toast.success("Deleted");
    void fetchCredentials();
  };

  const submitNewCredential = async () => {
    if (!newCredentialForm.service_name.trim()) {
      toast.error("Service name is required");
      return;
    }
    setNewCredentialSaving(true);
    try {
      const res = await fetch("/api/admin/admin-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          service_name: newCredentialForm.service_name.trim(),
          username: newCredentialForm.username,
          password_plain: newCredentialForm.password_plain,
          monthly_cost: parseFloat(newCredentialForm.monthly_cost) || 0,
          notes: newCredentialForm.notes.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok) {
        toast.error(json.error?.message ?? "Could not add");
        return;
      }
      toast.success("Credential added");
      setNewCredentialOpen(false);
      setNewCredentialForm({
        service_name: "",
        username: "",
        password_plain: "",
        monthly_cost: "",
        notes: "",
      });
      void fetchCredentials();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add");
    } finally {
      setNewCredentialSaving(false);
    }
  };

  const decideCoAgentRequest = async (id: string, decision: "approve" | "reject") => {
    const res = await fetch(`/api/admin/co-agent-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      alert(j?.error?.message ?? "Action failed");
      return;
    }
    void fetchCoAgentRequests();
  };

  const updateUserRole = async (id: string, role: string) => {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role }),
    });
    void fetchUsers();
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Delete this user and all related data? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      alert(j?.error?.message ?? "Delete failed");
      return;
    }
    void fetchUsers();
  };

  const deleteAgentRow = async (id: string) => {
    if (!confirm("Remove this agent registration from the database?")) return;
    const res = await fetch(`/api/admin/agents/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      alert("Could not delete agent");
      return;
    }
    void fetchAllAgents();
    void fetchVerification();
  };

  const openEditAgent = (a: AllAgentRow) => {
    setEditError("");
    setEditAgent(a);
    setEditForm({
      name: a.name,
      email: a.email,
      phone: a.phone ?? "",
      license_number: a.license_number,
      score: String(a.score ?? 0),
      closings: String(a.closings ?? 0),
      status: a.status,
      broker_id: a.broker_id ?? "",
    });
  };

  const saveEditAgent = async () => {
    if (!editAgent) return;
    const score = Number(editForm.score);
    if (!Number.isFinite(score)) {
      setEditError("Score must be a valid number");
      return;
    }
    const closings = Number.parseInt(String(editForm.closings), 10);
    if (!Number.isFinite(closings) || closings < 0) {
      setEditError("Closings must be a non-negative integer");
      return;
    }
    const brokerTrim = editForm.broker_id.trim();
    if (
      brokerTrim &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(brokerTrim)
    ) {
      setEditError("Broker ID must be a valid UUID or empty");
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/admin/agents/${editAgent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim() ? editForm.phone.trim() : null,
          license_number: editForm.license_number.trim(),
          score,
          closings,
          status: editForm.status,
          broker_id: brokerTrim || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok) {
        setEditError(json.error?.message ?? `Save failed (${res.status})`);
        return;
      }
      setEditAgent(null);
      void fetchAllAgents();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setEditSaving(false);
    }
  };

  const approveBroker = async (id: string) => {
    setRejectOpen(null);
    await fetch(`/api/admin/verification/brokers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ decision: "approve" }),
    });
    void fetchVerification();
  };

  const approveAgent = async (id: string) => {
    setRejectOpen(null);
    await fetch(`/api/admin/verification/agents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ decision: "approve" }),
    });
    void fetchVerification();
  };

  const submitRejectBroker = async () => {
    if (!rejectOpen || rejectOpen.kind !== "broker") return;
    const reason = rejectReason.trim();
    if (!reason) return;
    await fetch(`/api/admin/verification/brokers/${rejectOpen.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ decision: "reject", reason }),
    });
    setRejectOpen(null);
    setRejectReason("");
    void fetchVerification();
  };

  const submitRejectAgent = async () => {
    if (!rejectOpen || rejectOpen.kind !== "agent") return;
    const reason = rejectReason.trim();
    if (!reason) return;
    await fetch(`/api/admin/verification/agents/${rejectOpen.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ decision: "reject", reason }),
    });
    setRejectOpen(null);
    setRejectReason("");
    void fetchVerification();
  };

  const openDocReviewModal = async (agent: AllAgentRow) => {
    setDocReviewAgent(agent);
    setDocReviewUrls(null);
    setDocRejectReasonKey("");
    setDocRejectOtherText("");
    setDocSuspendReasonKey("");
    setDocSuspendOtherText("");
    setDocReviewLoading(true);
    try {
      const res = await fetch(`/api/admin/agents/${agent.id}/verification-review`, {
        credentials: "include",
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: {
          license_number: string;
          prc_signed_url: string | null;
          selfie_signed_url: string | null;
          has_documents: boolean;
        };
        error?: { message?: string };
      };
      if (!res.ok || !json.success || !json.data) {
        toast.error(json.error?.message ?? "Could not load documents");
        setDocReviewAgent(null);
        return;
      }
      setDocReviewUrls(json.data);
    } catch {
      toast.error("Could not load documents");
      setDocReviewAgent(null);
    } finally {
      setDocReviewLoading(false);
    }
  };

  const closeDocReviewModal = () => {
    setDocReviewAgent(null);
    setDocReviewUrls(null);
    setDocRejectReasonKey("");
    setDocRejectOtherText("");
    setDocSuspendReasonKey("");
    setDocSuspendOtherText("");
    setDocActionSaving(false);
  };

  const submitDocReviewDecision = async (decision: "approve" | "reject" | "suspend") => {
    if (!docReviewAgent) return;
    let payload: { decision: "approve" } | { decision: "reject"; reason: string } | { decision: "suspend"; reason: string };
    if (decision === "approve") {
      payload = { decision: "approve" };
    } else if (decision === "reject") {
      if (!docRejectReasonKey) {
        toast.error("Select a rejection reason.");
        return;
      }
      if (docRejectReasonKey === "Other" && !docRejectOtherText.trim()) {
        toast.error("Enter a custom rejection reason.");
        return;
      }
      const reason =
        docRejectReasonKey === "Other" ? docRejectOtherText.trim() : docRejectReasonKey;
      payload = { decision: "reject", reason };
    } else {
      if (!docSuspendReasonKey) {
        toast.error("Select a suspension reason.");
        return;
      }
      if (docSuspendReasonKey === "Other" && !docSuspendOtherText.trim()) {
        toast.error("Enter a custom suspension reason.");
        return;
      }
      const reason =
        docSuspendReasonKey === "Other" ? docSuspendOtherText.trim() : docSuspendReasonKey;
      payload = { decision: "suspend", reason };
    }
    setDocActionSaving(true);
    try {
      const res = await fetch(`/api/admin/agents/${docReviewAgent.id}/verification-review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { success?: boolean; error?: { message?: string } };
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? "Update failed");
        return;
      }
      toast.success(
        decision === "approve"
          ? "Identity verification updated."
          : decision === "reject"
            ? "Verification rejected."
            : "Account suspended.",
      );
      closeDocReviewModal();
      void fetchAllAgents();
      void fetchVerification();
    } catch {
      toast.error("Update failed");
    } finally {
      setDocActionSaving(false);
    }
  };

  const leadStage = (l: Lead) => l.stage ?? l.status ?? "new";

  const signOutAdmin = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/signout";
  };

  const updateLeadStage = async (id: string | number, stage: string) => {
    await fetch(`/api/v1/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ stage }),
    });
    fetchLeads();
  };

  useEffect(() => {
    // Note: avoid calling setState synchronously in effect body (lint rule).
    // Queue the initial loads as microtasks once admin session is present.
    if (user?.id && isAdminPanelRole(profile?.role)) {
      queueMicrotask(() => {
        fetchLeads();
        fetchProperties();
        void fetchVerification();
        void fetchAllAgents();
        void fetchCoAgentRequests();
        if (isFullAdminRole(profile?.role)) void fetchApplicants();
        void fetchProfileReports();
      });
    }
  }, [user?.id, profile?.role]);

  useEffect(() => {
    if (user?.id && isAdminPanelRole(profile?.role) && adminSection === "users") {
      void fetchUsers();
    }
  }, [user?.id, profile?.role, adminSection]);

  useEffect(() => {
    if (user?.id && isAdminPanelRole(profile?.role) && adminSection === "coagent") {
      void fetchCoAgentRequests();
    }
  }, [user?.id, profile?.role, adminSection]);

  useEffect(() => {
    if (user?.id && isAdminPanelRole(profile?.role) && adminSection === "agents") {
      void fetchAllAgents();
    }
  }, [user?.id, profile?.role, adminSection]);

  useEffect(() => {
    if (user?.id && isFullAdminRole(profile?.role) && adminSection === "hiring") {
      void fetchApplicants();
    }
  }, [user?.id, profile?.role, adminSection]);

  useEffect(() => {
    if (user?.id && isAdminPanelRole(profile?.role) && adminSection === "outreach") {
      const t = setTimeout(() => void fetchVaLeads(), 350);
      return () => clearTimeout(t);
    }
  }, [
    user?.id,
    profile?.role,
    adminSection,
    outreachSearch,
    outreachStatusFilter,
    outreachAssignedFilter,
  ]);

  useEffect(() => {
    if (user?.id && isFullAdminRole(profile?.role) && adminSection === "vaReports") {
      void fetchVaReports();
    }
  }, [user?.id, profile?.role, adminSection]);

  useEffect(() => {
    if (user?.id && isAdminPanelRole(profile?.role) && adminSection === "profileReports") {
      void fetchProfileReports();
    }
  }, [user?.id, profile?.role, adminSection]);

  useEffect(() => {
    if (
      user?.id &&
      isAdminPanelRole(profile?.role) &&
      adminSection === "credentials" &&
      canSeeCredentials
    ) {
      void fetchCredentials();
    }
  }, [user?.id, profile?.role, adminSection, canSeeCredentials]);

  useEffect(() => {
    if (adminSection === "credentials" && isAdminPanelRole(profile?.role) && user?.email && !canSeeCredentials) {
      setAdminSection("leads");
    }
  }, [adminSection, canSeeCredentials, profile?.role, user?.email]);

  useEffect(() => {
    if (adminSection === "manual" && isAdminPanelRole(profile?.role) && user?.email && !canSeeManual) {
      setAdminSection("leads");
    }
  }, [adminSection, canSeeManual, profile?.role, user?.email]);

  useEffect(() => {
    if (adminSection === "teamMembers" && isAdminPanelRole(profile?.role) && user?.email && !canSeeTeamTab) {
      setAdminSection("leads");
    }
  }, [adminSection, canSeeTeamTab, profile?.role, user?.email]);

  useEffect(() => {
    if (!isAdminPanelRole(profile?.role) || !user?.email) return;
    if (adminNavKind !== "va") return;
    if (!["outreach", "vaReports", "hiring"].includes(adminSection)) {
      setAdminSection("outreach");
    }
  }, [adminNavKind, adminSection, profile?.role, user?.email]);

  useEffect(() => {
    if (user?.id && isAdminPanelRole(profile?.role) && adminSection === "teamMembers" && canSeeTeamTab) {
      void fetchTeamMembers();
    }
  }, [user?.id, profile?.role, adminSection, canSeeTeamTab, fetchTeamMembers]);

  const filteredLeads =
    filter === "all"
      ? leads
      : filter === "closed"
        ? leads.filter((l) => {
            const s = leadStage(l);
            return (
              s === "closed_won" ||
              s === "closed_lost" ||
              s === "closed"
            );
          })
        : leads.filter((l) => leadStage(l) === filter);

  const openNewProperty = () => {
    setEditingId(null);
    setPropertyForm(emptyPropertyForm);
    setSkipDuplicateCheck(false);
    setPropertyError("");
  };

  const loadManageAgentsData = async (propertyId: string) => {
    setManageAgentsLoading(true);
    setManageAgentsError("");
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}/agents`, { credentials: "include" });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { connected: PropertyConnectedAgent[]; availableToAdd: PropertyAgentOption[] };
        error?: { message?: string };
      };
      if (!res.ok || !json.success || !json.data) {
        setManageAgentsError(json.error?.message ?? "Failed to load property agents");
        setManageAgentsConnected([]);
        setManageAgentsAvailable([]);
        return;
      }
      setManageAgentsConnected(json.data.connected);
      setManageAgentsAvailable(json.data.availableToAdd);
    } catch {
      setManageAgentsError("Failed to load property agents");
      setManageAgentsConnected([]);
      setManageAgentsAvailable([]);
    } finally {
      setManageAgentsLoading(false);
    }
  };

  const openManageAgents = (p: Property) => {
    setManageAgentsProperty(p);
    setSelectedAgentToAdd("");
    void loadManageAgentsData(p.id);
  };

  const closeManageAgents = () => {
    setManageAgentsProperty(null);
    setManageAgentsError("");
    setSelectedAgentToAdd("");
  };

  const addPropertyAgent = async () => {
    if (!manageAgentsProperty || !selectedAgentToAdd) return;
    setManageAgentsMutating(true);
    try {
      const res = await fetch(`/api/admin/properties/${manageAgentsProperty.id}/agents`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: selectedAgentToAdd }),
      });
      const json = (await res.json()) as { success?: boolean; error?: { message?: string } };
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? "Could not add agent");
        return;
      }
      toast.success("Agent added to property");
      setSelectedAgentToAdd("");
      await loadManageAgentsData(manageAgentsProperty.id);
    } finally {
      setManageAgentsMutating(false);
    }
  };

  const removePropertyAgent = async (agentId: string) => {
    if (!manageAgentsProperty) return;
    setManageAgentsMutating(true);
    try {
      const res = await fetch(
        `/api/admin/properties/${manageAgentsProperty.id}/agents?agent_id=${encodeURIComponent(agentId)}`,
        { method: "DELETE", credentials: "include" },
      );
      const json = (await res.json()) as { success?: boolean; error?: { message?: string } };
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? "Could not remove agent");
        return;
      }
      toast.success("Agent removed from property");
      await loadManageAgentsData(manageAgentsProperty.id);
    } finally {
      setManageAgentsMutating(false);
    }
  };

  const submitResetPassword = async () => {
    if (!resetPasswordAgent) return;
    if (resetPasswordValue.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setResetPasswordSaving(true);
    try {
      const res = await fetch(`/api/admin/agents/${resetPasswordAgent.id}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPasswordValue }),
      });
      const json = (await res.json()) as { success?: boolean; error?: { message?: string } };
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? "Could not reset password");
        return;
      }
      toast.success("Password updated");
      setResetPasswordAgent(null);
      setResetPasswordValue("");
    } finally {
      setResetPasswordSaving(false);
    }
  };

  const openEditProperty = (p: Property) => {
    setEditingId(p.id);
    const av = p.availability_state;
    const availability_state =
      av === "reserved" || av === "closed" || av === "removed" || av === "available" ? av : "available";
    setPropertyForm({
      location: p.location,
      price: p.price,
      sqft: p.sqft,
      beds: String(p.beds),
      baths: String(p.baths),
      image_url: p.image_url,
      availability_state,
    });
    setPropertyError("");
  };

  const saveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setPropertySaving(true);
    setPropertyError("");

    const beds = Number(propertyForm.beds);
    const baths = Number(propertyForm.baths);
    if (
      !propertyForm.location.trim() ||
      !propertyForm.price.trim() ||
      !propertyForm.sqft.trim() ||
      !propertyForm.image_url.trim() ||
      Number.isNaN(beds) ||
      Number.isNaN(baths)
    ) {
      setPropertyError("Fill all fields with valid numbers for beds and baths.");
      setPropertySaving(false);
      return;
    }

    const payload = {
      location: propertyForm.location.trim(),
      price: propertyForm.price.trim(),
      sqft: propertyForm.sqft.trim(),
      beds,
      baths,
      image_url: propertyForm.image_url.trim(),
    };

    try {
      if (editingId) {
        const res = await fetch(`/api/admin/properties/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ...payload,
            availability_state: propertyForm.availability_state,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setPropertyError(json.error || "Update failed");
          setPropertySaving(false);
          return;
        }
      } else {
        const res = await fetch("/api/admin/properties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ...payload, skip_duplicate_check: skipDuplicateCheck }),
        });
        const json = (await res.json()) as {
          error?: string;
          duplicate?: boolean;
          existing?: { title?: string; id?: string };
        };
        if (!res.ok) {
          if (res.status === 409 && json.duplicate) {
            const title = json.existing?.title?.trim() || "an existing listing";
            setPropertyError(
              `A listing may already exist (${title}). Turn on “Skip duplicate check” below only after you confirm this is not a duplicate.`,
            );
          } else {
            setPropertyError(json.error || "Create failed");
          }
          setPropertySaving(false);
          return;
        }
      }
      setEditingId(null);
      setPropertyForm(emptyPropertyForm);
      setSkipDuplicateCheck(false);
      await fetchProperties();
    } catch (err) {
      setPropertyError(err instanceof Error ? err.message : "Request failed");
    }
    setPropertySaving(false);
  };

  const patchPropertyAvailability = async (propertyId: string, availability_state: PropertyFormAvailability) => {
    setPropertyAvailabilityPatchingId(propertyId);
    setPropertyError("");
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ availability_state }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPropertyError(json.error ?? "Could not update availability");
        return;
      }
      await fetchProperties();
    } catch (err) {
      setPropertyError(err instanceof Error ? err.message : "Could not update availability");
    } finally {
      setPropertyAvailabilityPatchingId(null);
    }
  };

  const deleteProperty = async (id: string) => {
    if (!confirm("Delete this listing permanently?")) return;
    setPropertyError("");
    try {
      const res = await fetch(`/api/admin/properties/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        setPropertyError(json.error || "Delete failed");
        return;
      }
      if (editingId === id) {
        setEditingId(null);
        setPropertyForm(emptyPropertyForm);
      }
      await fetchProperties();
    } catch (err) {
      setPropertyError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const setPropertyFeatured = async (id: string) => {
    setFeaturedSettingId(id);
    setPropertyError("");
    try {
      const res = await fetch(`/api/admin/properties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ featured: true }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPropertyError(json.error || "Could not set featured listing");
        return;
      }
      toast.success("Homepage featured listing updated");
      await fetchProperties();
    } catch (err) {
      setPropertyError(err instanceof Error ? err.message : "Could not set featured listing");
    } finally {
      setFeaturedSettingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] text-sm text-[#2C2C2C]/50">
        Loading…
      </div>
    );
  }

  if (!user || !isAdminPanelRole(profile?.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] p-6">
        <div className="max-w-sm rounded-2xl border border-[#2C2C2C]/10 bg-white p-8 text-center shadow-sm">
          <h1 className="mb-2 text-lg font-semibold text-[#2C2C2C]">Admin access</h1>
          <p className="mb-6 text-sm text-[#2C2C2C]/55">
            Sign in with an account that has the admin or operations admin role.
          </p>
          <Link
            href="/auth/login?next=/admin"
            className="inline-flex rounded-full bg-[#2C2C2C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6B9E6E]"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#eef1f6]">
      <div className="border-b border-[#2C2C2C]/10 bg-white p-4 shadow-sm md:hidden">
        <div className="mb-3 flex flex-col gap-2">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-1 text-sm text-[#6B9E6E] hover:underline"
          >
            ← Home
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="font-serif text-xl font-bold text-[#2C2C2C]">Admin</h1>
              <p className="text-xs text-[#2C2C2C]/45">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOutAdmin()}
              className="text-sm font-semibold text-[#2C2C2C]/55 underline hover:text-[#2C2C2C]"
            >
              Sign out
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdminSectionVisible("leads") ? (
          <button
            type="button"
            onClick={() => setAdminSection("leads")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              adminSection === "leads"
                ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
            }`}
          >
            Leads
          </button>
          ) : null}
          {isAdminSectionVisible("properties") ? (
          <button
            type="button"
            onClick={() => setAdminSection("properties")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              adminSection === "properties"
                ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
            }`}
          >
            Properties
            <span className="ml-1.5 rounded-full bg-white/25 px-2 py-0.5 text-xs">
              {properties.length}
            </span>
          </button>
          ) : null}
          {isAdminSectionVisible("verification") ? (
          <button
            type="button"
            onClick={() => setAdminSection("verification")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              adminSection === "verification"
                ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
            }`}
          >
            Verification
            <span className="ml-1.5 rounded-full bg-white/25 px-2 py-0.5 text-xs">
              {pendingBrokers.length + pendingAgents.length}
            </span>
          </button>
          ) : null}
          {isAdminSectionVisible("agents") ? (
          <button
            type="button"
            onClick={() => setAdminSection("agents")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              adminSection === "agents"
                ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
            }`}
          >
            Agents
            <span className="ml-1.5 rounded-full bg-white/25 px-2 py-0.5 text-xs">
              {allAgentsList.length}
            </span>
          </button>
          ) : null}
          {isAdminSectionVisible("users") ? (
          <button
            type="button"
            onClick={() => setAdminSection("users")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              adminSection === "users"
                ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
            }`}
          >
            Users
            <span className="ml-1.5 rounded-full bg-white/25 px-2 py-0.5 text-xs">
              {adminUsers.length}
            </span>
          </button>
          ) : null}
          {isAdminSectionVisible("coagent") ? (
          <button
            type="button"
            onClick={() => setAdminSection("coagent")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              adminSection === "coagent"
                ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
            }`}
          >
            Co-Agent Requests
            <span className="ml-1.5 rounded-full bg-white/25 px-2 py-0.5 text-xs">
              {coAgentRequests.length}
            </span>
          </button>
          ) : null}
          {isAdminSectionVisible("hiring") ? (
          <button
            type="button"
            onClick={() => setAdminSection("hiring")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              adminSection === "hiring"
                ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
            }`}
          >
            Hiring
            <span className="ml-1.5 rounded-full bg-white/25 px-2 py-0.5 text-xs">
              {applicants.length}
            </span>
          </button>
          ) : null}
          {canSeeTeamTab && isAdminSectionVisible("teamMembers") ? (
            <button
              type="button"
              onClick={() => setAdminSection("teamMembers")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                adminSection === "teamMembers"
                  ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                  : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
              }`}
            >
              Team
            </button>
          ) : null}
          {isAdminPanelRole(profile?.role) ? (
            <button
              type="button"
              onClick={() => setAdminSection("teamManagement")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                adminSection === "teamManagement"
                  ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                  : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
              }`}
            >
              Team Management
            </button>
          ) : null}
          {isAdminSectionVisible("outreach") ? (
          <button
            type="button"
            onClick={() => setAdminSection("outreach")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              adminSection === "outreach"
                ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
            }`}
          >
            Outreach
          </button>
          ) : null}
          {isAdminSectionVisible("profileReports") ? (
          <button
            type="button"
            onClick={() => setAdminSection("profileReports")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              adminSection === "profileReports"
                ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
            }`}
          >
            Reports
            <span className="ml-1.5 rounded-full bg-white/25 px-2 py-0.5 text-xs">
              {profileReportsRows.length}
            </span>
          </button>
          ) : null}
          {isAdminSectionVisible("vaReports") ? (
          <button
            type="button"
            onClick={() => setAdminSection("vaReports")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              adminSection === "vaReports"
                ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
            }`}
          >
            VA Reports
          </button>
          ) : null}
          {canSeeCredentials ? (
            <button
              type="button"
              onClick={() => setAdminSection("credentials")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                adminSection === "credentials"
                  ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                  : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
              }`}
            >
              Credentials
            </button>
          ) : null}
          {canSeeManual ? (
            <button
              type="button"
              onClick={() => setAdminSection("manual")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                adminSection === "manual"
                  ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                  : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
              }`}
            >
              Manual
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/5 bg-[#1e2a3a] text-white md:flex">
          <div className="border-b border-white/10 px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">BahayGo</p>
            <p className="font-serif text-lg font-bold leading-tight">Admin</p>
            <p className="mt-1 text-xs text-white/40">Lead &amp; property</p>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
            {isAdminSectionVisible("leads") ? (
            <button
              type="button"
              onClick={() => setAdminSection("leads")}
              className={`flex w-full items-center justify-between rounded-r-lg border-l-[3px] px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                adminSection === "leads"
                  ? "border-[#6B9E6E] bg-[#6B9E6E]/25 text-white"
                  : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              Leads
            </button>
            ) : null}
            {isAdminSectionVisible("properties") ? (
            <button
              type="button"
              onClick={() => setAdminSection("properties")}
              className={`flex w-full items-center justify-between rounded-r-lg border-l-[3px] px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                adminSection === "properties"
                  ? "border-[#6B9E6E] bg-[#6B9E6E]/25 text-white"
                  : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span>Properties</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold tabular-nums">
                {properties.length}
              </span>
            </button>
            ) : null}
            {isAdminSectionVisible("verification") ? (
            <button
              type="button"
              onClick={() => setAdminSection("verification")}
              className={`flex w-full items-center justify-between rounded-r-lg border-l-[3px] px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                adminSection === "verification"
                  ? "border-[#6B9E6E] bg-[#6B9E6E]/25 text-white"
                  : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span>Verification</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold tabular-nums">
                {pendingBrokers.length + pendingAgents.length}
              </span>
            </button>
            ) : null}
            {isAdminSectionVisible("agents") ? (
            <button
              type="button"
              onClick={() => setAdminSection("agents")}
              className={`flex w-full items-center justify-between rounded-r-lg border-l-[3px] px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                adminSection === "agents"
                  ? "border-[#6B9E6E] bg-[#6B9E6E]/25 text-white"
                  : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span>Agents</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold tabular-nums">
                {allAgentsList.length}
              </span>
            </button>
            ) : null}
            {isAdminSectionVisible("users") ? (
            <button
              type="button"
              onClick={() => setAdminSection("users")}
              className={`flex w-full items-center justify-between rounded-r-lg border-l-[3px] px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                adminSection === "users"
                  ? "border-[#6B9E6E] bg-[#6B9E6E]/25 text-white"
                  : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span>Users</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold tabular-nums">
                {adminUsers.length}
              </span>
            </button>
            ) : null}
            {isAdminSectionVisible("coagent") ? (
            <button
              type="button"
              onClick={() => setAdminSection("coagent")}
              className={`flex w-full items-center justify-between rounded-r-lg border-l-[3px] px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                adminSection === "coagent"
                  ? "border-[#6B9E6E] bg-[#6B9E6E]/25 text-white"
                  : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-left leading-snug">Co-Agent</span>
              <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold tabular-nums">
                {coAgentRequests.length}
              </span>
            </button>
            ) : null}
            {isAdminSectionVisible("hiring") ? (
            <button
              type="button"
              onClick={() => setAdminSection("hiring")}
              className={`flex w-full items-center justify-between rounded-r-lg border-l-[3px] px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                adminSection === "hiring"
                  ? "border-[#6B9E6E] bg-[#6B9E6E]/25 text-white"
                  : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span>Hiring</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold tabular-nums">
                {applicants.length}
              </span>
            </button>
            ) : null}
            {canSeeTeamTab && isAdminSectionVisible("teamMembers") ? (
              <button
                type="button"
                onClick={() => setAdminSection("teamMembers")}
                className={`flex w-full items-center justify-between rounded-r-lg border-l-[3px] px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                  adminSection === "teamMembers"
                    ? "border-[#6B9E6E] bg-[#6B9E6E]/25 text-white"
                    : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                Team
              </button>
            ) : null}
            {isAdminPanelRole(profile?.role) ? (
              <button
                type="button"
                onClick={() => setAdminSection("teamManagement")}
                className={`flex w-full items-center justify-between rounded-r-lg border-l-[3px] px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                  adminSection === "teamManagement"
                    ? "border-[#6B9E6E] bg-[#6B9E6E]/25 text-white"
                    : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                Team Management
              </button>
            ) : null}
            {isAdminSectionVisible("outreach") ? (
            <button
              type="button"
              onClick={() => setAdminSection("outreach")}
              className={`flex w-full items-center justify-between rounded-r-lg border-l-[3px] px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                adminSection === "outreach"
                  ? "border-[#6B9E6E] bg-[#6B9E6E]/25 text-white"
                  : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              Outreach
            </button>
            ) : null}
            {isAdminSectionVisible("profileReports") ? (
            <button
              type="button"
              onClick={() => setAdminSection("profileReports")}
              className={`flex w-full items-center justify-between rounded-r-lg border-l-[3px] px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                adminSection === "profileReports"
                  ? "border-[#6B9E6E] bg-[#6B9E6E]/25 text-white"
                  : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span>Reports</span>
              <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold tabular-nums">
                {profileReportsRows.length}
              </span>
            </button>
            ) : null}
            {isAdminSectionVisible("vaReports") ? (
            <button
              type="button"
              onClick={() => setAdminSection("vaReports")}
              className={`flex w-full items-center justify-between rounded-r-lg border-l-[3px] px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                adminSection === "vaReports"
                  ? "border-[#6B9E6E] bg-[#6B9E6E]/25 text-white"
                  : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              VA Reports
            </button>
            ) : null}
            {canSeeCredentials ? (
              <button
                type="button"
                onClick={() => setAdminSection("credentials")}
                className={`flex w-full items-center justify-between rounded-r-lg border-l-[3px] px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                  adminSection === "credentials"
                    ? "border-[#6B9E6E] bg-[#6B9E6E]/25 text-white"
                    : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                Credentials
              </button>
            ) : null}
            {canSeeManual ? (
              <button
                type="button"
                onClick={() => setAdminSection("manual")}
                className={`flex w-full items-center justify-between rounded-r-lg border-l-[3px] px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                  adminSection === "manual"
                    ? "border-[#6B9E6E] bg-[#6B9E6E]/25 text-white"
                    : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                Manual
              </button>
            ) : null}
          </nav>
          <div className="border-t border-white/10 px-4 py-3">
            <Link href="/" className="text-sm text-[#6B9E6E] hover:underline">
              ← Home
            </Link>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <header className="hidden shrink-0 items-center justify-between border-b border-[#2C2C2C]/10 bg-white px-6 py-4 shadow-sm md:flex">
            <div>
              <h1 className="font-serif text-xl font-bold text-[#2C2C2C]">Admin Dashboard</h1>
              <p className="text-xs text-[#2C2C2C]/45">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOutAdmin()}
              className="rounded-full border border-[#2C2C2C]/10 bg-[#FAF8F4] px-4 py-2 text-sm font-semibold text-[#2C2C2C]/80 hover:bg-[#eef1f6]"
            >
              Sign out
            </button>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="mx-auto max-w-6xl">
        {adminSection === "users" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#2C2C2C]/70">
                All registered profiles (merged with auth email).
              </p>
              <button
                type="button"
                onClick={() => void fetchUsers()}
                className="rounded-full border border-[#2C2C2C]/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] shadow-sm hover:bg-[#FAF8F4]"
              >
                Refresh
              </button>
            </div>
            {usersError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {usersError}
              </div>
            )}
            <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
              {usersLoading ? (
                <div className="p-10 text-center text-sm text-[#2C2C2C]/45">Loading users…</div>
              ) : adminUsers.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#2C2C2C]/45">No users found.</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                    <tr className="text-left text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/50">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Verified</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2C2C2C]/5">
                    {adminUsers.map((u) => {
                      const verifiedLabel =
                        u.role === "agent"
                          ? u.agent_verified === null
                            ? "—"
                            : u.agent_verified
                              ? "Yes"
                              : "No"
                          : u.role === "broker"
                            ? u.broker_verified === null
                              ? "—"
                              : u.broker_verified
                                ? "Yes"
                                : "No"
                            : "—";
                      return (
                        <tr key={u.id} className="hover:bg-[#FAF8F4]/80">
                          <td className="px-4 py-3 text-sm font-semibold text-[#2C2C2C]">
                            {u.full_name?.trim() || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#2C2C2C]/75">{u.email ?? "—"}</td>
                          <td className="px-4 py-3">
                            <select
                              value={u.role}
                              onChange={(e) => void updateUserRole(u.id, e.target.value)}
                              className="max-w-[140px] rounded-lg border border-[#2C2C2C]/10 bg-white px-2 py-1.5 text-xs font-semibold text-[#2C2C2C]"
                            >
                              <option value="client">client</option>
                              <option value="agent">agent</option>
                              <option value="broker">broker</option>
                              <option value="admin">admin</option>
                              <option value="ops_admin">ops_admin</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#2C2C2C]/50">
                            {new Date(u.created_at).toLocaleDateString("en-PH")}
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-[#6B9E6E]">
                            {verifiedLabel}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              {u.agent_id && u.agent_status === "pending" && (
                                <button
                                  type="button"
                                  onClick={() => void approveAgent(u.agent_id!)}
                                  className="rounded-full bg-[#6B9E6E] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#6b8a6d]"
                                >
                                  Approve agent
                                </button>
                              )}
                              {u.broker_id && u.broker_status === "pending" && (
                                <button
                                  type="button"
                                  onClick={() => void approveBroker(u.broker_id!)}
                                  className="rounded-full bg-[#6B9E6E] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#6b8a6d]"
                                >
                                  Approve broker
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void deleteUser(u.id)}
                                className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {adminSection === "leads" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm text-gray-500">
                {leads.length} total leads
              </span>
              <button
                onClick={fetchLeads}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-all"
              >
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: "Total Leads", value: leads.length, color: "bg-white" },
                {
                  label: "New",
                  value: leads.filter((l) => leadStage(l) === "new").length,
                  color: "bg-blue-50",
                },
                {
                  label: "Contacted",
                  value: leads.filter((l) => leadStage(l) === "contacted")
                    .length,
                  color: "bg-yellow-50",
                },
                {
                  label: "Closed",
                  value: leads.filter((l) => {
                    const s = leadStage(l);
                    return (
                      s === "closed_won" ||
                      s === "closed_lost" ||
                      s === "closed"
                    );
                  }).length,
                  color: "bg-green-50",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={`${stat.color} rounded-2xl border border-gray-200 p-4`}
                >
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-4">
              {(["all", "new", "contacted", "closed"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-all ${
                    filter === f
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-500 border border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-sm text-gray-400">
                  Loading leads...
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">
                  No leads yet.
                </div>
              ) : (
                <table className="w-full">
                  <thead className="border-b border-gray-100">
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Contact</th>
                      <th className="px-6 py-4">Property Interest</th>
                      <th className="px-6 py-4">Message</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50 transition-all">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {lead.name}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-700">{lead.email}</p>
                          <p className="text-xs text-gray-400">{lead.phone}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {lead.property_interest}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {lead.message}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400">
                          {new Date(lead.created_at).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={leadStage(lead)}
                            onChange={(e) =>
                              updateLeadStage(lead.id, e.target.value)
                            }
                            className="rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none max-w-[140px]"
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="qualified">Qualified</option>
                            <option value="viewing">Viewing</option>
                            <option value="negotiation">Negotiation</option>
                            <option value="closed_won">Closed (won)</option>
                            <option value="closed_lost">Closed (lost)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {adminSection === "properties" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                {propertiesLoading
                  ? "Loading properties..."
                  : `${properties.length} listing${properties.length === 1 ? "" : "s"} in Supabase`}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fetchProperties}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={openNewProperty}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
                >
                  Add property
                </button>
              </div>
            </div>

            {propertyError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {propertyError}
              </div>
            )}

            <p className="text-xs text-gray-400">
              Creating, editing, or deleting listings requires{" "}
              <code className="rounded bg-gray-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              in <code className="rounded bg-gray-100 px-1">.env.local</code> (server-only).
            </p>

            <form
              onSubmit={saveProperty}
              className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4"
            >
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? "Edit property" : "New property"}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-medium text-gray-500">
                  Location
                  <input
                    required
                    value={propertyForm.location}
                    onChange={(e) =>
                      setPropertyForm((f) => ({ ...f, location: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-500">
                  Price (display)
                  <input
                    required
                    value={propertyForm.price}
                    onChange={(e) =>
                      setPropertyForm((f) => ({ ...f, price: e.target.value }))
                    }
                    placeholder="₱125,000,000"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-500">
                  Sqft (display)
                  <input
                    required
                    value={propertyForm.sqft}
                    onChange={(e) =>
                      setPropertyForm((f) => ({ ...f, sqft: e.target.value }))
                    }
                    placeholder="4,200"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-500">
                  Image URL
                  <input
                    required
                    value={propertyForm.image_url}
                    onChange={(e) =>
                      setPropertyForm((f) => ({ ...f, image_url: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-500">
                  Beds
                  <input
                    required
                    type="number"
                    min={0}
                    value={propertyForm.beds}
                    onChange={(e) =>
                      setPropertyForm((f) => ({ ...f, beds: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-500">
                  Baths
                  <input
                    required
                    type="number"
                    min={0}
                    value={propertyForm.baths}
                    onChange={(e) =>
                      setPropertyForm((f) => ({ ...f, baths: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />
                </label>
                {editingId ? (
                  <label className="block text-xs font-medium text-gray-500 sm:col-span-2">
                    Availability (manual)
                    <select
                      value={propertyForm.availability_state}
                      onChange={(e) =>
                        setPropertyForm((f) => ({
                          ...f,
                          availability_state: e.target.value as PropertyFormAvailability,
                        }))
                      }
                      className="mt-1 w-full max-w-md rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                    >
                      <option value="available">Available</option>
                      <option value="reserved">Reserved</option>
                      <option value="closed">Closed</option>
                      <option value="removed">Removed</option>
                    </select>
                  </label>
                ) : (
                  <label className="flex cursor-pointer items-start gap-2 text-xs text-gray-600 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={skipDuplicateCheck}
                      onChange={(e) => setSkipDuplicateCheck(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300"
                    />
                    <span>
                      Skip duplicate check — skips location duplicate detection for this submission only. Use only
                      when you have confirmed the new row is not the same listing.
                    </span>
                  </label>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={propertySaving}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  {propertySaving
                    ? "Saving..."
                    : editingId
                      ? "Update property"
                      : "Create property"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={openNewProperty}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>

            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              {propertiesLoading ? (
                <div className="p-8 text-center text-sm text-gray-400">
                  Loading properties...
                </div>
              ) : properties.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">
                  No properties yet. Add one above or run the SQL seed migration.
                </div>
              ) : (
                <table className="w-full">
                  <thead className="border-b border-gray-100 bg-gray-50/80">
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Sqft</th>
                      <th className="px-4 py-3">Beds</th>
                      <th className="px-4 py-3">Baths</th>
                      <th className="px-4 py-3">Availability</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {properties.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/80">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[220px]">
                          {p.location}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {formatPropertyPriceDisplay(
                            p.price,
                            p.status as "for_sale" | "for_rent" | "sold" | "rented" | undefined,
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {p.sqft}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {p.beds}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {p.baths}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            aria-label={`Availability for ${p.location}`}
                            className="max-w-[150px] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-800 outline-none focus:border-gray-400"
                            value={(p.availability_state ?? "available") as PropertyFormAvailability}
                            disabled={propertyAvailabilityPatchingId === p.id}
                            onChange={(e) => {
                              const v = e.target.value as PropertyFormAvailability;
                              void patchPropertyAvailability(p.id, v);
                            }}
                          >
                            <option value="available">Available</option>
                            <option value="reserved">Reserved</option>
                            <option value="closed">Closed</option>
                            <option value="removed">Removed</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {p.featured ? (
                              <span className="text-xs font-semibold text-[#D4A843]">Featured</span>
                            ) : (
                              <button
                                type="button"
                                disabled={featuredSettingId !== null}
                                onClick={() => void setPropertyFeatured(p.id)}
                                className="text-sm font-medium text-[#D4A843] underline underline-offset-2 hover:text-[#b88d35] disabled:opacity-50"
                              >
                                {featuredSettingId === p.id ? "Saving…" : "Set as Featured"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openManageAgents(p)}
                              className="text-sm font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
                            >
                              Manage Agents
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditProperty(p)}
                              className="text-sm font-medium text-gray-900 underline underline-offset-2 hover:text-gray-600"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteProperty(p.id)}
                              className="text-sm font-medium text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {adminSection === "verification" && (
          <div className="space-y-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                Approve or reject broker and agent applications. Decisions notify the applicant.
              </p>
              <button
                type="button"
                onClick={() => void fetchVerification()}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>
            {verificationError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <p className="font-medium text-red-900 mb-2">
                  Verification queue could not be loaded
                </p>
                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-red-900/90 max-h-80 overflow-auto">
                  {verificationError}
                </pre>
              </div>
            )}
            {!verificationLoading &&
              !verificationError &&
              pendingBrokers.length === 0 &&
              pendingAgents.length === 0 &&
              documentQueueAgents.length === 0 &&
              !allAgentsLoading && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  No pending applications.
                </div>
              )}

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Pending brokers
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({pendingBrokers.length})
                </span>
              </h2>
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                {verificationLoading ? (
                  <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
                ) : pendingBrokers.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">No pending brokers.</div>
                ) : (
                  <table className="w-full">
                    <thead className="border-b border-gray-100 bg-gray-50/80">
                      <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-3">Company</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">License</th>
                        <th className="px-4 py-3">Submitted</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pendingBrokers.map((b) => (
                        <Fragment key={b.id}>
                          <tr className="hover:bg-gray-50/80 align-top">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {b.company_name}
                              <p className="text-xs font-normal text-gray-500">{b.name}</p>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {b.email}
                              {b.phone && (
                                <p className="text-xs text-gray-500">{b.phone}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {b.license_number}
                              {b.license_expiry && (
                                <p className="text-gray-500">exp {b.license_expiry}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {new Date(b.created_at).toLocaleDateString("en-PH")}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => void approveBroker(b.id)}
                                  className="rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#6b8a6d]"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectOpen({ kind: "broker", id: b.id });
                                    setRejectReason("");
                                  }}
                                  className="rounded-full border-2 border-red-300 bg-red-50 px-5 py-2.5 text-sm font-bold text-red-800 hover:bg-red-100"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                          {rejectOpen?.kind === "broker" && rejectOpen.id === b.id && (
                            <tr className="bg-amber-50/50">
                              <td colSpan={5} className="px-4 py-3">
                                <p className="text-xs font-medium text-gray-700 mb-2">
                                  Rejection reason (sent to applicant)
                                </p>
                                <textarea
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  rows={3}
                                  className="w-full max-w-xl rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none mb-2"
                                  placeholder="Explain why this application was not approved."
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void submitRejectBroker()}
                                    disabled={!rejectReason.trim()}
                                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                  >
                                    Send rejection
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRejectOpen(null)}
                                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Pending agents
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({pendingAgents.length})
                </span>
              </h2>
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                {verificationLoading ? (
                  <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
                ) : pendingAgents.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">No pending agents.</div>
                ) : (
                  <table className="w-full">
                    <thead className="border-b border-gray-100 bg-gray-50/80">
                      <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">License</th>
                        <th className="px-4 py-3">Broker id</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pendingAgents.map((a) => (
                        <Fragment key={a.id}>
                          <tr className="hover:bg-gray-50/80 align-top">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {a.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {a.email}
                              {a.phone && (
                                <p className="text-xs text-gray-500">{a.phone}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {a.license_number}
                              {a.license_expiry && (
                                <p className="text-gray-500">exp {a.license_expiry}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                              {a.broker_id ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => void approveAgent(a.id)}
                                  className="rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#6b8a6d]"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectOpen({ kind: "agent", id: a.id });
                                    setRejectReason("");
                                  }}
                                  className="rounded-full border-2 border-red-300 bg-red-50 px-5 py-2.5 text-sm font-bold text-red-800 hover:bg-red-100"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                          {rejectOpen?.kind === "agent" && rejectOpen.id === a.id && (
                            <tr className="bg-amber-50/50">
                              <td colSpan={5} className="px-4 py-3">
                                <p className="text-xs font-medium text-gray-700 mb-2">
                                  Rejection reason (sent to applicant)
                                </p>
                                <textarea
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  rows={3}
                                  className="w-full max-w-xl rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none mb-2"
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void submitRejectAgent()}
                                    disabled={!rejectReason.trim()}
                                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                  >
                                    Send rejection
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRejectOpen(null)}
                                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Document Verification Queue
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({documentQueueAgents.length})
                </span>
              </h2>
              <p className="mb-3 text-sm text-gray-500">
                Approved agents waiting on PRC / identity document review (verification_status pending or rejected).
              </p>
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                {allAgentsLoading ? (
                  <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
                ) : documentQueueAgents.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">No agents in the document queue.</div>
                ) : (
                  <table className="w-full">
                    <thead className="border-b border-gray-100 bg-gray-50/80">
                      <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">PRC (masked)</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {documentQueueAgents.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50/80 align-top">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {a.email}
                            {a.phone ? <p className="text-xs text-gray-500">{a.phone}</p> : null}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-gray-600">
                            {maskPrcForAdminQueue(a.license_number)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={docQueueBadgeClass(a.verification_status)}>
                              {a.verification_status === "pending"
                                ? "pending"
                                : a.verification_status === "rejected"
                                  ? "rejected"
                                  : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => void openDocReviewModal(a)}
                              className="rounded-full bg-[#2C2C2C] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-gray-800"
                            >
                              Review Documents
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        )}

        {adminSection === "agents" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#2C2C2C]/70">
                Every agent record — edit, approve, reject, or delete.
              </p>
              <button
                type="button"
                onClick={() => void fetchAllAgents()}
                className="rounded-full border border-[#2C2C2C]/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] shadow-sm hover:bg-[#FAF8F4]"
              >
                Refresh
              </button>
            </div>
            <section className="rounded-2xl border border-[#D4A843]/25 bg-[#FAF8F4] p-6 shadow-sm">
              <h2 className="mb-4 font-serif text-xl font-bold text-[#2C2C2C]">
                All agents
                <span className="ml-2 text-sm font-normal text-[#2C2C2C]/50">
                  ({allAgentsList.length} total)
                </span>
              </h2>
              <p className="mb-4 text-sm text-[#2C2C2C]/60">
                Includes pending and rejected applications.
              </p>
              <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white">
                {allAgentsLoading ? (
                  <div className="p-8 text-center text-sm text-[#2C2C2C]/45">Loading…</div>
                ) : allAgentsList.length === 0 ? (
                  <div className="p-8 text-center text-sm text-[#2C2C2C]/45">No agent records.</div>
                ) : (
                  <table className="w-full">
                    <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                      <tr className="text-left text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/50">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">License</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Verification</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2C2C2C]/5">
                      {allAgentsList.map((a) => (
                        <Fragment key={a.id}>
                          <tr className="hover:bg-[#FAF8F4]/50">
                            <td className="px-4 py-3 text-sm font-semibold text-[#2C2C2C]">{a.name}</td>
                            <td className="px-4 py-3 text-sm text-[#2C2C2C]/75">{a.email}</td>
                            <td className="px-4 py-3 text-xs text-[#2C2C2C]/60">{a.license_number}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-[#EBE6DC] px-2 py-0.5 text-xs font-bold capitalize text-[#2C2C2C]/80">
                                {a.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-sm font-semibold ${verificationColumnClass(a.verification_status)}`}
                              >
                                {verificationColumnLabel(a.verification_status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {a.status === "pending" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => void approveAgent(a.id)}
                                      className="rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#6b8a6d]"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectOpen({ kind: "agent", id: a.id });
                                        setRejectReason("");
                                      }}
                                      className="rounded-full border-2 border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-800"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResetPasswordAgent(a);
                                    setResetPasswordValue("");
                                  }}
                                  className="rounded-full border border-[#6B9E6E]/35 bg-[#6B9E6E]/10 px-4 py-2 text-xs font-bold text-[#2C2C2C] hover:bg-[#6B9E6E]/20"
                                >
                                  Reset Password
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditAgent(a)}
                                  className="rounded-full border border-[#D4A843]/40 bg-[#FAF8F4] px-4 py-2 text-xs font-bold text-[#2C2C2C] hover:bg-[#D4A843]/20"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteAgentRow(a.id)}
                                  className="rounded-full border border-[#2C2C2C]/15 bg-white px-4 py-2 text-xs font-bold text-[#2C2C2C]/70 hover:bg-red-50 hover:text-red-800"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                          {rejectOpen?.kind === "agent" && rejectOpen.id === a.id && (
                            <tr className="bg-amber-50/60">
                              <td colSpan={6} className="px-4 py-3">
                                <p className="mb-2 text-xs font-semibold text-[#2C2C2C]">
                                  Rejection reason (sent to applicant)
                                </p>
                                <textarea
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  rows={3}
                                  className="mb-2 w-full max-w-xl rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm outline-none"
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void submitRejectAgent()}
                                    disabled={!rejectReason.trim()}
                                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                                  >
                                    Send rejection
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRejectOpen(null)}
                                    className="rounded-lg border border-[#2C2C2C]/10 px-3 py-1.5 text-xs font-semibold text-[#2C2C2C]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        )}

        {adminSection === "coagent" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#2C2C2C]/70">
                Agents who asked to be linked to an existing listing. Approve adds them to{" "}
                <code className="rounded bg-[#EBE6DC] px-1 text-xs">property_agents</code> and notifies by SMS.
              </p>
              <button
                type="button"
                onClick={() => void fetchCoAgentRequests()}
                className="rounded-full border border-[#2C2C2C]/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] shadow-sm hover:bg-[#FAF8F4]"
              >
                Refresh
              </button>
            </div>
            {coAgentError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {coAgentError}
              </div>
            ) : null}
            <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
              {coAgentLoading ? (
                <div className="p-8 text-center text-sm text-[#2C2C2C]/45">Loading…</div>
              ) : coAgentRequests.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#2C2C2C]/45">No pending co-agent requests.</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                    <tr className="text-left text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/50">
                      <th className="px-4 py-3">Property</th>
                      <th className="px-4 py-3">Agent</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2C2C2C]/5">
                    {coAgentRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-[#FAF8F4]/40">
                        <td className="px-4 py-3 text-sm font-semibold text-[#2C2C2C]">
                          <span className="block">{r.propertyName}</span>
                          {r.propertyLocation ? (
                            <span className="mt-0.5 block text-xs font-medium text-[#2C2C2C]/55">
                              {r.propertyLocation}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#2C2C2C]/80">{r.agentName}</td>
                        <td className="px-4 py-3 text-xs text-[#2C2C2C]/55">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void decideCoAgentRequest(r.id, "approve")}
                              className="rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#5d8a60]"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => void decideCoAgentRequest(r.id, "reject")}
                              className="rounded-full border-2 border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-800 hover:bg-red-100"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {adminSection === "hiring" && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                    Total Applied
                  </p>
                  <p className="mt-1 font-serif text-2xl font-bold text-[#2C2C2C]">{hiringStats.total}</p>
                </div>
                <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                    Interviewed
                  </p>
                  <p className="mt-1 font-serif text-2xl font-bold text-[#6B9E6E]">{hiringStats.interviewed}</p>
                </div>
                <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Hired</p>
                  <p className="mt-1 font-serif text-2xl font-bold text-[#D4A843]">{hiringStats.hired}</p>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddApplicantOpen(true)}
                  className="rounded-full bg-[#2C2C2C] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#6B9E6E]"
                >
                  Add Applicant
                </button>
                <button
                  type="button"
                  onClick={() => void fetchApplicants()}
                  className="rounded-full border border-[#2C2C2C]/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] shadow-sm hover:bg-[#FAF8F4]"
                >
                  Refresh
                </button>
              </div>
            </div>

            {applicantsError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {applicantsError}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
              {applicantsLoading ? (
                <div className="p-10 text-center text-sm text-[#2C2C2C]/45">Loading applicants…</div>
              ) : applicants.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#2C2C2C]/45">No applicants yet.</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                    <tr className="text-left text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/50">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Age</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Date Applied</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2C2C2C]/5">
                    {applicants.map((a) => {
                      const isEditing = editingApplicantId === a.id;
                      return (
                        <tr key={a.id} className="align-top hover:bg-[#FAF8F4]/80">
                          <td className="px-4 py-3 text-sm font-semibold text-[#2C2C2C]">
                            {a.first_name} {a.last_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#2C2C2C]/80">{a.age}</td>
                          <td className="px-4 py-3 text-sm text-[#2C2C2C]/75">{a.email}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-[#2C2C2C]/55">
                            {new Date(a.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <select
                                value={editApplicantDraft.status}
                                onChange={(e) =>
                                  setEditApplicantDraft((d) => ({ ...d, status: e.target.value }))
                                }
                                className="w-full min-w-[9rem] rounded-lg border border-[#2C2C2C]/10 bg-white px-2 py-1.5 text-xs font-semibold text-[#2C2C2C]"
                              >
                                {APPLICANT_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${applicantStatusPillClass(a.status)}`}
                              >
                                {a.status}
                              </span>
                            )}
                          </td>
                          <td className="max-w-xs px-4 py-3 text-sm text-[#2C2C2C]/75">
                            {isEditing ? (
                              <textarea
                                value={editApplicantDraft.notes}
                                onChange={(e) =>
                                  setEditApplicantDraft((d) => ({ ...d, notes: e.target.value }))
                                }
                                rows={3}
                                className="w-full rounded-lg border border-[#2C2C2C]/10 px-2 py-1.5 text-xs text-[#2C2C2C]"
                                placeholder="Notes"
                              />
                            ) : (
                              <span className="line-clamp-3 whitespace-pre-wrap">
                                {a.notes?.trim() ? a.notes : "—"}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={editApplicantSaving}
                                  onClick={() => void saveEditApplicant()}
                                  className="rounded-full bg-[#6B9E6E] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#5d8a60] disabled:opacity-50"
                                >
                                  {editApplicantSaving ? "Saving…" : "Save"}
                                </button>
                                <button
                                  type="button"
                                  disabled={editApplicantSaving}
                                  onClick={cancelEditApplicant}
                                  className="rounded-full border border-[#2C2C2C]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#2C2C2C] hover:bg-[#FAF8F4] disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEditApplicant(a)}
                                className="rounded-full border border-[#2C2C2C]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#2C2C2C] hover:bg-[#FAF8F4]"
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {adminSection === "outreach" && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  Total Leads
                </p>
                <p className="mt-1 font-serif text-2xl font-bold text-[#2C2C2C]">{vaLeadsStats.totalLeads}</p>
              </div>
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  Contacted Today
                </p>
                <p className="mt-1 font-serif text-2xl font-bold text-blue-700">
                  {vaLeadsStats.contactedToday}
                </p>
              </div>
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  Replies Today
                </p>
                <p className="mt-1 font-serif text-2xl font-bold text-amber-600">
                  {vaLeadsStats.repliesToday}
                </p>
              </div>
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  Meetings Booked Today
                </p>
                <p className="mt-1 font-serif text-2xl font-bold text-[#6B9E6E]">
                  {vaLeadsStats.meetingsBookedToday}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <input
                  type="search"
                  value={outreachSearch}
                  onChange={(e) => setOutreachSearch(e.target.value)}
                  placeholder="Search name, email, phone…"
                  className="w-full min-w-[200px] rounded-full border border-[#2C2C2C]/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] sm:max-w-xs"
                />
                <select
                  value={outreachStatusFilter}
                  onChange={(e) => setOutreachStatusFilter(e.target.value)}
                  className="rounded-full border border-[#2C2C2C]/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]"
                >
                  <option value="">All statuses</option>
                  {VA_LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  value={outreachAssignedFilter}
                  onChange={(e) => setOutreachAssignedFilter(e.target.value)}
                  className="rounded-full border border-[#2C2C2C]/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]"
                >
                  <option value="">Assigned to (any)</option>
                  {vaLeadsAssignOptions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewVaLeadOpen(true)}
                  className="rounded-full bg-[#2C2C2C] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#6B9E6E]"
                >
                  New Lead
                </button>
                <button
                  type="button"
                  onClick={() => void fetchVaLeads()}
                  className="rounded-full border border-[#2C2C2C]/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] shadow-sm hover:bg-[#FAF8F4]"
                >
                  Refresh
                </button>
              </div>
            </div>

            {vaLeadsError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {vaLeadsError}
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
              {vaLeadsLoading ? (
                <div className="p-10 text-center text-sm text-[#2C2C2C]/45">Loading outreach…</div>
              ) : vaLeads.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#2C2C2C]/45">No leads yet.</div>
              ) : (
                <table className="w-full min-w-[1100px]">
                  <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                    <tr className="text-left text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/50">
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3">Role</th>
                      <th className="px-3 py-3">Phone</th>
                      <th className="px-3 py-3">Email</th>
                      <th className="px-3 py-3">Platform</th>
                      <th className="px-3 py-3">Listing Link</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Follow-up Stage</th>
                      <th className="px-3 py-3">Last Contacted</th>
                      <th className="px-3 py-3">Assigned To</th>
                      <th className="px-3 py-3">Notes</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2C2C2C]/5">
                    {vaLeads.map((row) => (
                      <Fragment key={row.id}>
                        <tr className="align-top hover:bg-[#FAF8F4]/80">
                          <td className="px-3 py-3 text-sm font-semibold text-[#2C2C2C]">
                            <span className="inline-flex flex-wrap items-center gap-1.5">
                              {row.name}
                              {vaLeadNeedsFollowUp(row) ? (
                                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                                  Needs Follow-Up
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td className="max-w-[100px] px-3 py-3 text-xs text-[#2C2C2C]/75">{row.role ?? "—"}</td>
                          <td className="px-3 py-3 text-xs text-[#2C2C2C]/75">{row.phone ?? "—"}</td>
                          <td className="max-w-[140px] break-all px-3 py-3 text-xs text-[#2C2C2C]/75">
                            {row.email ?? "—"}
                          </td>
                          <td className="px-3 py-3 text-xs text-[#2C2C2C]/75">{row.platform ?? "—"}</td>
                          <td className="max-w-[120px] truncate px-3 py-3 text-xs">
                            {row.listing_link ? (
                              <a
                                href={row.listing_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-[#6B9E6E] underline"
                              >
                                Link
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex flex-wrap items-center gap-1">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${vaLeadStatusPillClass(row.status)}`}
                              >
                                {row.status}
                              </span>
                              {row.status === "replied" ? (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-800">
                                  Hot Lead
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td className="max-w-[100px] px-3 py-3 text-xs text-[#2C2C2C]/75">
                            {row.follow_up_stage ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-[10px] text-[#2C2C2C]/55">
                            {row.last_contacted_at
                              ? new Date(row.last_contacted_at).toLocaleString()
                              : "—"}
                          </td>
                          <td className="px-3 py-3 text-xs text-[#2C2C2C]/75">{row.assigned_to ?? "—"}</td>
                          <td className="max-w-[140px] px-3 py-3 text-xs text-[#2C2C2C]/75">
                            <span className="line-clamp-2 whitespace-pre-wrap">{row.notes ?? "—"}</span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                if (outreachExpandedId === row.id) {
                                  setOutreachExpandedId(null);
                                } else {
                                  openOutreachEdit(row);
                                }
                              }}
                              className="rounded-full border border-[#2C2C2C]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#2C2C2C] hover:bg-[#FAF8F4]"
                            >
                              {outreachExpandedId === row.id ? "Close" : "Edit"}
                            </button>
                          </td>
                        </tr>
                        {outreachExpandedId === row.id ? (
                          <tr className="bg-[#FAF8F4]/50">
                            <td colSpan={12} className="px-4 py-4">
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <label className="block text-xs font-bold text-[#2C2C2C]/45">
                                  Status
                                  <select
                                    value={outreachDraft.status}
                                    onChange={(e) =>
                                      setOutreachDraft((d) => ({ ...d, status: e.target.value }))
                                    }
                                    className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 bg-white px-2 py-2 text-sm"
                                  >
                                    {VA_LEAD_STATUSES.map((s) => (
                                      <option key={s} value={s}>
                                        {s}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block text-xs font-bold text-[#2C2C2C]/45">
                                  Follow-up stage
                                  <input
                                    type="text"
                                    value={outreachDraft.follow_up_stage}
                                    onChange={(e) =>
                                      setOutreachDraft((d) => ({
                                        ...d,
                                        follow_up_stage: e.target.value,
                                      }))
                                    }
                                    className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-2 py-2 text-sm"
                                  />
                                </label>
                                <label className="block text-xs font-bold text-[#2C2C2C]/45">
                                  Messages sent
                                  <input
                                    type="number"
                                    min={0}
                                    value={outreachDraft.messages_sent}
                                    onChange={(e) =>
                                      setOutreachDraft((d) => ({
                                        ...d,
                                        messages_sent: Number(e.target.value) || 0,
                                      }))
                                    }
                                    className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-2 py-2 text-sm"
                                  />
                                </label>
                                <label className="block text-xs font-bold text-[#2C2C2C]/45 sm:col-span-2">
                                  Assigned to
                                  <input
                                    type="text"
                                    value={outreachDraft.assigned_to}
                                    onChange={(e) =>
                                      setOutreachDraft((d) => ({
                                        ...d,
                                        assigned_to: e.target.value,
                                      }))
                                    }
                                    className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-2 py-2 text-sm"
                                  />
                                </label>
                                <label className="block text-xs font-bold text-[#2C2C2C]/45 sm:col-span-2 lg:col-span-3">
                                  Notes
                                  <textarea
                                    value={outreachDraft.notes}
                                    onChange={(e) =>
                                      setOutreachDraft((d) => ({ ...d, notes: e.target.value }))
                                    }
                                    rows={3}
                                    className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-2 py-2 text-sm"
                                  />
                                </label>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={outreachSaving}
                                  onClick={() => void saveOutreachEdit(row.id)}
                                  className="rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                                >
                                  {outreachSaving ? "Saving…" : "Save"}
                                </button>
                                <button
                                  type="button"
                                  disabled={outreachSaving}
                                  onClick={() => setOutreachExpandedId(null)}
                                  className="rounded-full border border-[#2C2C2C]/15 bg-white px-4 py-2 text-xs font-semibold text-[#2C2C2C] disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {adminSection === "teamMembers" && canSeeTeamTab ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">Team</h2>
              <button
                type="button"
                onClick={() => setTeamMemberModalOpen(true)}
                className="rounded-full bg-[#2C2C2C] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#6B9E6E]"
              >
                New Team Member
              </button>
            </div>
            {teamMembersLoading ? (
              <p className="text-sm font-semibold text-[#2C2C2C]/55">Loading…</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                      <th className="px-4 py-3 font-semibold text-[#2C2C2C]">Name</th>
                      <th className="px-4 py-3 font-semibold text-[#2C2C2C]">Email</th>
                      <th className="px-4 py-3 font-semibold text-[#2C2C2C]">Role</th>
                      <th className="px-4 py-3 font-semibold text-[#2C2C2C]">Added Date</th>
                      <th className="px-4 py-3 font-semibold text-[#2C2C2C]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembersRows.map((row) => (
                      <tr key={row.id} className="border-b border-[#2C2C2C]/10">
                        <td className="px-4 py-3 font-semibold text-[#2C2C2C]">{row.name}</td>
                        <td className="px-4 py-3 text-[#2C2C2C]/80">{row.email}</td>
                        <td className="px-4 py-3">{teamRoleLabel(row.role)}</td>
                        <td className="px-4 py-3 text-[#2C2C2C]/70">
                          {new Date(row.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => void deleteTeamMember(row.id)}
                            className="text-sm font-semibold text-red-700 underline hover:text-red-900"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {teamMembersRows.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-[#2C2C2C]/55">No team members yet.</p>
                ) : null}
              </div>
            )}
            {teamMemberModalOpen ? (
              <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4">
                <div className="w-full max-w-md rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-lg font-bold text-[#2C2C2C]">New team member</h3>
                    <button
                      type="button"
                      onClick={() => setTeamMemberModalOpen(false)}
                      className="rounded-full p-2 hover:bg-[#FAF8F4]"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    <label className="block text-xs font-bold uppercase text-[#2C2C2C]/45">
                      Name
                      <input
                        value={newTeamMember.name}
                        onChange={(e) => setNewTeamMember((m) => ({ ...m, name: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold"
                      />
                    </label>
                    <label className="block text-xs font-bold uppercase text-[#2C2C2C]/45">
                      Email
                      <input
                        type="email"
                        value={newTeamMember.email}
                        onChange={(e) => setNewTeamMember((m) => ({ ...m, email: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold"
                      />
                    </label>
                    <label className="block text-xs font-bold uppercase text-[#2C2C2C]/45">
                      Role
                      <select
                        value={newTeamMember.role}
                        onChange={(e) =>
                          setNewTeamMember((m) => ({
                            ...m,
                            role: e.target.value as TeamMemberRow["role"],
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold"
                      >
                        <option value="owner">Owner</option>
                        <option value="co_founder">Co-Founder</option>
                        <option value="va_admin">VA Admin</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setTeamMemberModalOpen(false)}
                      className="rounded-full border border-[#2C2C2C]/15 px-4 py-2 text-sm font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={teamMemberSaving}
                      onClick={() => void submitTeamMember()}
                      className="rounded-full bg-[#6B9E6E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {teamMemberSaving ? "Saving…" : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {adminSection === "teamManagement" && isAdminPanelRole(profile?.role) ? (
          <TeamManagementSection showCompensation={isFullAdminRole(profile?.role)} />
        ) : null}

        {adminSection === "vaReports" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-4 py-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Week of {vaReportsWeekRange.start} – {vaReportsWeekRange.end} (all VAs)
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-[11px] font-semibold text-[#2C2C2C]/50">Leads found</p>
                  <p className="font-serif text-xl font-bold text-[#2C2C2C]">{vaReportsWeekly.leadsFound}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#2C2C2C]/50">Contacts made</p>
                  <p className="font-serif text-xl font-bold text-[#2C2C2C]">{vaReportsWeekly.contactsMade}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#2C2C2C]/50">Replies</p>
                  <p className="font-serif text-xl font-bold text-[#2C2C2C]">{vaReportsWeekly.replies}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#2C2C2C]/50">Meetings booked</p>
                  <p className="font-serif text-xl font-bold text-[#2C2C2C]">{vaReportsWeekly.meetingsBooked}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSubmitReportForm((s) => ({
                    ...s,
                    va_name: profile?.full_name?.trim() || "",
                    report_date: new Date().toISOString().slice(0, 10),
                  }));
                  setSubmitReportOpen(true);
                }}
                className="rounded-full bg-[#2C2C2C] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#6B9E6E]"
              >
                Submit Report
              </button>
              <button
                type="button"
                onClick={() => void fetchVaReports()}
                className="rounded-full border border-[#2C2C2C]/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] shadow-sm hover:bg-[#FAF8F4]"
              >
                Refresh
              </button>
            </div>
            {vaReportsError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {vaReportsError}
              </div>
            ) : null}
            <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
              {vaReportsLoading ? (
                <div className="p-10 text-center text-sm text-[#2C2C2C]/45">Loading reports…</div>
              ) : vaReports.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#2C2C2C]/45">No daily reports yet.</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                    <tr className="text-left text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/50">
                      <th className="px-4 py-3">VA Name</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Leads Found</th>
                      <th className="px-4 py-3">Contacts Made</th>
                      <th className="px-4 py-3">Replies</th>
                      <th className="px-4 py-3">Meetings Booked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2C2C2C]/5">
                    {vaReports.map((r) => (
                      <tr key={r.id} className="hover:bg-[#FAF8F4]/80">
                        <td className="px-4 py-3 text-sm font-semibold text-[#2C2C2C]">{r.va_name}</td>
                        <td className="px-4 py-3 text-xs text-[#2C2C2C]/55">{r.report_date}</td>
                        <td className="px-4 py-3 text-sm">{r.leads_found}</td>
                        <td className="px-4 py-3 text-sm">{r.contacts_made}</td>
                        <td className="px-4 py-3 text-sm">{r.replies}</td>
                        <td className="px-4 py-3 text-sm">{r.meetings_booked}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {adminSection === "profileReports" && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-4 py-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/50">
                  Total Reports
                </p>
                <p className="mt-1 font-serif text-2xl font-bold text-[#2C2C2C]">{profileReportsRows.length}</p>
              </div>
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-4 py-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/50">
                  Reports This Week
                </p>
                <p className="mt-1 font-serif text-2xl font-bold text-[#2C2C2C]">{profileReportsThisWeek}</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void fetchProfileReports()}
                className="rounded-full border border-[#2C2C2C]/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] shadow-sm hover:bg-[#FAF8F4]"
              >
                Refresh
              </button>
            </div>
            {profileReportsError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {profileReportsError}
              </div>
            ) : null}
            <div className="overflow-x-auto rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
              {profileReportsLoading ? (
                <div className="p-10 text-center text-sm text-[#2C2C2C]/45">Loading reports…</div>
              ) : profileReportsRows.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#2C2C2C]/45">No profile reports yet.</div>
              ) : (
                <table className="w-full min-w-[880px]">
                  <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                    <tr className="text-left text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/50">
                      <th className="px-4 py-3">Reporter</th>
                      <th className="px-4 py-3">Reported User</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2C2C2C]/5">
                    {profileReportsRows.map((r) => (
                      <tr key={r.id} className="align-top hover:bg-[#FAF8F4]/80">
                        <td className="px-4 py-3 text-sm font-semibold text-[#2C2C2C]">{r.reporter_name}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-[#2C2C2C]">{r.reported_name}</td>
                        <td className="max-w-[200px] px-4 py-3 text-sm text-[#2C2C2C]/85">{r.reason}</td>
                        <td className="max-w-[220px] px-4 py-3 text-sm text-[#2C2C2C]/70">
                          {r.notes?.trim() ? r.notes : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-[#2C2C2C]/55">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              disabled={profileReportBusyId === r.id}
                              onClick={() => void warnReportedUser(r)}
                              className="rounded-full bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                            >
                              {profileReportBusyId === r.id ? "…" : "Warn User"}
                            </button>
                            <button
                              type="button"
                              disabled={profileReportBusyId === r.id}
                              onClick={() => void dismissProfileReport(r.id)}
                              className="rounded-full border border-[#2C2C2C]/15 bg-white px-3 py-1.5 text-xs font-bold text-[#2C2C2C] hover:bg-[#FAF8F4] disabled:opacity-50"
                            >
                              {profileReportBusyId === r.id ? "…" : "Dismiss"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {adminSection === "credentials" && canSeeCredentials ? (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewCredentialOpen(true)}
                className="rounded-full bg-[#2C2C2C] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#6B9E6E]"
              >
                New Credential
              </button>
              <button
                type="button"
                onClick={() => void fetchCredentials()}
                className="rounded-full border border-[#2C2C2C]/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] shadow-sm hover:bg-[#FAF8F4]"
              >
                Refresh
              </button>
            </div>
            {credentialsError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {credentialsError}
              </div>
            ) : null}
            <div className="overflow-x-auto rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
              {credentialsLoading ? (
                <div className="p-10 text-center text-sm text-[#2C2C2C]/45">Loading…</div>
              ) : (
                <table className="w-full min-w-[640px]">
                  <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                    <tr className="text-left text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/50">
                      <th className="px-4 py-3">Service Name</th>
                      <th className="px-4 py-3">Username</th>
                      <th className="px-4 py-3">Password</th>
                      <th className="px-4 py-3">Monthly Cost</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2C2C2C]/5">
                    {credentialsRows.map((c) => (
                      <tr key={c.id} className="align-top hover:bg-[#FAF8F4]/80">
                        <td className="px-4 py-3 text-sm font-semibold text-[#2C2C2C]">
                          {editCredentialId === c.id ? (
                            <input
                              value={editCredentialForm.service_name}
                              onChange={(e) =>
                                setEditCredentialForm((f) => ({
                                  ...f,
                                  service_name: e.target.value,
                                }))
                              }
                              className="w-full rounded border border-[#2C2C2C]/10 px-2 py-1 text-sm"
                            />
                          ) : (
                            c.service_name
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#2C2C2C]/75">
                          {editCredentialId === c.id ? (
                            <input
                              value={editCredentialForm.username}
                              onChange={(e) =>
                                setEditCredentialForm((f) => ({ ...f, username: e.target.value }))
                              }
                              className="w-full rounded border border-[#2C2C2C]/10 px-2 py-1 text-sm"
                            />
                          ) : (
                            c.username || "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">
                              {editCredentialId === c.id
                                ? editCredentialForm.password_plain
                                : credentialPwdVisible[c.id]
                                  ? c.password_plain
                                  : "••••••••"}
                            </span>
                            {editCredentialId === c.id ? (
                              <input
                                type="text"
                                value={editCredentialForm.password_plain}
                                onChange={(e) =>
                                  setEditCredentialForm((f) => ({
                                    ...f,
                                    password_plain: e.target.value,
                                  }))
                                }
                                className="min-w-[120px] flex-1 rounded border border-[#2C2C2C]/10 px-2 py-1 text-sm"
                              />
                            ) : (
                              <button
                                type="button"
                                className="rounded p-1 text-[#2C2C2C]/55 hover:bg-[#2C2C2C]/10"
                                aria-label={credentialPwdVisible[c.id] ? "Hide password" : "Show password"}
                                onClick={() =>
                                  setCredentialPwdVisible((prev) => ({
                                    ...prev,
                                    [c.id]: !prev[c.id],
                                  }))
                                }
                              >
                                {credentialPwdVisible[c.id] ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editCredentialId === c.id ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editCredentialForm.monthly_cost}
                              onChange={(e) =>
                                setEditCredentialForm((f) => ({
                                  ...f,
                                  monthly_cost: e.target.value,
                                }))
                              }
                              className="w-28 rounded border border-[#2C2C2C]/10 px-2 py-1 text-sm"
                            />
                          ) : (
                            formatPesoMonthly(Number(c.monthly_cost ?? 0))
                          )}
                        </td>
                        <td className="max-w-[200px] px-4 py-3 text-xs text-[#2C2C2C]/75">
                          {editCredentialId === c.id ? (
                            <textarea
                              value={editCredentialForm.notes}
                              onChange={(e) =>
                                setEditCredentialForm((f) => ({ ...f, notes: e.target.value }))
                              }
                              rows={2}
                              className="w-full rounded border border-[#2C2C2C]/10 px-2 py-1 text-sm"
                            />
                          ) : (
                            c.notes ?? "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editCredentialId === c.id ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                disabled={credentialSaving}
                                onClick={() => void saveCredentialEdit()}
                                className="rounded-full bg-[#6B9E6E] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                disabled={credentialSaving}
                                onClick={() => setEditCredentialId(null)}
                                className="rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditCredentialId(c.id);
                                  setEditCredentialForm({
                                    service_name: c.service_name,
                                    username: c.username,
                                    password_plain: c.password_plain,
                                    monthly_cost: String(c.monthly_cost ?? 0),
                                    notes: c.notes ?? "",
                                  });
                                }}
                                className="rounded-full border border-[#2C2C2C]/15 bg-white px-3 py-1.5 text-xs font-semibold"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteCredential(c.id)}
                                className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="rounded-2xl border border-[#D4A843]/35 bg-[#FAF8F4] px-4 py-3 text-sm font-semibold text-[#2C2C2C]">
              Total monthly cost: {formatPesoMonthly(credentialsTotal)}
            </div>
          </div>
        ) : null}

        {adminSection === "manual" && canSeeManual ? (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">Owner&apos;s Manual</h2>
              <p className="mt-1 text-sm text-[#2C2C2C]/55">Internal operations reference for BahayGo.</p>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-[#2C2C2C]/10 pb-4">
              {MANUAL_SUB_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setManualSubTab(t.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    manualSubTab === t.id
                      ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                      : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {manualSubTab === "overview" ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
                  <p className="text-sm leading-relaxed text-[#2C2C2C]/85">
                    BahayGo is a Philippines-focused real estate marketplace that connects verified agents and
                    brokers with buyers and renters. It combines listings discovery, agent profiles, lead and
                    pipeline tools, and operational workflows so the team can run the platform end-to-end from one
                    stack.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Current monthly cost", value: "$32" },
                    { label: "Break-even", value: "4 agents" },
                    { label: "Stack", value: "Next.js + Supabase" },
                    { label: "Live URL", value: "bahaygo.com" },
                  ].map((c) => (
                    <div
                      key={c.label}
                      className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm"
                    >
                      <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">{c.label}</p>
                      <p className="mt-2 font-serif text-lg font-bold text-[#6B9E6E]">{c.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {manualSubTab === "services" ? (
              <div className="overflow-x-auto rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
                <table className="w-full min-w-[900px]">
                  <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                    <tr className="text-left text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/50">
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3">Purpose</th>
                      <th className="px-4 py-3">Current cost</th>
                      <th className="px-4 py-3">Login URL</th>
                      <th className="px-4 py-3">When to upgrade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2C2C2C]/5 text-sm text-[#2C2C2C]/85">
                    <tr className="hover:bg-[#FAF8F4]/80">
                      <td className="px-4 py-3 font-semibold text-[#2C2C2C]">Vercel</td>
                      <td className="px-4 py-3">Hosting and deployments for the web app.</td>
                      <td className="px-4 py-3">$0 (hobby)</td>
                      <td className="px-4 py-3">
                        <a
                          href="https://vercel.com/dashboard"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#6B9E6E] underline hover:text-[#5d8a60]"
                        >
                          vercel.com/dashboard
                        </a>
                      </td>
                      <td className="px-4 py-3">Upgrade to Pro ($20/mo) at ~100 agents.</td>
                    </tr>
                    <tr className="hover:bg-[#FAF8F4]/80">
                      <td className="px-4 py-3 font-semibold text-[#2C2C2C]">Supabase</td>
                      <td className="px-4 py-3">Database, auth, storage, and APIs.</td>
                      <td className="px-4 py-3">$0 (free tier)</td>
                      <td className="px-4 py-3">
                        <a
                          href="https://supabase.com/dashboard"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#6B9E6E] underline hover:text-[#5d8a60]"
                        >
                          supabase.com/dashboard
                        </a>
                      </td>
                      <td className="px-4 py-3">Upgrade to Pro ($25/mo) before public launch.</td>
                    </tr>
                    <tr className="hover:bg-[#FAF8F4]/80">
                      <td className="px-4 py-3 font-semibold text-[#2C2C2C]">Cloudinary</td>
                      <td className="px-4 py-3">Image hosting and transforms for listings.</td>
                      <td className="px-4 py-3">$0 (free)</td>
                      <td className="px-4 py-3">
                        <a
                          href="https://console.cloudinary.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#6B9E6E] underline hover:text-[#5d8a60]"
                        >
                          console.cloudinary.com
                        </a>
                      </td>
                      <td className="px-4 py-3">Upgrade when storage approaches 25 GB.</td>
                    </tr>
                    <tr className="hover:bg-[#FAF8F4]/80">
                      <td className="px-4 py-3 font-semibold text-[#2C2C2C]">Resend</td>
                      <td className="px-4 py-3">Transactional email delivery.</td>
                      <td className="px-4 py-3">$0 (free)</td>
                      <td className="px-4 py-3">
                        <a
                          href="https://resend.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#6B9E6E] underline hover:text-[#5d8a60]"
                        >
                          resend.com
                        </a>
                      </td>
                      <td className="px-4 py-3">Upgrade around 3,000 emails per month.</td>
                    </tr>
                    <tr className="hover:bg-[#FAF8F4]/80">
                      <td className="px-4 py-3 font-semibold text-[#2C2C2C]">Twilio</td>
                      <td className="px-4 py-3">SMS for notifications and alerts.</td>
                      <td className="px-4 py-3">Pay per SMS (~$0.01 each)</td>
                      <td className="px-4 py-3">
                        <a
                          href="https://console.twilio.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#6B9E6E] underline hover:text-[#5d8a60]"
                        >
                          console.twilio.com
                        </a>
                      </td>
                      <td className="px-4 py-3">Monitor usage as volume grows; fund account before sends fail.</td>
                    </tr>
                    <tr className="hover:bg-[#FAF8F4]/80">
                      <td className="px-4 py-3 font-semibold text-[#2C2C2C]">PayMongo</td>
                      <td className="px-4 py-3">Card payments for the product.</td>
                      <td className="px-4 py-3">$0 platform fee; 2.9% per transaction</td>
                      <td className="px-4 py-3">
                        <a
                          href="https://dashboard.paymongo.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#6B9E6E] underline hover:text-[#5d8a60]"
                        >
                          dashboard.paymongo.com
                        </a>
                      </td>
                      <td className="px-4 py-3">Scale with volume; watch failed payments and webhooks.</td>
                    </tr>
                    <tr className="hover:bg-[#FAF8F4]/80">
                      <td className="px-4 py-3 font-semibold text-[#2C2C2C]">Anthropic</td>
                      <td className="px-4 py-3">LLM API for AI-assisted features.</td>
                      <td className="px-4 py-3">Pay per token (~$5 credit lasts weeks at low usage)</td>
                      <td className="px-4 py-3">
                        <a
                          href="https://console.anthropic.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#6B9E6E] underline hover:text-[#5d8a60]"
                        >
                          console.anthropic.com
                        </a>
                      </td>
                      <td className="px-4 py-3">Add billing when usage or traffic increases.</td>
                    </tr>
                    <tr className="hover:bg-[#FAF8F4]/80">
                      <td className="px-4 py-3 font-semibold text-[#2C2C2C]">Namecheap</td>
                      <td className="px-4 py-3">Domain registration and DNS.</td>
                      <td className="px-4 py-3">~$15/year renewal</td>
                      <td className="px-4 py-3">
                        <a
                          href="https://www.namecheap.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#6B9E6E] underline hover:text-[#5d8a60]"
                        >
                          namecheap.com
                        </a>
                      </td>
                      <td className="px-4 py-3">Renew annually; enable auto-renew to avoid expiry.</td>
                    </tr>
                    <tr className="hover:bg-[#FAF8F4]/80">
                      <td className="px-4 py-3 font-semibold text-[#2C2C2C]">Google Workspace</td>
                      <td className="px-4 py-3">hiring@ and support@ mailboxes.</td>
                      <td className="px-4 py-3">~$12/mo</td>
                      <td className="px-4 py-3">
                        <a
                          href="https://admin.google.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#6B9E6E] underline hover:text-[#5d8a60]"
                        >
                          admin.google.com
                        </a>
                      </td>
                      <td className="px-4 py-3">Add seats as the team grows.</td>
                    </tr>
                    <tr className="hover:bg-[#FAF8F4]/80">
                      <td className="px-4 py-3 font-semibold text-[#2C2C2C]">GitHub</td>
                      <td className="px-4 py-3">Source control and CI/CD integration.</td>
                      <td className="px-4 py-3">$0 (free)</td>
                      <td className="px-4 py-3">
                        <a
                          href="https://github.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#6B9E6E] underline hover:text-[#5d8a60]"
                        >
                          github.com
                        </a>
                      </td>
                      <td className="px-4 py-3">Upgrade if private collaborators or advanced CI needed.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}

            {manualSubTab === "roles" ? (
              <div className="space-y-4">
                {[
                  {
                    title: "Admin",
                    who: "You (full platform access).",
                    can: [
                      "Manage users, listings, verification, leads, hiring, outreach, and reports.",
                      "Access credentials and internal operational tools.",
                    ],
                    cannot: [
                      "Cannot be replaced by non-admin roles for admin-only actions.",
                    ],
                  },
                  {
                    title: "Agent",
                    who: "Verified PRC agents who list and manage properties.",
                    can: [
                      "Create and publish listings, manage pipeline and leads, and coordinate viewings.",
                      "Appear on the marketplace and agent directory when approved.",
                    ],
                    cannot: [
                      "Cannot access admin-only areas or other agents' private dashboards without permission.",
                    ],
                  },
                  {
                    title: "Broker",
                    who: "Brokerage operators who manage teams of agents.",
                    can: [
                      "Oversee connected agents and teams under their brokerage where the product supports it.",
                    ],
                    cannot: [
                      "Cannot bypass admin-only controls or impersonate other users' accounts.",
                    ],
                  },
                  {
                    title: "Client",
                    who: "Buyers and renters using the marketplace.",
                    can: [
                      "Search properties, save and like listings, book viewings, and manage their profile.",
                    ],
                    cannot: [
                      "Cannot publish listings or access agent pipeline tools without an agent role.",
                    ],
                  },
                ].map((row) => (
                  <div
                    key={row.title}
                    className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm"
                  >
                    <h3 className="font-serif text-lg font-bold text-[#2C2C2C]">{row.title}</h3>
                    <p className="mt-1 text-sm text-[#2C2C2C]/55">{row.who}</p>
                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#6B9E6E]">Can</p>
                    <ul className="mt-0.5 list-disc space-y-1 pl-5 text-sm text-[#2C2C2C]/85">
                      {row.can.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Cannot</p>
                    <ul className="mt-0.5 list-disc space-y-1 pl-5 text-sm text-[#2C2C2C]/75">
                      {row.cannot.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}

            {manualSubTab === "pipeline" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-[#2C2C2C]">Deal flow</p>
                  <p className="mt-2 text-sm text-[#2C2C2C]/75">
                    Lead → Viewing → Offer → Reservation → Closed. Each stage should move only when the prior
                    prerequisites are satisfied and the agent has confirmed the next step with the client.
                  </p>
                </div>
                {[
                  {
                    stage: "Lead",
                    what: "New interest captured from the site, inquiry, or referral. Qualify budget, timeline, and property fit.",
                    docs: "None required unless you need KYC for internal notes; capture contact details in the CRM.",
                    notes: "Notifications: new lead to the assigned agent; reminders for follow-up if idle.",
                  },
                  {
                    stage: "Viewing",
                    what: "Scheduled property visit or virtual walkthrough. Confirm attendance and property access.",
                    docs: "Listing details, ID for building entry where required; agent may log viewing outcome.",
                    notes: "Notifications: viewing confirmations and reminders to client and agent.",
                  },
                  {
                    stage: "Offer",
                    what: "Buyer submits price and terms; agent negotiates with seller or listing side.",
                    docs: "Offer letter, proof of funds or financing intent, any counter-offer documentation.",
                    notes: "Notifications: offer submitted and status changes to the agent pipeline.",
                  },
                  {
                    stage: "Reservation",
                    what: "Holding deposit or reservation fee to secure the unit while contracts are finalized.",
                    docs: "Reservation agreement, payment receipt, developer or seller requirements for presale or resale.",
                    notes: "Notifications: payment received and reservation expiry reminders.",
                  },
                  {
                    stage: "Closed",
                    what: "Deal completes: sale or lease signed, handover or move-in as applicable.",
                    docs: "Final contract, deed or lease, tax and closing docs as required by jurisdiction.",
                    notes: "Notifications: closed-won updates; archive the deal for reporting.",
                  },
                ].map((s) => (
                  <div
                    key={s.stage}
                    className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm"
                  >
                    <h3 className="font-serif text-lg font-bold text-[#6B9E6E]">{s.stage}</h3>
                    <p className="mt-2 text-sm text-[#2C2C2C]/85">
                      <span className="font-semibold text-[#2C2C2C]">What happens: </span>
                      {s.what}
                    </p>
                    <p className="mt-2 text-sm text-[#2C2C2C]/85">
                      <span className="font-semibold text-[#2C2C2C]">Documents: </span>
                      {s.docs}
                    </p>
                    <p className="mt-2 text-sm text-[#2C2C2C]/85">
                      <span className="font-semibold text-[#2C2C2C]">Notifications: </span>
                      {s.notes}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {manualSubTab === "dailyOps" ? (
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold text-[#2C2C2C]">Daily checklist</p>
                <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-[#2C2C2C]/85">
                  <li>Review new signups in the admin panel and note anything suspicious.</li>
                  <li>Approve or follow up on pending agent or broker verifications.</li>
                  <li>Review VA and internal reports (outreach, leads, daily ops).</li>
                  <li>Check VA outreach numbers and follow-up cadence.</li>
                  <li>Monitor Twilio SMS spend and delivery errors.</li>
                  <li>Scan Vercel deployment logs for build or runtime errors.</li>
                </ol>
              </div>
            ) : null}

            {manualSubTab === "scale" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
                  <p className="text-sm leading-relaxed text-[#2C2C2C]/85">
                    Upgrade services before traffic spikes: move Vercel and Supabase to paid tiers when concurrent
                    users and database load grow. Hire when support and development work exceed founder capacity.
                    Incorporate when you need formal contracts, payroll, and investor-ready structure. Run paid ads
                    once conversion and unit economics are proven on organic traffic.
                  </p>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
                  <table className="w-full min-w-[480px]">
                    <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                      <tr className="text-left text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/50">
                        <th className="px-4 py-3">Threshold</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2C2C2C]/5 text-sm text-[#2C2C2C]/85">
                      <tr className="hover:bg-[#FAF8F4]/80">
                        <td className="px-4 py-3 font-semibold text-[#2C2C2C]">~10 agents</td>
                        <td className="px-4 py-3">Test monetization (pricing, tiers, payment flows).</td>
                      </tr>
                      <tr className="hover:bg-[#FAF8F4]/80">
                        <td className="px-4 py-3 font-semibold text-[#2C2C2C]">~50 agents</td>
                        <td className="px-4 py-3">Upgrade Vercel and Supabase for reliability and headroom.</td>
                      </tr>
                      <tr className="hover:bg-[#FAF8F4]/80">
                        <td className="px-4 py-3 font-semibold text-[#2C2C2C]">~100 agents</td>
                        <td className="px-4 py-3">Hire a junior developer or support contractor.</td>
                      </tr>
                      <tr className="hover:bg-[#FAF8F4]/80">
                        <td className="px-4 py-3 font-semibold text-[#2C2C2C]">~200 agents</td>
                        <td className="px-4 py-3">Raise prices or adjust tiers to match demand.</td>
                      </tr>
                      <tr className="hover:bg-[#FAF8F4]/80">
                        <td className="px-4 py-3 font-semibold text-[#2C2C2C]">~500 agents</td>
                        <td className="px-4 py-3">Series A territory: formalize team, legal, and fundraising.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {manualSubTab === "emergency" ? (
              <div className="space-y-4">
                {[
                  {
                    problem: "Site down or not loading",
                    fix: "Open the Vercel dashboard, check project status, recent deploys, and function logs. Confirm DNS at the registrar points to Vercel.",
                  },
                  {
                    problem: "Auth broken (sign-in or session errors)",
                    fix: "Check Supabase Auth logs and provider settings; verify redirect URLs and JWT expiry. Test a fresh login in an incognito window.",
                  },
                  {
                    problem: "Emails not sending",
                    fix: "Open Resend: domain verification, API keys, and recent delivery errors. Check spam suppression lists and from-address configuration.",
                  },
                  {
                    problem: "SMS not sending",
                    fix: "Check Twilio balance, phone number status, and error webhooks. Verify templates and country permissions.",
                  },
                  {
                    problem: "Payments failing",
                    fix: "Check PayMongo dashboard for failed charges and webhook delivery. Confirm endpoint URLs and signing secrets in production.",
                  },
                  {
                    problem: "Bad deploy needs rollback",
                    fix: "In Vercel, open the project → Deployments, promote a previous stable deployment, or redeploy from a known-good Git commit.",
                  },
                ].map((row) => (
                  <div
                    key={row.problem}
                    className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm"
                  >
                    <h3 className="font-serif text-base font-bold text-[#2C2C2C]">{row.problem}</h3>
                    <p className="mt-2 text-sm text-[#2C2C2C]/85">{row.fix}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {manualSubTab === "team" ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
                  <p className="text-sm leading-relaxed text-[#2C2C2C]/85">
                    BahayGo runs as a small operator-led team: the Owner sets product and holds privileged keys;
                    trusted operators use admin or scoped roles; VAs run outreach and reporting; developers ship
                    code outside the admin app. Manage access by Supabase profile role, GitHub permissions, and
                    shared SOPs so nobody gets more access than their job requires.
                  </p>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
                  <table className="w-full min-w-[720px]">
                    <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                      <tr className="text-left text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/50">
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Who</th>
                        <th className="px-4 py-3">Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2C2C2C]/5 text-sm text-[#2C2C2C]/85">
                      <tr className="hover:bg-[#FAF8F4]/80">
                        <td className="px-4 py-3 font-semibold text-[#2C2C2C]">Owner</td>
                        <td className="px-4 py-3">You (ron.business101@gmail.com)</td>
                        <td className="px-4 py-3">
                          Full access to everything, including Credentials and Manual tabs.
                        </td>
                      </tr>
                      <tr className="hover:bg-[#FAF8F4]/80">
                        <td className="px-4 py-3 font-semibold text-[#2C2C2C]">Co-Founder</td>
                        <td className="px-4 py-3">Trusted partner</td>
                        <td className="px-4 py-3">
                          Full admin access except Credentials (no service passwords or billing secrets in that tab).
                        </td>
                      </tr>
                      <tr className="hover:bg-[#FAF8F4]/80">
                        <td className="px-4 py-3 font-semibold text-[#2C2C2C]">VA Admin</td>
                        <td className="px-4 py-3">Virtual assistant lead</td>
                        <td className="px-4 py-3">
                          Outreach, VA Reports, and Hiring tabs only (no leads, properties, or user management).
                        </td>
                      </tr>
                      <tr className="hover:bg-[#FAF8F4]/80">
                        <td className="px-4 py-3 font-semibold text-[#2C2C2C]">Junior Dev</td>
                        <td className="px-4 py-3">Contractor or hire</td>
                        <td className="px-4 py-3">No admin panel access; works in GitHub and local codebase only.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
                  <h3 className="font-serif text-lg font-bold text-[#2C2C2C]">How to create roles in Supabase</h3>
                  <p className="mt-2 text-sm text-[#2C2C2C]/85">
                    For <span className="font-semibold text-[#2C2C2C]">Co-Founder</span> and{" "}
                    <span className="font-semibold text-[#2C2C2C]">VA Admin</span>, open the Supabase dashboard →
                    Table Editor → <span className="font-mono text-xs">profiles</span> → find the user row → set{" "}
                    <span className="font-mono text-xs">role</span> to{" "}
                    <span className="font-mono text-xs">co_founder</span> or{" "}
                    <span className="font-mono text-xs">va_admin</span> (must match how the app enforces admin
                    routes). Owner stays <span className="font-mono text-xs">admin</span> on the primary account.
                  </p>
                  <p className="mt-3 text-sm text-[#2C2C2C]/75">
                    Junior Dev: add them in GitHub with repo access only; do not set an admin-level profile role.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
                  <h3 className="font-serif text-lg font-bold text-[#2C2C2C]">Onboarding checklist (new team member)</h3>
                  <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[#2C2C2C]/85">
                    <li>Create their Google Workspace email (hiring@ / support@ namespace or a named inbox).</li>
                    <li>Add them to the GitHub repository with permissions matching their role (read vs write).</li>
                    <li>Create or invite their Supabase account if they need dashboard access (avoid sharing Owner).</li>
                    <li>Brief them on the standard operating procedure (SOP) for their scope.</li>
                  </ol>
                </div>
                <div className="rounded-2xl border border-red-200 bg-red-50/80 p-6 shadow-sm">
                  <h3 className="font-serif text-lg font-bold text-red-900">Never share with team members</h3>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-red-950/90">
                    <li>Supabase service role key</li>
                    <li>PayMongo secret key</li>
                    <li>Anthropic API key</li>
                    <li>Twilio auth token</li>
                    <li>Admin account password</li>
                  </ul>
                  <p className="mt-4 text-sm text-red-900/85">
                    Use environment variables on Vercel, rotate keys if exposed, and keep Owner-only access to
                    credential storage.
                  </p>
                </div>
              </div>
            ) : null}

            {manualSubTab === "legal" ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 shadow-sm">
                  <p className="font-serif text-base font-bold text-amber-950">
                    These are the legal risks that could shut you down.
                  </p>
                  <p className="mt-2 text-sm font-semibold text-amber-950/90">
                    Address High risk items before public launch.
                  </p>
                </div>
                <div className="space-y-4">
                  {LEGAL_MANUAL_ITEMS.map((item) => {
                    const riskClass =
                      item.risk === "High"
                        ? "border-red-200 bg-red-50 text-red-900"
                        : item.risk === "Medium"
                          ? "border-amber-200 bg-amber-50 text-amber-950"
                          : "border-emerald-200/80 bg-emerald-50 text-emerald-950";
                    const done = !!legalManualChecked[item.id];
                    const accordionOpen = !!legalManualAccordionOpen[item.id];
                    return (
                      <div
                        key={item.id}
                        className={`flex gap-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm ${
                          done ? "opacity-90" : ""
                        }`}
                      >
                        <div className="pt-0.5">
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0 rounded border-[#2C2C2C]/25 text-[#6B9E6E] focus:ring-[#6B9E6E]"
                            checked={done}
                            aria-label={`Mark ${item.title} as done`}
                            onChange={() =>
                              setLegalManualChecked((prev) => ({
                                ...prev,
                                [item.id]: !prev[item.id],
                              }))
                            }
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex flex-wrap items-center gap-2">
                              <h3 className="font-serif text-lg font-bold text-[#2C2C2C]">{item.title}</h3>
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${riskClass}`}
                              >
                                {item.risk} risk
                              </span>
                              {done ? (
                                <span className="rounded-full bg-[#6B9E6E]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900">
                                  Done
                                </span>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              aria-expanded={accordionOpen}
                              aria-controls={`legal-manual-howto-${item.id}`}
                              onClick={() =>
                                setLegalManualAccordionOpen((prev) => ({
                                  ...prev,
                                  [item.id]: !prev[item.id],
                                }))
                              }
                              className="shrink-0 rounded-full border border-[#2C2C2C]/10 bg-[#FAF8F4] p-1.5 text-[#2C2C2C]/70 transition hover:bg-[#eef1f6] hover:text-[#2C2C2C]"
                              title={accordionOpen ? "Hide how-to" : "Show how-to"}
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${accordionOpen ? "rotate-180" : ""}`}
                                aria-hidden
                              />
                            </button>
                          </div>
                          <p className="mt-2 text-sm text-[#2C2C2C]/80">{item.description}</p>
                          {accordionOpen ? (
                            <div
                              id={`legal-manual-howto-${item.id}`}
                              className="mt-4 rounded-xl border border-[#6B9E6E]/25 bg-[#FAF8F4]/80 px-4 py-3"
                            >
                              <p className="text-xs font-bold uppercase tracking-wide text-[#6B9E6E]">
                                How-to
                              </p>
                              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-[#2C2C2C]/85">
                                {item.steps.map((step, idx) => (
                                  <li key={idx}>{step}</li>
                                ))}
                              </ol>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
            </div>
          </main>
        </div>
      </div>

      {addApplicantOpen ? (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => !addApplicantSaving && setAddApplicantOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-add-applicant-title"
            className="relative z-[106] max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="admin-add-applicant-title" className="font-serif text-xl font-bold text-[#2C2C2C]">
                Add applicant
              </h2>
              <button
                type="button"
                disabled={addApplicantSaving}
                onClick={() => setAddApplicantOpen(false)}
                className="rounded-full p-2 text-[#2C2C2C]/55 hover:bg-[#2C2C2C]/10 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  First name
                  <input
                    type="text"
                    value={newApplicantForm.first_name}
                    onChange={(e) =>
                      setNewApplicantForm((f) => ({ ...f, first_name: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm text-[#2C2C2C]"
                    autoComplete="given-name"
                  />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  Last name
                  <input
                    type="text"
                    value={newApplicantForm.last_name}
                    onChange={(e) =>
                      setNewApplicantForm((f) => ({ ...f, last_name: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm text-[#2C2C2C]"
                    autoComplete="family-name"
                  />
                </label>
              </div>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Age
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={newApplicantForm.age}
                  onChange={(e) => setNewApplicantForm((f) => ({ ...f, age: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm text-[#2C2C2C]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Email
                <input
                  type="email"
                  value={newApplicantForm.email}
                  onChange={(e) => setNewApplicantForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm text-[#2C2C2C]"
                  autoComplete="email"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Notes
                <textarea
                  value={newApplicantForm.notes}
                  onChange={(e) => setNewApplicantForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm text-[#2C2C2C]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Status
                <select
                  value={newApplicantForm.status}
                  onChange={(e) =>
                    setNewApplicantForm((f) => ({ ...f, status: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                >
                  {APPLICANT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={addApplicantSaving}
                onClick={() => void submitNewApplicant()}
                className="rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#5d8a60] disabled:opacity-50"
              >
                {addApplicantSaving ? "Saving…" : "Submit"}
              </button>
              <button
                type="button"
                disabled={addApplicantSaving}
                onClick={() => setAddApplicantOpen(false)}
                className="rounded-full border border-[#2C2C2C]/15 bg-white px-5 py-2.5 text-sm font-semibold text-[#2C2C2C] hover:bg-[#FAF8F4] disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {newVaLeadOpen ? (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => !newVaLeadSaving && setNewVaLeadOpen(false)}
          />
          <div
            role="dialog"
            className="relative z-[106] max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">New outreach lead</h2>
              <button
                type="button"
                disabled={newVaLeadSaving}
                onClick={() => setNewVaLeadOpen(false)}
                className="rounded-full p-2 text-[#2C2C2C]/55 hover:bg-[#2C2C2C]/10"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-[#2C2C2C]/45 sm:col-span-2">
                Name *
                <input
                  value={newVaLeadForm.name}
                  onChange={(e) => setNewVaLeadForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-[#2C2C2C]/45">
                Role
                <input
                  value={newVaLeadForm.role}
                  onChange={(e) => setNewVaLeadForm((f) => ({ ...f, role: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-[#2C2C2C]/45">
                Phone
                <input
                  value={newVaLeadForm.phone}
                  onChange={(e) => setNewVaLeadForm((f) => ({ ...f, phone: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-[#2C2C2C]/45 sm:col-span-2">
                Email
                <input
                  type="email"
                  value={newVaLeadForm.email}
                  onChange={(e) => setNewVaLeadForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-[#2C2C2C]/45">
                Platform
                <input
                  value={newVaLeadForm.platform}
                  onChange={(e) => setNewVaLeadForm((f) => ({ ...f, platform: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-[#2C2C2C]/45 sm:col-span-2">
                Listing link
                <input
                  value={newVaLeadForm.listing_link}
                  onChange={(e) => setNewVaLeadForm((f) => ({ ...f, listing_link: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-[#2C2C2C]/45">
                Status
                <select
                  value={newVaLeadForm.status}
                  onChange={(e) => setNewVaLeadForm((f) => ({ ...f, status: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 bg-white px-3 py-2 text-sm"
                >
                  {VA_LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-[#2C2C2C]/45">
                Follow-up stage
                <input
                  value={newVaLeadForm.follow_up_stage}
                  onChange={(e) => setNewVaLeadForm((f) => ({ ...f, follow_up_stage: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-[#2C2C2C]/45">
                Messages sent
                <input
                  type="number"
                  min={0}
                  value={newVaLeadForm.messages_sent}
                  onChange={(e) =>
                    setNewVaLeadForm((f) => ({
                      ...f,
                      messages_sent: Number(e.target.value) || 0,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-[#2C2C2C]/45">
                Assigned to
                <input
                  value={newVaLeadForm.assigned_to}
                  onChange={(e) => setNewVaLeadForm((f) => ({ ...f, assigned_to: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-[#2C2C2C]/45 sm:col-span-2">
                Notes
                <textarea
                  value={newVaLeadForm.notes}
                  onChange={(e) => setNewVaLeadForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={newVaLeadSaving}
                onClick={() => void submitNewVaLead()}
                className="rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {newVaLeadSaving ? "Saving…" : "Save lead"}
              </button>
              <button
                type="button"
                disabled={newVaLeadSaving}
                onClick={() => setNewVaLeadOpen(false)}
                className="rounded-full border px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {submitReportOpen ? (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => !submitReportSaving && setSubmitReportOpen(false)}
          />
          <div
            role="dialog"
            className="relative z-[106] w-full max-w-md rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">Submit daily report</h2>
              <button
                type="button"
                disabled={submitReportSaving}
                onClick={() => setSubmitReportOpen(false)}
                className="rounded-full p-2 text-[#2C2C2C]/55 hover:bg-[#2C2C2C]/10"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="block text-xs font-bold text-[#2C2C2C]/45">
                VA name *
                <input
                  value={submitReportForm.va_name}
                  onChange={(e) => setSubmitReportForm((f) => ({ ...f, va_name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-[#2C2C2C]/45">
                Report date
                <input
                  type="date"
                  value={submitReportForm.report_date}
                  onChange={(e) => setSubmitReportForm((f) => ({ ...f, report_date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-bold text-[#2C2C2C]/45">
                  Leads found
                  <input
                    type="number"
                    min={0}
                    value={submitReportForm.leads_found}
                    onChange={(e) =>
                      setSubmitReportForm((f) => ({
                        ...f,
                        leads_found: Number(e.target.value) || 0,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-bold text-[#2C2C2C]/45">
                  Contacts made
                  <input
                    type="number"
                    min={0}
                    value={submitReportForm.contacts_made}
                    onChange={(e) =>
                      setSubmitReportForm((f) => ({
                        ...f,
                        contacts_made: Number(e.target.value) || 0,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-bold text-[#2C2C2C]/45">
                  Replies
                  <input
                    type="number"
                    min={0}
                    value={submitReportForm.replies}
                    onChange={(e) =>
                      setSubmitReportForm((f) => ({ ...f, replies: Number(e.target.value) || 0 }))
                    }
                    className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-bold text-[#2C2C2C]/45">
                  Meetings booked
                  <input
                    type="number"
                    min={0}
                    value={submitReportForm.meetings_booked}
                    onChange={(e) =>
                      setSubmitReportForm((f) => ({
                        ...f,
                        meetings_booked: Number(e.target.value) || 0,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-2 py-2 text-sm"
                  />
                </label>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitReportSaving}
                onClick={() => void submitVaReport()}
                className="rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {submitReportSaving ? "Submitting…" : "Submit"}
              </button>
              <button
                type="button"
                disabled={submitReportSaving}
                onClick={() => setSubmitReportOpen(false)}
                className="rounded-full border px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {newCredentialOpen && canSeeCredentials ? (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => !newCredentialSaving && setNewCredentialOpen(false)}
          />
          <div
            role="dialog"
            className="relative z-[106] w-full max-w-md rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">New credential</h2>
            <div className="mt-4 grid gap-3">
              <label className="block text-xs font-bold text-[#2C2C2C]/45">
                Service name *
                <input
                  value={newCredentialForm.service_name}
                  onChange={(e) =>
                    setNewCredentialForm((f) => ({ ...f, service_name: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-[#2C2C2C]/45">
                Username
                <input
                  value={newCredentialForm.username}
                  onChange={(e) =>
                    setNewCredentialForm((f) => ({ ...f, username: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-[#2C2C2C]/45">
                Password
                <input
                  value={newCredentialForm.password_plain}
                  onChange={(e) =>
                    setNewCredentialForm((f) => ({ ...f, password_plain: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-[#2C2C2C]/45">
                Monthly cost (PHP)
                <input
                  type="number"
                  step="0.01"
                  value={newCredentialForm.monthly_cost}
                  onChange={(e) =>
                    setNewCredentialForm((f) => ({ ...f, monthly_cost: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-[#2C2C2C]/45">
                Notes
                <textarea
                  value={newCredentialForm.notes}
                  onChange={(e) => setNewCredentialForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={newCredentialSaving}
                onClick={() => void submitNewCredential()}
                className="rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {newCredentialSaving ? "Saving…" : "Add"}
              </button>
              <button
                type="button"
                disabled={newCredentialSaving}
                onClick={() => setNewCredentialOpen(false)}
                className="rounded-full border px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {manageAgentsProperty ? (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={closeManageAgents}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-manage-agents-title"
            className="relative z-[106] max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="admin-manage-agents-title" className="font-serif text-xl font-bold text-[#2C2C2C]">
                Manage agents
              </h2>
              <button
                type="button"
                onClick={closeManageAgents}
                className="rounded-full p-2 text-[#2C2C2C]/55 hover:bg-[#2C2C2C]/10"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{manageAgentsProperty.location}</p>

            {manageAgentsError ? (
              <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-800">
                {manageAgentsError}
              </p>
            ) : null}

            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Connected agents</p>
              {manageAgentsLoading ? (
                <p className="mt-2 text-sm text-[#2C2C2C]/55">Loading…</p>
              ) : manageAgentsConnected.length === 0 ? (
                <p className="mt-2 text-sm text-[#2C2C2C]/55">None linked yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-[#2C2C2C]/10 rounded-xl border border-[#2C2C2C]/10">
                  {manageAgentsConnected.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-semibold text-[#2C2C2C]">{a.name}</span>
                        <span className="ml-2 text-xs text-[#2C2C2C]/55">{a.email}</span>
                      </div>
                      <button
                        type="button"
                        disabled={manageAgentsMutating}
                        onClick={() => void removePropertyAgent(a.id)}
                        className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-6 border-t border-[#2C2C2C]/10 pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Add approved agent</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={selectedAgentToAdd}
                  onChange={(e) => setSelectedAgentToAdd(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                >
                  <option value="">Select an agent…</option>
                  {manageAgentsAvailable.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name} ({opt.email})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={manageAgentsMutating || !selectedAgentToAdd || manageAgentsLoading}
                  onClick={() => void addPropertyAgent()}
                  className="rounded-full bg-[#6B9E6E] px-4 py-2 text-sm font-bold text-white hover:bg-[#5d8a60] disabled:opacity-50"
                >
                  Add Agent
                </button>
              </div>
              <p className="mt-2 text-xs text-[#2C2C2C]/50">
                Only agents with status <strong>approved</strong> and <strong>verified</strong> appear here.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {docReviewAgent ? (
        <div className="fixed inset-0 z-[109] flex items-center justify-center overflow-y-auto p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => closeDocReviewModal()}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-doc-review-title"
            className="relative z-[110] my-8 w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="admin-doc-review-title" className="font-serif text-xl font-bold text-[#2C2C2C]">
                Review documents
              </h2>
              <button
                type="button"
                onClick={() => closeDocReviewModal()}
                className="rounded-full p-2 text-[#2C2C2C]/55 hover:bg-[#2C2C2C]/10"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">
              <strong>{docReviewAgent.name}</strong> · {docReviewAgent.email}
            </p>

            {docReviewLoading ? (
              <p className="mt-6 text-sm text-gray-500">Loading documents…</p>
            ) : docReviewUrls ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                    Full PRC number (admin)
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-[#2C2C2C]">
                    {docReviewUrls.license_number || "—"}
                  </p>
                </div>

                {!docReviewUrls.has_documents ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    No documents uploaded yet
                  </p>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                        PRC license photo
                      </p>
                      {docReviewUrls.prc_signed_url ? (
                        docReviewUrls.prc_signed_url.toLowerCase().includes(".pdf") ? (
                          <a
                            href={docReviewUrls.prc_signed_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex rounded-lg border border-[#6B9E6E]/30 bg-[#6B9E6E]/10 px-4 py-2 text-sm font-semibold text-[#2C2C2C] underline"
                          >
                            Open PDF
                          </a>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={docReviewUrls.prc_signed_url}
                            alt="PRC license"
                            className="mt-2 max-h-64 w-full rounded-lg border border-gray-200 object-contain"
                          />
                        )
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">Could not load file.</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                        Selfie / live photo
                      </p>
                      {docReviewUrls.selfie_signed_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={docReviewUrls.selfie_signed_url}
                          alt="Selfie"
                          className="mt-2 max-h-64 w-full rounded-lg border border-gray-200 object-contain"
                        />
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">Could not load file.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                      Rejection reason
                    </label>
                    <select
                      value={docRejectReasonKey}
                      onChange={(e) => setDocRejectReasonKey(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 bg-white px-3 py-2 text-sm text-[#2C2C2C]"
                    >
                      <option value="">Select rejection reason…</option>
                      {DOC_REJECT_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    {docRejectReasonKey === "Other" ? (
                      <input
                        type="text"
                        value={docRejectOtherText}
                        onChange={(e) => setDocRejectOtherText(e.target.value)}
                        placeholder="Custom reason"
                        className="mt-2 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm text-[#2C2C2C]"
                      />
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                      Suspension reason
                    </label>
                    <select
                      value={docSuspendReasonKey}
                      onChange={(e) => setDocSuspendReasonKey(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 bg-white px-3 py-2 text-sm text-[#2C2C2C]"
                    >
                      <option value="">Select suspension reason…</option>
                      {DOC_SUSPEND_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    {docSuspendReasonKey === "Other" ? (
                      <input
                        type="text"
                        value={docSuspendOtherText}
                        onChange={(e) => setDocSuspendOtherText(e.target.value)}
                        placeholder="Custom reason"
                        className="mt-2 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm text-[#2C2C2C]"
                      />
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    disabled={docActionSaving}
                    onClick={() => void submitDocReviewDecision("approve")}
                    className="rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#5d8a60] disabled:opacity-50"
                  >
                    {docActionSaving ? "Saving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={docActionSaving}
                    onClick={() => void submitDocReviewDecision("reject")}
                    className="rounded-full border-2 border-red-300 bg-red-50 px-5 py-2.5 text-sm font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
                  >
                    {docActionSaving ? "Saving…" : "Reject"}
                  </button>
                  <button
                    type="button"
                    disabled={docActionSaving}
                    onClick={() => void submitDocReviewDecision("suspend")}
                    className="rounded-full border-2 border-red-600 bg-white px-5 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {docActionSaving ? "Saving…" : "Suspend"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-6 text-sm text-red-600">Could not load document data.</p>
            )}
          </div>
        </div>
      ) : null}

      {resetPasswordAgent ? (
        <div className="fixed inset-0 z-[107] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => {
              setResetPasswordAgent(null);
              setResetPasswordValue("");
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-reset-password-title"
            className="relative z-[108] w-full max-w-sm rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="admin-reset-password-title" className="font-serif text-lg font-bold text-[#2C2C2C]">
              Reset password
            </h2>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">
              New password for <strong>{resetPasswordAgent.name}</strong> ({resetPasswordAgent.email})
            </p>
            <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
              New password
              <input
                type="password"
                autoComplete="new-password"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                placeholder="Min. 8 characters"
              />
            </label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setResetPasswordAgent(null);
                  setResetPasswordValue("");
                }}
                className="rounded-full border border-[#2C2C2C]/15 px-4 py-2 text-sm font-semibold text-[#2C2C2C]/70"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetPasswordSaving || resetPasswordValue.length < 8}
                onClick={() => void submitResetPassword()}
                className="rounded-full bg-[#2C2C2C] px-5 py-2 text-sm font-bold text-white hover:bg-[#6B9E6E] disabled:opacity-50"
              >
                {resetPasswordSaving ? "Saving…" : "Update password"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editAgent ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => setEditAgent(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-edit-agent-title"
            className="relative z-[101] max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="admin-edit-agent-title" className="font-serif text-xl font-bold text-[#2C2C2C]">
                Edit agent
              </h2>
              <button
                type="button"
                onClick={() => setEditAgent(null)}
                className="rounded-full p-2 text-[#2C2C2C]/55 hover:bg-[#2C2C2C]/10"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-[#2C2C2C]/50">
              Updates <code className="rounded bg-[#FAF8F4] px-1">agents</code> and matching{" "}
              <code className="rounded bg-[#FAF8F4] px-1">profiles</code> (name, email, phone).
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Name
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Email
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Phone
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                License number
                <input
                  value={editForm.license_number}
                  onChange={(e) => setEditForm((f) => ({ ...f, license_number: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  Score
                  <input
                    type="number"
                    step="any"
                    value={editForm.score}
                    onChange={(e) => setEditForm((f) => ({ ...f, score: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                  />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  Closings
                  <input
                    type="number"
                    min={0}
                    value={editForm.closings}
                    onChange={(e) => setEditForm((f) => ({ ...f, closings: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                  />
                </label>
              </div>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Status
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                >
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                </select>
              </label>
              <p className="text-xs font-semibold text-[#2C2C2C]/55">
                Verified:{" "}
                <span className="text-[#6B9E6E]">
                  {editForm.status === "approved" ? "Yes" : "No"}
                </span>{" "}
                (synced from status in the database)
              </p>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Broker ID (UUID or empty)
                <input
                  value={editForm.broker_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, broker_id: e.target.value }))}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 font-mono text-xs text-[#2C2C2C]"
                />
              </label>
            </div>

            {editError ? (
              <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-800">
                {editError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditAgent(null)}
                className="rounded-full border border-[#2C2C2C]/15 px-4 py-2 text-sm font-semibold text-[#2C2C2C]/70"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={() => void saveEditAgent()}
                className="rounded-full bg-[#2C2C2C] px-5 py-2 text-sm font-bold text-white hover:bg-[#6B9E6E] disabled:opacity-50"
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
