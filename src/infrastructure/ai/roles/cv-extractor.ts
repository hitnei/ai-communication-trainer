import { cvExtractionSchema, type CvExtraction } from "@/domain/profile/schema";
import { buildSystemPrompt, buildUserPrompt } from "../prompt/builder";
import { getAIProvider } from "../provider";
import type { AIProvider } from "../types";

export const CV_EXTRACTOR_PROMPT_VERSION = "cv-extractor@1.0";

const ROLE_RULES = `You extract structured data from a pasted CV/résumé. Extract ONLY what is actually written - never invent roles, skills, projects, dates, or metrics (§43). If something isn't in the text, leave it empty. Your output is a draft the user will review and edit before saving; it is not authoritative (§42).`;

export async function extractCv(
  cvText: string,
  provider: AIProvider = getAIProvider(),
): Promise<CvExtraction> {
  const system = buildSystemPrompt(ROLE_RULES);
  const prompt = buildUserPrompt({
    roleRules: ROLE_RULES,
    task: `Extract structured data from this CV:\n\n${cvText}`,
    outputContract: `Return ONLY JSON:
{
  "currentRole": string,
  "yearsExperience": number|null,
  "primarySkills": string[],
  "secondarySkills": string[],
  "projects": [ { "name": string, "company": string, "role": string, "overview": string, "techStack": string[] } ]
}`,
  });

  return provider.generateStructured(
    {
      system,
      prompt,
      schema: cvExtractionSchema,
      schemaName: "CvExtraction",
      temperature: 0.2,
    },
    { role: "cv-extractor", promptVersion: CV_EXTRACTOR_PROMPT_VERSION },
  );
}
