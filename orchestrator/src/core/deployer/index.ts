import { logger } from "../../utils/logger";
import {
    DeploymentTier,
    ProviderType,
    DeploymentResult,
    DeploymentConfig,
} from "../types/deployments";
import { createDeployment } from "./deployments/deployments";
import { InputConfig, ServiceType } from "../types/services";
import { getServiceHandler } from "../services";

export async function handleUnifiedDeployment(
    service: ServiceType,
    deploymentTier: DeploymentTier,
    userId: string,
    provider: ProviderType,
    inputConfig?: Partial<InputConfig>
): Promise<DeploymentResult> {
    try {
        const handler = getServiceHandler(service);
        if (!handler) {
            throw new Error(
                `No handler registered for service type: ${service}`
            );
        }

        logger.info(
            `Handling deployment for service ${service} with tier ${deploymentTier}, config: ${JSON.stringify(inputConfig)}`
        );

        let outputConfig: DeploymentConfig;
        outputConfig = handler.getCustomDeploymentConfig(inputConfig);
        // TODO: Add default deployment config based on tiers
        // if (deploymentTier === DeploymentTier.DEFAULT) {
            // outputConfig = handler.getDefaultDeploymentConfig(inputConfig);
        // } else {
        // }

        return await createDeployment(userId, provider, outputConfig);
    } catch (error: any) {
        logger.error(`Error handling deployment: ${error.message}`);
        throw error;
    }
}
