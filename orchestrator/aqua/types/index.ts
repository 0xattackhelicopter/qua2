export enum ServiceType {
  WEB_APP = 'WEB_APP',
  DATABASE = 'DATABASE',
  AI_MODEL = 'AI_MODEL'
}

export enum SpheronDeploymentMode {
    PROVIDER = "provider",
    FIZZ = "fizz",
}

export interface InputConfig {
    appCpuUnits: number;
    appMemorySize: string;
    appPort: number;
    appStorageSize: string;
    deploymentDuration: string;
    image: string;
    repoUrl: string;
    branchName: string;
    envVars: Record<string, string>;
    runCommands: string;
    spheronDeploymentMode: SpheronDeploymentMode;
    disablePull?: boolean | null; // if false, the latest changes will be fetched (auto-ci-cd-like)
}

export interface OutputConfig {
    serviceType: ServiceType;
    appCpuUnits?: number;
    appMemorySize?: string;
    appPort?: number;
    appStorageSize?: string;
    deploymentDuration?: string;
    image?: string;
    repoUrl: string | undefined;
    branchName: string;
    env: Record<string, string>;
    runCommands?: string;
    spheronDeploymentMode?: SpheronDeploymentMode;
}

export interface ServiceDeploymentConfig {
    SERVICE_IMAGE: string;
    SERVICE_TYPE: string;
    getServiceType(): ServiceType;
    getDefaultDeploymentConfig(config?: Partial<InputConfig>): OutputConfig;
    getCustomDeploymentConfig(config?: Partial<InputConfig>): OutputConfig;
}
