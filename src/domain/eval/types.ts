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
}

export interface RunRecord {
  role: EvalRole;
  promptVersion: string;
  model: string;
  startedAt: string;
  finishedAt: string;
  aborted: boolean;
  report: RoleReport;
  outcomes: CaseOutcome[];
}
