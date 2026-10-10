export const EVAL_ROLES = ["vietnamese-coach", "english-coach"] as const;
export type EvalRole = (typeof EVAL_ROLES)[number];

export const EVAL_ROLE_LABELS: Record<EvalRole, string> = {
  "vietnamese-coach": "Vietnamese Coach",
  "english-coach": "English Coach",
};

export function isEvalRole(value: string): value is EvalRole {
  return (EVAL_ROLES as readonly string[]).includes(value);
}

export interface CheckResult {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface ObservedIssue {
  category: string;
  code: string;
  evidence: string | null;
  naturalness: string | null;
  /** The model's own wording; absent on runs recorded before these were kept. */
  title?: string;
  detail?: string;
}

export interface ObservedFeedback {
  summary: string;
  issues: ObservedIssue[];
  improvedVersion: string | null;
}

export interface CaseOutcome {
  id: string;
  input: string;
  pass: boolean;
  checks: CheckResult[];
  observed?: ObservedFeedback;
  error?: string;
}

export interface RoleReport {
  role: string;
  promptVersion: string;
  passRate: number;
  passed: number;
  total: number;
  errors: number;
  cases: Record<string, boolean>;
  /** Set when stored as a baseline, so the timeline can mark that run. */
  runId?: string;
}

export interface PromptSection {
  title: string;
  text: string;
}

export interface PromptSnapshot {
  hash: string;
  sections: PromptSection[];
}

export interface ProbeAttempt {
  pass: boolean;
  failures: CheckResult[];
  observed?: ObservedFeedback;
  error?: string;
}

/** Repeated runs of one failing case on an unchanged prompt, to tell noise from a real weakness. */
export interface CaseProbe {
  caseId: string;
  ranAt: string;
  attempts: ProbeAttempt[];
}

/** Tokens as billed: output includes thinking ("thoughts") tokens separately. */
export interface TokenUsage {
  calls: number;
  promptTokens: number;
  outputTokens: number;
  thoughtsTokens: number;
}

export type AbortReason = "quota" | "budget";

export interface RunRecord {
  id: string;
  role: EvalRole;
  promptVersion: string;
  model: string;
  startedAt: string;
  finishedAt: string;
  aborted: boolean;
  abortReason?: AbortReason;
  /** Measured from the provider; absent on runs recorded before metering. */
  usage?: TokenUsage;
  costUsd?: number;
  probes?: CaseProbe[];
  probeUsage?: TokenUsage;
  probeCostUsd?: number;
  /** The exact prompt text this run measured. */
  prompt: PromptSnapshot;
  /** Free-text "what I changed and why", written by the user. */
  note: string;
  /** Seeded from a run saved before history existed. */
  backfilled?: boolean;
  report: RoleReport;
  outcomes: CaseOutcome[];
}
