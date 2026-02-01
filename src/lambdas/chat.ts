/**
 * Import the AWS SDK client used to call Amazon Bedrock at runtime.
 * This is the “phone” Lambda uses to talk to the Bedrock service.
 */
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

/**
 * Minimal shape of the event coming from API Gateway.
 * API Gateway sends the HTTP request body as a STRING.
 */
type ApiGatewayEvent = { body?: string | null };

/**
 * Lambda entry point.
 * AWS always looks for a function named `handler`.
 */
export const handler = async (event: ApiGatewayEvent) => {
  /**
   * Read configuration from environment variables.
   * These are injected by CDK at deploy time.
   */
  const region = process.env.BEDROCK_REGION || "us-east-1";
  const modelId =
    process.env.MODEL_ID || "anthropic.claude-3-sonnet-20240229-v1:0";

  /**
   * Default prompt (used if the caller does not send one).
   */
  let prompt = "Hello from Bedrock!";

  /**
   * Safely parse the incoming request body.
   * We NEVER trust user input, so this is wrapped in try/catch.
   */
  try {
    if (event.body) {
      const parsed = JSON.parse(event.body);
      if (typeof parsed.prompt === "string") {
        prompt = parsed.prompt;
      }
    }
  } catch {
    // If JSON parsing fails, we silently fall back to the default prompt
  }

  /**
   * Create the Bedrock Runtime client.
   * This client will be used to invoke the foundation model.
   */
  const client = new BedrockRuntimeClient({ region });

  /**
   * Build the request body for Claude 3.
   *
   * IMPORTANT:
   * - anthropic_version is REQUIRED
   * - messages[].content MUST be an array of content blocks
   *   (not a plain string)
   */
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 200,
    temperature: 0.7,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });

  try {
    /**
     * Invoke the Bedrock model.
     * This sends the prompt to Claude and waits for a response.
     */
    const resp = await client.send(
      new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body,
      }),
    );

    /**
     * Bedrock returns a binary payload.
     * We must decode it into a string, then parse JSON.
     */
    const raw = JSON.parse(new TextDecoder().decode(resp.body));

    /**
     * Claude 3 returns structured content blocks.
     * We extract ONLY the text blocks and join them.
     */
    const text = Array.isArray(raw?.content)
      ? raw.content
          .filter(
            (block: any) =>
              block?.type === "text" && typeof block?.text === "string",
          )
          .map((block: any) => block.text)
          .join("")
      : "";

    /**
     * Successful HTTP response back to API Gateway.
     */
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        region,
        modelId,
        prompt,
        text,
      }),
    };
  } catch (err: any) {
    /**
     * If Bedrock invocation fails, log the full error
     * and return a 500 response for easier debugging.
     */
    console.error("Bedrock invoke failed:", err);

    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "Bedrock invoke failed",
        errorName: err?.name,
        errorMessage: err?.message,
      }),
    };
  }
};
