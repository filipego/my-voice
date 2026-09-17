import type { Profile, VoiceRule } from "./profileEngine";

export interface CompiledSkill {
  name: string;
  version: number;
  markdown: string;
}

export function compileSkill(profile: Profile, name = "my-voice"): CompiledSkill {
  const approvedRules = profile.rules.filter((rule) => rule.state === "approved" || rule.state === "locked");
  const currentVersion = profile.currentVersion || 1;

  const body = [
    `# ${name}`,
    "",
    "Use these durable writing choices. Preserve task facts and explicit task instructions first.",
    "",
    "## Core voice",
    ...approvedRules.filter((rule) => rule.scope === "core").map((rule) => `- ${rule.instruction}`),
    "",
    "## Email",
    ...approvedRules.filter((rule) => rule.scope === "email").map((rule) => `- ${rule.instruction}`),
    "",
    "## Essay and plan",
    ...approvedRules
      .filter((rule) => rule.scope === "essay" || rule.scope === "plan")
      .map((rule) => `- ${rule.instruction}`),
    "",
    "## Anti-slop",
    "- Preserve meaning and supported facts.",
    "- Treat stylistic linter warnings as warnings, not commands.",
    "- Do not invent anecdotes, proof, rough edges, or numbers.",
  ].join("\n");

  return { name, version: currentVersion, markdown: body };
}

export function selectedRules(profile: Profile): VoiceRule[] {
  return profile.rules.filter((rule) => rule.state === "approved" || rule.state === "locked");
}
