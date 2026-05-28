import type { PipelineStageId } from "@/components/dashboard/agent-pipeline-tab";

/** Active pipeline stages in order (matches desktop kanban). */
export const PIPELINE_STAGE_ORDER: PipelineStageId[] = [
  "lead",
  "viewing",
  "offer",
  "reservation",
  "closed",
];

export type AgentPipelineCardMenuKey =
  | "viewDocuments"
  | "messages"
  | "requestDocuments"
  | "sendOffer"
  | "createReservation"
  | "markClosed"
  | "markWon"
  | "markLost"
  | "agentArchive"
  | "declineArchive"
  | "moveTo";

export function getNextPipelineStage(stage: PipelineStageId): PipelineStageId | null {
  const i = PIPELINE_STAGE_ORDER.indexOf(stage);
  if (i < 0 || i >= PIPELINE_STAGE_ORDER.length - 1) return null;
  return PIPELINE_STAGE_ORDER[i + 1];
}

export function pipelineStageToastLabel(stage: PipelineStageId): string {
  if (stage === "lead") return "Inquiries";
  if (stage === "closed") return "Closed";
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

export function pipelineMoveToStageLabel(stage: PipelineStageId): string {
  if (stage === "lead") return "Inquiry";
  if (stage === "closed") return "Closed";
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

export function getAgentPipelineCardMenuKeys(stageRaw: string): Set<AgentPipelineCardMenuKey> {
  const s = String(stageRaw ?? "").trim().toLowerCase();
  if (s === "declined") {
    return new Set<AgentPipelineCardMenuKey>(["viewDocuments"]);
  }
  if (s === "closed") {
    return new Set<AgentPipelineCardMenuKey>(["viewDocuments", "messages", "markLost", "agentArchive"]);
  }
  if (s === "lead") {
    return new Set<AgentPipelineCardMenuKey>([
      "messages",
      "requestDocuments",
      "markWon",
      "markLost",
      "agentArchive",
      "declineArchive",
      "moveTo",
    ]);
  }
  if (s === "viewing") {
    return new Set<AgentPipelineCardMenuKey>([
      "viewDocuments",
      "messages",
      "requestDocuments",
      "markWon",
      "markLost",
      "agentArchive",
      "declineArchive",
      "moveTo",
    ]);
  }
  if (s === "offer") {
    return new Set<AgentPipelineCardMenuKey>([
      "viewDocuments",
      "messages",
      "requestDocuments",
      "createReservation",
      "markWon",
      "markLost",
      "agentArchive",
      "declineArchive",
      "moveTo",
    ]);
  }
  if (s === "reservation") {
    return new Set<AgentPipelineCardMenuKey>([
      "viewDocuments",
      "messages",
      "requestDocuments",
      "markClosed",
      "markLost",
      "agentArchive",
      "declineArchive",
      "moveTo",
    ]);
  }
  return getAgentPipelineCardMenuKeys("lead");
}

export const DECLINE_REASON_OPTIONS = [
  { key: "unavailable", label: "Property is no longer available" },
  { key: "mismatch", label: "Client requirements don't match" },
  { key: "no_response", label: "No response from client" },
  { key: "other", label: "Other" },
] as const;

export type DeclineReasonKey = (typeof DECLINE_REASON_OPTIONS)[number]["key"];

export const CLIENT_DOC_REQUEST_OPTIONS = [
  { key: "valid_id" as const, label: "Valid ID" },
  { key: "proof_of_funds" as const, label: "Proof of Funds" },
  { key: "visa" as const, label: "Visa Document" },
  { key: "other" as const, label: "Other" },
] as const;

export type ClientDocRequestKey = (typeof CLIENT_DOC_REQUEST_OPTIONS)[number]["key"];

export function defaultClientDocSelections(): Record<ClientDocRequestKey, boolean> {
  return { valid_id: false, proof_of_funds: false, visa: false, other: false };
}
