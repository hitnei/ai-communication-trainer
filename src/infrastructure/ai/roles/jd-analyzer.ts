import { jdAnalysisSchema, type JdAnalysis } from "@/domain/profile/schema";
import { buildSystemPrompt, buildUserPrompt } from "../prompt/builder";
import { getAIProvider } from "../provider";
import type { AIProvider } from "../types";

export const JD_ANALYZER_PROMPT_VERSION = "jd-analyzer@1.0";

const ROLE_RULES = `You analyze a job description for a frontend/full-stack role and compare it against the candidate's profile and projects (§44, §74).

Extract the concrete requirements (technologies, responsibilities, behavioral and architecture expectations, seniority). For each requirement, judge how well the candidate matches based ONLY on the profile/projects given - do not invent skills the candidate hasn't shown. Use a non-judgmental scale: strong / medium (partial) / weak (a gap) / unknown (not enough info). Never use harsh language like "unqualified".

Give a brief, honest summary and an overall match status.`;

export interface AnalyzeJdInput {
  jdText: string;
  profileSummary: string;
  projectsSummary: string;
}

export async function analyzeJd(
  input: AnalyzeJdInput,
  provider: AIProvider = getAIProvider(),
): Promise<JdAnalysis> {
  const system = buildSystemPrompt(ROLE_RULES);
  const prompt = buildUserPrompt({
    roleRules: ROLE_RULES,
    userContext: `Candidate profile:\n${input.profileSummary}\n\nProjects:\n${input.projectsSummary}`,
    task: `Analyze this job description and compare it against the candidate:\n\n${input.jdText}`,
    outputContract: `Return ONLY JSON:
{
  "title": string,
  "company": string,
  "seniority": string,
  "summary": string,
  "overallStatus": "strong"|"medium"|"weak"|"unknown",
  "requirements": [ { "text": string, "category": "technical"|"responsibility"|"behavioral"|"architecture"|"other", "matchStatus": "strong"|"medium"|"weak"|"unknown", "note": string } ]
}`,
  });

  return provider.generateStructured(
    {
      system,
      prompt,
      schema: jdAnalysisSchema,
      schemaName: "JdAnalysis",
      temperature: 0.3,
    },
    { role: "jd-analyzer", promptVersion: JD_ANALYZER_PROMPT_VERSION },
  );
}
