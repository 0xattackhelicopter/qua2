import { RequestHandler, Request, Response } from "express";
import { logger } from "../../utils/logger";
import {
  getDeploymentByDeploymentId as getCoreDeploymentById,
  getUserServiceDeployments as getCoreUserServiceDeployments,
  closeDeployment as performCoreCloseDeployment,
  createDeployment as executeCoreDeployment, // This is the modified one from deployments.ts
  // transformDeploymentData, // Not needed directly if core functions return transformed
} from "../../core/deployer/deployments/deployments";
import { z } from "zod";
import { handleUnifiedDeployment } from "../../core/deployer"; // For generic, non-template deployments
import { ProviderType, DeploymentTier, DeploymentConfig, DeploymentResult } from "../../core/types/deployments";
import { ServiceType } from "../../core/types/services"; // Ensure "AI_MODEL" is added to this type/enum
import { deploymentDb } from "../../core/deployer/deployments/db";
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { v4 as uuidv4 } from 'uuid'; // For API keys if not done in core

// Zod Schemas
const CreateGenericDeploymentSchema = z.object({ // Renamed for clarity
  service: z.nativeEnum(ServiceType), // Use your ServiceType enum
  tier: z.nativeEnum(DeploymentTier),
  provider: z.nativeEnum(ProviderType),
  config: z.object({
      appCpuUnits: z.number().optional(),
      appMemorySize: z.string().optional(),
      appPort: z.number().optional(),
      appStorageSize: z.string().optional(),
      deploymentDuration: z.string().optional(),
      image: z.string().optional(), // Required for generic if not repo-based
      repoUrl: z.string().url().optional(),
      branchName: z.string().optional(),
      env: z.record(z.string()).optional().default({}), // Ensure env is at least an empty object
      runCommands: z.string().optional(),
      // customName is not part of generic config, but could be added if needed
    }).passthrough() // Allow other fields if handleUnifiedDeployment expects more
    .optional(), // Config might be fully default based on service/tier
});

const DeployModelTemplateSchema = z.object({
  templateId: z.string().min(1, "templateId is required"),
  provider: z.nativeEnum(ProviderType),
  customName: z.string().optional(),
 });


const GetDeploymentsQuerySchema = z.object({ // For GET requests, use query params
  type: z.nativeEnum(ServiceType).optional(), // Use your ServiceType enum
  provider: z.nativeEnum(ProviderType).optional(),
});


const DeploymentIdParamSchema = z.object({
  deploymentId: z.string().regex(/^\d+$/, "Deployment ID must be a number").transform(Number),
});

const CloseDeploymentBodySchema = z.object({
  deploymentId: z.number().int().positive("Deployment ID must be a positive integer"),
});


// --- Controller for Generic Deployments (Non-Template) ---
export const createGenericDeploymentHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = CreateGenericDeploymentSchema.parse(req.body);
    const userId = req.user!.id;

    logger.info(`[CreateGenericCtrl] User ${userId} deploying generic service: ${validatedData.service}`);


    const result = await handleUnifiedDeployment(
      validatedData.service,
      validatedData.tier,
      userId,
      validatedData.provider,
      validatedData.config // This is the InputConfig for handleUnifiedDeployment
    );
    let finalAppUrl = result.appUrl;
    if (validatedData.service === ServiceType.AI_MODEL && (result as any).dbId) {
        const orchestratorBaseUrl = process.env.WEBHOOK_URL || `http://localhost:${process.env.WEBHOOK_PORT || 3080}`;
        finalAppUrl = `${orchestratorBaseUrl}/api/proxy-infer/${(result as any).dbId}`;
    }
    
    res.status(201).json({ ...result, appUrl: finalAppUrl });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.warn("[CreateGenericCtrl] Validation error:", error.errors);
      res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    logger.error(`[CreateGenericCtrl] Error in unified deployment: ${error.message}`, error.stack);
    res.status(500).json({ error: error.message || "Failed to create generic deployment" });
  }
};

