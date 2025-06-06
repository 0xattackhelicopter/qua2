import { logger } from "../../../utils/logger";
import { deploymentDb } from "./db";
import { SpheronProvider } from "../../providers/spheron";
import { AkashProvider } from "../../providers/akash";
import {
  DeploymentConfig,
  DeploymentResult,
  ProviderType,
  SpheronDeploymentMode, // Make sure this is exported from types if used in DeploymentConfig
} from "../../types/deployments";
import { ServiceType } from "../../types/services";
import * as fs from "fs"; // Node.js fs for readFileSync
import * as path from "path";
import { deductDeploymentCredits } from "../../credits-service";
import { v4 as uuidv4 } from 'uuid';
import { Deployment, DeploymentAppConfigSnapshot } from "../../types/db"; // Import the full Deployment type

const PROJECT_ROOT = path.resolve(process.cwd());
const RELATIVE_TEMPLATE_PATH = path.join(
  PROJECT_ROOT,
  "src/core/providers/templates/"
);

function selectProvider(provider: ProviderType): ProviderType {
  logger.info(`[selectProvider] Input provider: ${provider}`);
  if (provider === ProviderType.AKASH || provider === ProviderType.SPHERON) {
    return provider;
  }
  logger.warn(`[selectProvider] Provider was '${provider}', defaulting to ${ProviderType.AKASH}.`);
  return ProviderType.AKASH;
}

export async function createDeployment(
  userId: string,
  provider: ProviderType,
  config: DeploymentConfig & { customName?: string }, // For AI models, customName comes from controller
  rawSdlOrModelYamlOverride?: string | null
): Promise<DeploymentResult & { dbId?: number }> {
  try {
    // For this phase (no autoscaling), every call is a new "parent" logical service.
    const creditsDeductedSuccessfully = await deductDeploymentCredits(userId);
    if (!creditsDeductedSuccessfully) {
      throw new Error("Insufficient credits to create deployment");
    }

    const selectedProvider = selectProvider(provider);
    logger.info(`[createDeployment] User: ${userId}, Selected provider: ${selectedProvider}`);

    const apiKeyForService = `aq-${uuidv4()}`;
    logger.info(`[createDeployment] Generated API Key: ${apiKeyForService.substring(0,12)}...`);

    const instanceMonitoringId = `mon-${uuidv4()}`;
    let deploymentYamlToSendToProvider: string;
    let appConfigSnapshotForDb: DeploymentAppConfigSnapshot | null = null;


    if (rawSdlOrModelYamlOverride) {
      logger.info(`[createDeployment] Using provided raw YAML/SDL for provider ${selectedProvider}.`);
          deploymentYamlToSendToProvider = rawSdlOrModelYamlOverride;
        } else {
      logger.info(`[createDeployment] Generating YAML from generic template using DeploymentConfig for provider ${selectedProvider}.`);
      deploymentYamlToSendToProvider = generateDeploymentYaml(config, selectedProvider, instanceMonitoringId);
        appConfigSnapshotForDb = {
        serviceType: config.serviceType,
        appCpuUnits: config.appCpuUnits ?? 1,
        appMemorySize: config.appMemorySize ?? '512Mi',
        appPort: config.appPort ?? 80,
        appStorageSize: config.appStorageSize ?? '1Gi',
        deploymentDuration: config.deploymentDuration ?? '1h',
        image: config.image || 'default/image',
        repoUrl: config.repoUrl,
        branchName: config.branchName,
        env: config.env,
        runCommands: config.runCommands,
        spheronDeploymentMode: config.spheronDeploymentMode,
      };
    }

    logger.debug(`[createDeployment] Final YAML for provider ${selectedProvider}:\n${deploymentYamlToSendToProvider.substring(0, 400)}...`);

    let deploymentResultFromProvider;
    if (selectedProvider === ProviderType.AKASH) {
      const akashProvider = new AkashProvider(ProviderType.AKASH);
      deploymentResultFromProvider = await akashProvider.createDeployment(deploymentYamlToSendToProvider);
    } else if (selectedProvider === ProviderType.SPHERON) {
      const spheronProvider = new SpheronProvider("mainnet");
      deploymentResultFromProvider = await spheronProvider.createDeployment(deploymentYamlToSendToProvider);
    } else {
      logger.error(`[createDeployment] Invalid provider selected: ${selectedProvider}`);
      throw new Error("Invalid provider selected");
    }

    logger.info(`[createDeployment] Provider response: LeaseID ${deploymentResultFromProvider.leaseId}, Direct AppURL ${deploymentResultFromProvider.appUrl}`);

    const dbRecordData: Partial<Deployment> = {
      user: userId,
      lease_id: deploymentResultFromProvider.leaseId,
      app_url: deploymentResultFromProvider.appUrl || `http://pending-url.com/${deploymentResultFromProvider.leaseId}`,
      provider: selectedProvider,
      api_key: apiKeyForService,
      monitoring_id: instanceMonitoringId,
      deployment_type: config.serviceType.toLowerCase(),
      name: config.customName || (rawSdlOrModelYamlOverride ? `${config.serviceType.toLowerCase()}-from-template` : `generic-${uuidv4().substring(0,6)}`),
      status: "creating",
      image: config.image,
      cpu: config.appCpuUnits,
      memory: config.appMemorySize,
      storage: config.appStorageSize,
      duration: config.deploymentDuration,
      created_at: new Date().toISOString(),
      parentDeploymentId: null, // Not a replica
      isReplica: false,          // Not a replica
      autoscaling_enabled: false, // Default to false for now
      min_replicas: 1,
      max_replicas: 1,            // No autoscaling by default
      app_config_snapshot: appConfigSnapshotForDb, // Null for raw YAML deployments
    };

    const deploymentRecordInDb = await deploymentDb.create(dbRecordData);
    logger.info(`[createDeployment] Stored deployment in DB with ID: ${deploymentRecordInDb.id}`);

    const resultForController: DeploymentResult & { dbId?: number } = {
      message: "Deployment initiated with provider successfully.",
      appUrl: deploymentResultFromProvider.appUrl || '',
      leaseId: deploymentResultFromProvider.leaseId,
      provider: selectedProvider,
      apiKey: apiKeyForService,
      dbId: deploymentRecordInDb.id,
      token: (deploymentResultFromProvider as any).token,
      accessUrl: (deploymentResultFromProvider as any).accessUrl,
    };
    return resultForController;

  } catch (error: any) {
    logger.error("[createDeployment] Error:", error);
    logger.error("[createDeployment] Traceback:", error.stack || "No stack trace available");
    throw new Error(`Failed to create deployment: ${error.message}`);
  }
}

