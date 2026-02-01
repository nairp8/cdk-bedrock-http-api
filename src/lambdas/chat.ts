import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

type ApiGatewayEvent = { body?: string | null };

export const handler = async (event: ApiGatewayEvent) => {
  const region = process.env.BEDROCK_REGION || "us-east-1";
  const modelId =
    process.env.MODEL_ID || "anthropic.claude-3-sonnet-20240229-v1:0";

  let prompt = "Hello from Bedrock!";
  try {
    if (event.body) {
      const parsed = JSON.parse(event.body);
      if (typeof parsed.prompt === "string") prompt = parsed.prompt;
    }
  } catch {
    // ignore bad json
  }

  const client = new BedrockRuntimeClient({ region });

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 200,
    temperature: 0.7,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ],
  });

  try {
    const resp = await client.send(
      new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body,
      }),
    );

    const raw = JSON.parse(new TextDecoder().decode(resp.body));

    const text = Array.isArray(raw?.content)
      ? raw.content
          .filter((b: any) => b?.type === "text" && typeof b?.text === "string")
          .map((b: any) => b.text)
          .join("")
      : "";

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ region, modelId, prompt, text }),
    };
  } catch (err: any) {
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
