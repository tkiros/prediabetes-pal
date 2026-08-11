import { resolveModelTransportConfig } from "./openai-client";

export function getPalEnv(input: NodeJS.ProcessEnv = process.env): {
  environment: "preview" | "production" | "development" | "test";
  openAiApiKey: string;
  edgeConfigConnectionString?: string;
} {
  const environment = detectEnvironment(input);
  const openAiApiKey = input.OPENAI_API_KEY?.trim();

  if (!openAiApiKey) {
    throw new Error(
      `OPENAI_API_KEY is required for Prediabetes Pal ${environment} server use.`
    );
  }

  // Validate provider/model coherence at the same boundary health uses. A
  // present key is not "ready" when production would route to an unvalidated
  // compatible endpoint or use a provider-prefixed direct model id.
  resolveModelTransportConfig(input);

  const edgeConfigConnectionString = input.EDGE_CONFIG?.trim() || undefined;

  return edgeConfigConnectionString
    ? {
        environment,
        openAiApiKey,
        edgeConfigConnectionString
      }
    : {
        environment,
        openAiApiKey
      };
}

function detectEnvironment(
  input: NodeJS.ProcessEnv
): "preview" | "production" | "development" | "test" {
  if (input.NODE_ENV === "test") {
    return "test";
  }

  switch (input.VERCEL_ENV) {
    case "preview":
      return "preview";
    case "production":
      return "production";
    case "development":
      return "development";
    default:
      return input.NODE_ENV === "production" ? "production" : "development";
  }
}
