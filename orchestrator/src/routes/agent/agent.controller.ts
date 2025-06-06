import { Request, Response } from "express";
import axios from "axios";
import { z } from "zod";
import { logger } from "../../utils/logger";
import { createDeployment } from "../../core/deployer/deployments/deployments";
import { DeploymentConfig, ProviderType, SpheronDeploymentMode } from "../../core/types/deployments";
import {
    parseDeploymentRequest,
    isDeploymentRequest,
} from "../../core/deployer/deployments/deployment-parser";
import { DeploymentRequest } from "../../core/types/agent";
import { JupyterService } from "../../../aqua/jupyter";
import { getAvailableServiceTypes } from "../../core/services";

// Initialize Akash API client
const client = axios.create({
    baseURL: "https://chatapi.akash.network/api/v1",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AKASH_CHAT_API_KEY}`,
    },
});

// Get available service types for validation
const availableServiceTypes = getAvailableServiceTypes();

const ChatCompletionSchema = z.object({
    messages: z.array(
        z.object({
            role: z.string(),
            content: z.string(),
        })
    ),
    model: z.string().default("Meta-Llama-3-1-8B-Instruct-FP8"),
    stream: z.boolean().default(false),
    provider: z
        .enum([ProviderType.AKASH, ProviderType.SPHERON, ProviderType.AUTO])
        .default(ProviderType.AUTO),
    serviceType: z
        .enum(availableServiceTypes as [string, ...string[]])
        .default("BACKEND"),
});

function createSuccessMessage(parsedRequest: DeploymentRequest, serviceType: string) {
    return `Great news! Deployment successful. You'll see it in your portal in couple minutes.

${JSON.stringify({
    repoUrl: parsedRequest.repoUrl,
    branchName: parsedRequest.branchName,
    cpuUnits: parsedRequest.cpuUnits,
    memorySize: parsedRequest.memorySize,
    storageSize: parsedRequest.storageSize,
    provider: parsedRequest.provider,
    serviceType: serviceType,
})}

${
    serviceType === "JUPYTER"
        ? `Your notebook will show on your portal in couple seconds.`
        : `Your application will show on your portal in couple seconds.`
}`;
}

function createErrorMessage(errorMessage: string, serviceType: string) {
    return `I encountered an issue while trying to deploy your ${
        serviceType === "JUPYTER" ? "Jupyter Notebook" : "application"
    }.
    
<DEPLOYMENT_ERROR>
${JSON.stringify({
    error: errorMessage,
})}
</DEPLOYMENT_ERROR>

The error was: ${errorMessage}. Please check your repository and try again.`;
}

async function handleDeploymentCreation(
    userId: string,
    deploymentInfo: {
        repoUrl: string;
        branchName: string;
        cpuUnits: number;
        memorySize: string;
        storageSize: string;
        port: number;
        provider: ProviderType;
    },
    serviceType: string
): Promise<{
    success: boolean;
    message: string;
    appUrl?: string;
    accessUrl?: string;
    token?: string;
}> {
    try {
        if (serviceType === "JUPYTER") {
            const jupyterService = new JupyterService();
            const config: DeploymentConfig = jupyterService.getDefaultDeploymentConfig({
                appPort: 8888,
                spheronDeploymentMode: SpheronDeploymentMode.PROVIDER,
            });

            const deploymentResult = await createDeployment(
                userId,
                deploymentInfo.provider,
                config
            );

            return {
                success: true,
                message: `Jupyter Notebook created successfully. Your notebook will be available at ${deploymentResult.appUrl} once deployment is complete.`,
                appUrl: deploymentResult.appUrl,
                accessUrl: deploymentResult.accessUrl,
                token: deploymentResult.token,
            };
        } else {
            const deploymentResult = await createDeployment(
                userId,
                deploymentInfo.provider,
                {
                    serviceType,
                    appPort: deploymentInfo.port || 3000,
                    deploymentDuration: "1h",
                    appCpuUnits: deploymentInfo.cpuUnits,
                    appMemorySize: deploymentInfo.memorySize,
                    appStorageSize: deploymentInfo.storageSize,
                    repoUrl: deploymentInfo.repoUrl,
                    branchName: deploymentInfo.branchName,
                    env: {},
                }
            );

            return {
                success: true,
                message: `Deployment created successfully. Your application will be available at ${deploymentResult.appUrl} once deployment is complete.`,
                appUrl: deploymentResult.appUrl,
            };
        }
    } catch (error: any) {
        logger.error(`Error creating deployment: ${error.message}`);
        return {
            success: false,
            message: `Failed to create deployment: ${error.message}`,
        };
    }
}

const getSystemPrompt = () => ({
    role: "system",
    content: `You are an advanced AI assistant powered by Aquanode's decentralized compute infrastructure.
    You operate on a network of Aqua Nodes - distributed computing resources that ensure reliable, scalable, and decentralized processing power.
    Your responses should be helpful, accurate, and reflect your understanding of operating within this innovative decentralized system.
    
    You can assist users with deploying applications and Jupyter notebooks on our infrastructure.
    
    IMPORTANT GUIDELINES:
    - DO NOT mention performance limitations or network restrictions
    - DO NOT make up or predict URLs for the deployed application
    - NEVER include domain names like "aquanode.app" or similar in your responses
    - Keep your responses about deployments simple and direct
    - Only use the information provided to you by the system
    - Do not return any urls especially where final deployment is.
    
    Note: Resource limits - Max 4 CPUs, 2Gi RAM, 5Gi storage.`,
});

export class AgentController {
    static async handleChatCompletions(req: Request, res: Response) {
        try {
            const {
                messages,
                model,
                stream,
                provider,
                serviceType: initialServiceType,
            } = ChatCompletionSchema.parse(req.body);

            const lastUserMessage = messages.filter((m) => m.role === "user").pop();
            let serviceType = initialServiceType;
            let deploymentRequested = false;
            let deploymentInfo: DeploymentRequest | null = null;

            if (lastUserMessage && isDeploymentRequest(lastUserMessage.content)) {
                const parsedRequest = await parseDeploymentRequest(lastUserMessage.content);

                if (parsedRequest) {
                    deploymentRequested = true;
                    parsedRequest.provider = provider;

                    if (lastUserMessage.content.toLowerCase().includes("jupyter")) {
                        serviceType = "JUPYTER";
                    }

                    deploymentInfo = parsedRequest;

                    const processingMessage = {
                        role: "assistant",
                        content: `I'm preparing to deploy your ${
                            serviceType === "JUPYTER" ? "Jupyter Notebook" : "application"
                        } from ${parsedRequest.repoUrl}${
                            parsedRequest.branchName !== "main"
                                ? ` (branch: ${parsedRequest.branchName})`
                                : ""
                        } with the following resources:
    - ${parsedRequest.cpuUnits} CPU${parsedRequest.cpuUnits > 1 ? "s" : ""}
    - ${parsedRequest.memorySize} memory
    - ${parsedRequest.storageSize} storage
    - Port ${parsedRequest.port}
    - Provider: ${parsedRequest.provider}
                  
    ${JSON.stringify(parsedRequest)}
    
    Starting deployment process...`,
                    };

                    messages.push(processingMessage);

                    if (!stream) {
                        const deploymentResult = await handleDeploymentCreation(
                            req.user!.id,
                            parsedRequest,
                            serviceType
                        );

                        const deploymentResponseMessage = {
                            role: "assistant",
                            content: deploymentResult.success
                                ? createSuccessMessage(parsedRequest, serviceType)
                                : createErrorMessage(deploymentResult.message, serviceType),
                        };

                        return res.json({
                            text: deploymentResponseMessage.content,
                        });
                    }
                }
            }

            if (stream) {
                await AgentController.handleStreamResponse(
                    req,
                    res,
                    messages,
                    model,
                    deploymentRequested,
                    deploymentInfo,
                    serviceType
                );
            } else {
                await AgentController.handleNonStreamResponse(req, res, messages, model);
            }
        } catch (error: any) {
            logger.error(`Error in chat completion: ${error.message}`);
            res.status(500).json({
                error: "Failed to get chat completion",
                message: error.message,
            });
        }
    }

    private static async handleStreamResponse(
        req: Request,
        res: Response,
        messages: any[],
        model: string,
        deploymentRequested: boolean,
        deploymentInfo: DeploymentRequest | null,
        serviceType: string
    ) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const response = await client.post(
            "/chat/completions",
            {
                model,
                messages: [getSystemPrompt(), ...messages.filter((m) => m.role !== "system")],
                stream: true,
            },
            { responseType: "stream" }
        );

        response.data.on("data", (chunk: Buffer) => {
            const lines = chunk.toString().split("\n");
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const data = line.slice(6);
                    if (data === "[DONE]") {
                        if (deploymentRequested && deploymentInfo) {
                            AgentController.processDeployment(
                                req,
                                res,
                                deploymentInfo,
                                serviceType
                            );
                            return;
                        }
                        res.write("data: [DONE]\n\n");
                        return;
                    }

                    try {
                        JSON.parse(data);
                        res.write(`${line}\n\n`);
                    } catch (e) {
                        logger.error(
                            `Error parsing chunk: ${e}, invalid JSON data: ${data}`
                        );
                    }
                }
            }
        });

        response.data.on("error", (error: any) => {
            logger.error(`Stream error: ${error.message}`);
            res.end();
        });

        req.on("close", () => {
            response.data.destroy();
        });

        response.data.on("end", () => {
            if (!deploymentRequested) {
                res.end();
            }
        });
    }

    private static async handleNonStreamResponse(
        req: Request,
        res: Response,
        messages: any[],
        model: string
    ) {
        const response = await client.post("/chat/completions", {
            model,
            messages: [getSystemPrompt(), ...messages.filter((m) => m.role !== "system")],
        });

        const content = response.data.choices[0].message.content;
        res.json({ text: content });
    }

    private static async processDeployment(
        req: Request,
        res: Response,
        deploymentInfo: DeploymentRequest,
        serviceType: string
    ) {
        try {
            const result = await handleDeploymentCreation(
                req.user!.id,
                deploymentInfo,
                serviceType
            );

            const completionMessage = result.success
                ? `data: {"choices":[{"delta":{"content":"\\n\\n<DEPLOYMENT_COMPLETE>\\n${JSON.stringify(
                      {
                          repoUrl: deploymentInfo.repoUrl,
                          branchName: deploymentInfo.branchName,
                          cpuUnits: deploymentInfo.cpuUnits,
                          memorySize: deploymentInfo.memorySize,
                          storageSize: deploymentInfo.storageSize,
                          port: deploymentInfo.port,
                          provider: deploymentInfo.provider,
                          serviceType: serviceType,
                          appUrl: result.appUrl,
                          accessUrl: result.accessUrl,
                          token: result.token,
                      }
                  )}\\n</DEPLOYMENT_COMPLETE>\\n\\nDeployment successful! ${
                      serviceType === "JUPYTER"
                          ? `Your Jupyter Notebook is now available at ${
                                result.accessUrl || result.appUrl
                            }${
                                result.token ? "\\\\nToken: " + result.token : ""
                            }`
                          : `Your application is now available at ${result.appUrl}`
                  }"}}]}\n\n`
                : `data: {"choices":[{"delta":{"content":"\\n\\n<DEPLOYMENT_ERROR>\\n${JSON.stringify(
                      {
                          error: result.message,
                      }
                  )}\\n</DEPLOYMENT_ERROR>\\n\\nThe error was: ${
                      result.message
                  }. Please check your repository and try again."}}]}\n\n`;

            res.write(completionMessage);
            res.write("data: [DONE]\n\n");
            res.end();
        } catch (error: any) {
            logger.error("Error in async deployment:", error);
            res.write(
                `data: {"choices":[{"delta":{"content":"\\n\\nI encountered an error while trying to deploy your ${
                    serviceType === "JUPYTER"
                        ? "Jupyter Notebook"
                        : "application"
                }: ${error.message}"}}]}\n\n`
            );
            res.write("data: [DONE]\n\n");
            res.end();
        }
    }
} 