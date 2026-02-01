import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";

export class CdkBedrockHttpApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda (bundled from TypeScript using esbuild)
    const chatLambda = new NodejsFunction(this, "ChatLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../src/lambdas/chat.ts"),
      handler: "handler",
      memorySize: 512,
      timeout: cdk.Duration.seconds(20),
      environment: {
        BEDROCK_REGION: this.region,
        MODEL_ID: "anthropic.claude-3-sonnet-20240229-v1:0",
      },
    });

    // Allow Lambda to invoke Bedrock models (start broad; tighten later)
    chatLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["*"],
      }),
    );

    // API Gateway REST API
    const api = new apigateway.RestApi(this, "BedrockApi", {
      restApiName: "bedrock-api",
      deployOptions: { stageName: "prod" },
    });

    // POST /chat → Lambda
    const chat = api.root.addResource("chat");
    chat.addMethod("POST", new apigateway.LambdaIntegration(chatLambda));

    // Print the URL after deploy
    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
    });
  }
}