// --- Controller for AI Model Template Deployments ---
export const deployModelFromTemplateHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const validatedData = DeployModelTemplateSchema.parse(req.body);
        const userId = req.user!.id;

        logger.info(`[DeployModelCtrl] User ${userId} deploying template: ${validatedData.templateId}, Provider: ${validatedData.provider}, Name: ${validatedData.customName}`);

        const templateFileName = `${validatedData.templateId}.${validatedData.provider.toLowerCase()}.yaml`;
        const modelTemplatesDir = path.join(process.cwd(), 'src/core/deployer/model-templates');
        const templateFilePath = path.join(modelTemplatesDir, templateFileName);
        
        let modelYamlString: string;
        try {
            modelYamlString = await fs.readFile(templateFilePath, 'utf8');
            logger.info(`[DeployModelCtrl] Loaded template: ${templateFileName}`);
        } catch (fileError) {
            logger.error(`[DeployModelCtrl] YAML template file not found: ${templateFilePath}`, fileError);
            res.status(400).json({ error: `Template '${validatedData.templateId}' for provider '${validatedData.provider}' not found.` });
            return;
        }

        const instanceMonitoringId = `mon-${uuidv4()}`;
        let finalYamlForProvider = modelYamlString;
        try {
            const modelConfigObj: any = yaml.load(modelYamlString);
            const serviceName = modelConfigObj?.services ? Object.keys(modelConfigObj.services)[0] : null;

            if (serviceName && modelConfigObj.services?.[serviceName]) {
                const serviceToModify = modelConfigObj.services[serviceName];
                if (!serviceToModify.env) serviceToModify.env = [];
                
                let envArray = serviceToModify.env;
                if (typeof envArray === 'object' && !Array.isArray(envArray)) {
                     const tempEnv: string[] = []; for (const [k,v] of Object.entries(envArray)) tempEnv.push(`${k}=${v}`); envArray = tempEnv;
                } else if (!Array.isArray(envArray)) envArray = [];

                envArray.push(`DEPLOYMENT_ID=${instanceMonitoringId}`);
                if (process.env.AQUANODE_MONITORING_WEBHOOK_ENDPOINT) {
                    envArray.push(`AQUANODE_MONITORING_WEBHOOK_ENDPOINT=${process.env.AQUANODE_MONITORING_WEBHOOK_ENDPOINT}`);
                }
                serviceToModify.env = envArray;
                finalYamlForProvider = yaml.dump(modelConfigObj);
                logger.info(`[DeployModelCtrl] Injected DEPLOYMENT_ID=${instanceMonitoringId} into YAML for service ${serviceName}`);
            } else {
                logger.warn(`[DeployModelCtrl] Could not find a service in YAML to inject monitoring env vars for ${templateFileName}. Using original for provider.`);
            }
        } catch (yamlError: any) {
            logger.error(`[DeployModelCtrl] Error processing YAML for template ${templateFileName}:`, yamlError);
            res.status(500).json({ error: `Invalid YAML structure in template ${validatedData.templateId}.`, details: yamlError.message });
            return;
        }
        
        const parsedForInfo: any = yaml.load(modelYamlString); // Use original for info parsing
        const serviceNameFromYamlForInfo = parsedForInfo?.services ? Object.keys(parsedForInfo.services)[0] : "ai-model";
        const serviceInfoFromYaml = serviceNameFromYamlForInfo && parsedForInfo?.services?.[serviceNameFromYamlForInfo] ? parsedForInfo.services[serviceNameFromYamlForInfo] : {};

        const deploymentConfigForCall: DeploymentConfig & { customName?: string } = {
            serviceType: ServiceType.AI_MODEL, // Make sure ServiceType.AI_MODEL exists
            image: serviceInfoFromYaml.image || `image-from-${validatedData.templateId}`,
            appPort: serviceInfoFromYaml.expose?.[0]?.port ? parseInt(serviceInfoFromYaml.expose[0].port) : 8000,
            appCpuUnits: serviceInfoFromYaml.profiles?.compute?.[serviceNameFromYamlForInfo!]?.resources?.cpu?.units,
            appMemorySize: serviceInfoFromYaml.profiles?.compute?.[serviceNameFromYamlForInfo!]?.resources?.memory?.size,
            appStorageSize: serviceInfoFromYaml.profiles?.compute?.[serviceNameFromYamlForInfo!]?.resources?.storage?.[0]?.size,
            env: {}, // Not injecting AQUANODE_API_KEY here; proxy handles auth. Other ENVs are in the model YAML.
            customName: validatedData.customName || validatedData.templateId,
            deploymentDuration: serviceInfoFromYaml.profiles?.placement?.duration || "permanent", // Get from YAML or default to permanent
            repoUrl: undefined,
            branchName: undefined
        };

        const resultFromCore = await executeCoreDeployment(
            userId,
            validatedData.provider,
            {
                ...deploymentConfigForCall,
                yamlContent: finalYamlForProvider
            }
        );

        if (!resultFromCore.dbId) {
            logger.error("[DeployModelCtrl] Core deployment successful but did not return a dbId.");
            throw new Error("Internal error: Deployment record ID missing after creation.");
        }
        const orchestratorBaseUrl = process.env.WEBHOOK_URL || `http://localhost:${process.env.WEBHOOK_PORT || 3080}`;
        const proxyAccessUrl = `${orchestratorBaseUrl}/api/proxy-infer/${resultFromCore.dbId}`;

        const finalResponseToUser: DeploymentResult = {
            message: `AI Model '${validatedData.customName || validatedData.templateId}' deployment initiated.`,
            appUrl: proxyAccessUrl,
            leaseId: resultFromCore.leaseId,
            provider: validatedData.provider,
            apiKey: resultFromCore.apiKey,
        };
        
        logger.info(`[DeployModelCtrl] Responding to user: ${JSON.stringify(finalResponseToUser)}`);
        res.status(201).json(finalResponseToUser);

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            logger.warn("[DeployModelCtrl] Validation error:", error.errors);
            res.status(400).json({ error: "Invalid request body", details: error.errors });
            return;
        }
        logger.error(`[DeployModelCtrl] Failed to deploy model from template: ${error.message}`, error.stack);
        res.status(500).json({ error: "Failed to deploy model from template.", details: error.message });
    }
};