function generateDeploymentYaml(
  config: DeploymentConfig,
  provider: ProviderType,
  monitoringId: string // This is the instance's monitoring ID
): string {
  // Environment variables common to generic templates
  let envVarsToInject: Record<string, string | undefined> = {
    REPO_URL: config.repoUrl || undefined, // Use undefined if null/empty for cleaner YAML
    BRANCH_NAME: config.branchName || undefined,
    AQUANODE_WEBHOOK_ENDPOINT: process.env.AQUANODE_MONITORING_WEBHOOK_ENDPOINT || undefined,
    DEPLOYMENT_ID: monitoringId, // For monitoring agent
    ...config.env,
  };

  if (config.runCommands) {
    envVarsToInject.RUN_COMMANDS = config.runCommands;
  }

  // Filter out undefined values before creating YAML string
  const filteredEnvVars = Object.entries(envVarsToInject)
    .filter(([_key, value]) => value !== undefined)
    .reduce((obj, [key, value]) => {
      obj[key] = value as string; // Assert value is string after filter
      return obj;
    }, {} as Record<string, string>);

  const envVarsYaml = Object.entries(filteredEnvVars)
    .map(([key, value]) => `      - ${key}=${value}`)
    .join("\n");

  const getTemplateContent = (templateName: string): string => {
    const templatePath = path.join(RELATIVE_TEMPLATE_PATH, templateName);
    if (!fs.existsSync(templatePath)) {
      logger.error(`Template file not found: ${templatePath}`);
      throw new Error(`Template file ${templateName} not found at ${templatePath}`);
    }
    return fs.readFileSync(templatePath, "utf8");
  };

  if (provider === ProviderType.AKASH) {
    const templateContent = getTemplateContent("akash-template.yaml");
    const appAmount = 1000; // Default for generic Akash

    return templateContent
      .replace(/image: USER_APP_IMAGE/, `image: ${config.image || 'default/image'}`)
      .replace(/port: APP_PORT/, `port: ${config.appPort || 80}`)
      .replace(/as: APP_PORT_AS/, `as: ${config.appPort || 80}`)
      .replace(/units: APP_CPU/, `units: ${config.appCpuUnits || 1}`)
      .replace(/size: APP_MEMORY/, `size: ${config.appMemorySize || '512Mi'}`)
      .replace(/size: APP_STORAGE/, `size: ${config.appStorageSize || '1Gi'}`)
      .replace(/amount: APP_AMOUNT/, `amount: ${appAmount}`)
      .replace(
        /env: APP_ENV_VARS/,
        envVarsYaml ? `env:\n${envVarsYaml}` : "env: []"
      );
  } else if (provider === ProviderType.SPHERON) {
    const templateContent = getTemplateContent("spheron-template.yaml");
     return templateContent
      .replace(/image: USER_APP_IMAGE/, `image: ${config.image || 'default/image'}`)
      .replace(/port: APP_PORT/, `port: ${config.appPort || 80}`)
      .replace(/as: APP_PORT_AS/, `as: ${config.appPort || 80}`)
      // .replace(/port: MONITOR_PORT/, `port: ${MONITOR_PORT}`) // Assuming monitor is part of generic template
      // .replace(/as: MONITOR_PORT_AS/, `as: ${MONITOR_PORT_AS}`)
      .replace(/mode: MODE/, `mode: ${config.spheronDeploymentMode || SpheronDeploymentMode.FIZZ}`)
      .replace(/duration: DURATION/, `duration: ${config.deploymentDuration || '1h'}`)
      .replace(/units: APP_CPU/, `units: ${config.appCpuUnits || 1}`)
      .replace(/size: APP_MEMORY/, `size: ${config.appMemorySize || '512Mi'}`)
      .replace(/size: APP_STORAGE/, `size: ${config.appStorageSize || '1Gi'}`)
       .replace(
        /env: APP_ENV_VARS/,
        envVarsYaml ? `env:\n${envVarsYaml}` : "env: []"
      );
  } else {
    logger.error(`[generateDeploymentYaml] Incorrect Provider Selected: ${provider}`);
    throw new Error("Incorrect Provider Selected for YAML generation");
  }
}

