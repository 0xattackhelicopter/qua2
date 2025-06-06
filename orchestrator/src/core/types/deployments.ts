import { ServiceType } from "./services";

export enum ProviderType {
    AKASH = "akash",
    SPHERON = "spheron",
    AUTO = "auto",
}

export enum DeploymentTier {
    DEFAULT = "DEFAULT",
    CUSTOM = "CUSTOM",
}

export enum SpheronDeploymentMode {
    PROVIDER = "provider",
    FIZZ = "fizz",
}

export interface DeploymentConfig {
    serviceType: ServiceType;
    appCpuUnits?: number;
    appMemorySize?: string;
    appPort?: number;
    appStorageSize?: string;
    deploymentDuration?: string;
    image?: string;
    repoUrl: string | undefined;
    branchName: string| undefined;
    env: Record<string, string>;
    runCommands?: string;
    spheronDeploymentMode?: SpheronDeploymentMode;
    yamlContent?: string;
}

export interface DeploymentResult {
    message: string;
    appUrl: string;
    leaseId: string;
    provider: string;
    token?: string;
    accessUrl?: string;
    apiKey?: string;
}

export interface DeploymentInfo {
    id: string;
    status: string;
    timestamp: string;
    details?: Record<string, any>;
}
