import Anthropic from "@anthropic-ai/sdk";

export function createClaudeClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing env: ANTHROPIC_API_KEY");
  return new Anthropic({ apiKey });
}