// --- Existing Handlers (Adjusted for Clarity/Consistency) ---
export const getUserDeploymentsHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, provider } = GetDeploymentsQuerySchema.parse(req.query); // Get from query for GET request
    const userId = req.user!.id;
    logger.info(`[GetUserDeploymentsCtrl] User: ${userId}, Type: ${type}, Provider: ${provider}`);
    const result = await getCoreUserServiceDeployments(userId, type, provider);
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid query parameters", details: error.errors });
      return;
    }
    logger.error(`[GetUserDeploymentsCtrl] Error: ${error.message}`, error.stack);
    res.status(500).json({ error: error.message || "Failed to fetch deployments" });
  }
};

export const getDeploymentByIdHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deploymentId } = DeploymentIdParamSchema.parse(req.params);
    logger.info(`[GetDeploymentByIdCtrl] Requested DB ID: ${deploymentId}`);
    const deploymentRecord = await getCoreDeploymentById(deploymentId); // This now returns the raw DB record
    if (!deploymentRecord) {
        res.status(404).json({ error: "Deployment not found" });
        return;
    }
    // Transform for client, decide if API key should be exposed
    const clientResponse = {
        deploymentId: deploymentRecord.id,
        appUrl: deploymentRecord.app_url, // This is direct URL, proxy URL is for access
        proxyAccessUrl: `${process.env.WEBHOOK_URL || `http://localhost:${process.env.WEBHOOK_PORT || 3080}`}/api/proxy-infer/${deploymentRecord.id}`,
        createdAt: deploymentRecord.created_at,
        provider: deploymentRecord.provider,
        image: deploymentRecord.image,
        cpu: deploymentRecord.cpu,
        memory: deploymentRecord.memory,
        storage: deploymentRecord.storage,
        duration: deploymentRecord.duration,
        leaseId: deploymentRecord.lease_id,
        status: deploymentRecord.status,
        name: deploymentRecord.name,
        deploymentType: deploymentRecord.deployment_type,
        monitoringId: deploymentRecord.monitoring_id,
        // DO NOT return deploymentRecord.api_key here generally
    };
    res.json(clientResponse);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid deployment ID format", details: error.errors });
      return;
    }
    logger.error(`[GetDeploymentByIdCtrl] Error: ${error.message}`, error.stack);
    res.status(500).json({ error: error.message || "Failed to fetch deployment" });
  }
};

export const closeDeploymentHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = CloseDeploymentBodySchema.parse(req.body);
    const userId = req.user!.id; // Ensure only owner can close
    logger.info(`[CloseDeploymentCtrl] User ${userId} closing deployment DB ID: ${validatedData.deploymentId}`);

    // Optional: Check if the user owns this deployment before closing
    const deploymentToClose = await deploymentDb.getByDeploymentId(validatedData.deploymentId);
    if (!deploymentToClose) {
      res.status(404).json({ error: "Deployment not found." });
      return;
    }
    if (deploymentToClose.user !== userId) {
      res.status(403).json({ error: "Forbidden. You can only close your own deployments." });
      return;
    }

    await performCoreCloseDeployment(validatedData.deploymentId);
 

    res.json({ message: "Deployment closure initiated successfully." });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request data", details: error.errors });
      return;
    }
    logger.error(`[CloseDeploymentCtrl] Error: ${error.message}`, error.stack);
    res.status(500).json({ error: error.message || "Failed to close deployment" });
  }
};