export async function closeDeployment(deploymentDbId: number): Promise<void> {
  logger.info(`[closeDeployment] Attempting to close deployment with DB ID: ${deploymentDbId}`);
  const deployment = await deploymentDb.getByDeploymentId(deploymentDbId);

  if (!deployment) {
    logger.error(`[closeDeployment] Deployment with DB ID ${deploymentDbId} not found.`);
    throw new Error("Deployment not found in DB to close.");
  }

  // If it's already marked as closed or terminated, perhaps just log and exit
  if (deployment.status === 'closed' || deployment.status === 'terminated' || deployment.status === 'closed_by_user' || deployment.status === 'closed_no_lease') {
      logger.info(`[closeDeployment] Deployment DB ID ${deploymentDbId} is already in a closed/terminated state: ${deployment.status}. No action needed on provider.`);
      return;
  }

  if (!deployment.lease_id) {
    logger.warn(`[closeDeployment] Lease ID not found for deployment DB ID ${deploymentDbId}. Marking as closed locally.`);
    await deploymentDb.updateByDeploymentId(deploymentDbId, { status: 'closed_no_lease', app_url: '' });
    return;
  }

  const leaseId = deployment.lease_id;
  const selectedProvider = deployment.provider as ProviderType;
  logger.info(`[closeDeployment] Closing Lease ID: ${leaseId} on provider: ${selectedProvider} for DB ID: ${deploymentDbId}`);

  try {
    if (selectedProvider === ProviderType.AKASH) {
      const akashProvider = new AkashProvider(ProviderType.AKASH);
      await akashProvider.closeDeployment(leaseId);
    } else if (selectedProvider === ProviderType.SPHERON) {
      const spheronProvider = new SpheronProvider("mainnet");
      await spheronProvider.closeDeployment(leaseId);
    } else {
      throw new Error(`Invalid provider: ${selectedProvider} for closing deployment ${deploymentDbId}`);
    }
    logger.info(`[closeDeployment] Successfully initiated closure for Lease ID: ${leaseId} on provider.`);
      await deploymentDb.updateByDeploymentId(deploymentDbId, { status: 'closed', app_url: '' });
  } catch (error: any) {
    logger.error(`[closeDeployment] Error closing Lease ID ${leaseId} on provider: ${error.message}`);
    await deploymentDb.updateByDeploymentId(deploymentDbId, { status: 'error_closing' });
    throw error;
  }
}

export async function getUserDeployments(
  userId: string,
  type: ServiceType | null = null,
  sortByTime: boolean = true,
  provider: ProviderType | null = null
) {
  logger.info(
    `[getUserDeployments] User: ${userId}, Type: ${type}, SortByTime: ${sortByTime}, Provider: ${provider}`
  );
  try {
    const deploymentsFromDb = await deploymentDb.getByUser(
      userId,
      type,
      sortByTime,
      provider as string | null // Cast because db function might expect string
    );
    return {
      userId,
      // Ensure a consistent transformation/filtering if needed before returning
      deployments: deploymentsFromDb.map(transformDeploymentData), // Apply transformation here
    };
  } catch (error: any) {
    logger.error(`[getUserDeployments] Error fetching user deployments: ${error.message}`);
    throw new Error(`Failed to fetch user deployments: ${error.message}`);
  }
}

export async function hasReachedDeploymentLimit(userId: string): Promise<boolean> {
  try {
    // Filter out deployments that are already closed/terminated when checking limit
    const activeDeployments = (await deploymentDb.getByUser(userId, null, false, null))
        .filter(d => d.status !== 'closed' && d.status !== 'terminated' && d.status !== 'error' && d.status !== 'closed_by_user' && d.status !== 'closed_no_lease' && d.status !== 'error_closing');
    
    const limit = parseInt(process.env.MAX_DEPLOYMENTS || "2"); // Default to 2 if not set
    logger.info(`[hasReachedDeploymentLimit] User ${userId} has ${activeDeployments.length} active deployments. Limit is ${limit}.`);
    return activeDeployments.length >= limit;
  } catch (error: any) {
    logger.error(`[hasReachedDeploymentLimit] Error checking: ${error.message}`);
    return false; // Fail open
  }
}

function transformDeploymentData(instance: Deployment): any { // Use imported Deployment type
   return {
    deploymentId: instance.id,
    appUrl: instance.app_url, // This is the DIRECT URL. Proxy URL is constructed by controller.
    createdAt: instance.created_at,
    provider: instance.provider,
    image: instance.image,
    cpu: instance.cpu,
    memory: instance.memory,
    storage: instance.storage,
    duration: instance.duration,
    leaseId: instance.lease_id,
    status: instance.status, // Add status
    name: instance.name,     // Add name
    deploymentType: instance.deployment_type, // Add deployment_type
    monitoringId: instance.monitoring_id, // Add monitoring_id
   };
}

export async function getDeploymentByDeploymentId(deploymentDbId: number) { // Takes DB ID
  try {
    logger.info(`[getDeploymentByDeploymentId] Fetching deployment with DB ID: ${deploymentDbId}`);
    const deployment = await deploymentDb.getByDeploymentId(deploymentDbId);
    if (!deployment) {
      throw new Error("Deployment not found");
    }
        return deployment; // Return the raw Deployment object
  } catch (error: any) {
    logger.error(`[getDeploymentByDeploymentId] Error fetching info for DB ID ${deploymentDbId}: ${error.message}`);
    throw new Error(`Failed to fetch deployment info: ${error.message}`);
  }
}

export async function getUserServiceDeployments(
  userId: string,
  serviceType?: ServiceType | null, // This is ServiceType from your types
  provider?: ProviderType | null
) {
  try {
    logger.info(`[getUserServiceDeployments] User: ${userId}, ServiceType: ${serviceType}, Provider: ${provider}`);
    // This function already calls getUserDeployments, which now uses transformDeploymentData.
    const result = await getUserDeployments(userId, serviceType, true, provider);
    return result; // It's already in the desired { userId, deployments: [...] } format
  } catch (error: any) {
    logger.error(`[getUserServiceDeployments] Error fetching: ${error.message}`);
    throw new Error(`Failed to fetch user service deployments: ${error.message}`);
  }
}