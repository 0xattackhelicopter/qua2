// Types for deployment request parsing from user messages

import { ProviderType } from './deployments';

// Interface for resource requirements extracted from user messages
export interface ResourceRequirements {
  cpuUnits?: number;
  memorySize?: string;
  storageSize?: string;
  port?: number;
}

// Interface for repository information extracted from user messages
export interface RepositoryInfo {
  repoUrl: string;
  branchName: string;
}

// Interface for full deployment request information
export interface DeploymentRequest {
  repoUrl: string;
  branchName: string;
  cpuUnits: number;
  memorySize: string;
  storageSize: string;
  port: number;
  provider: ProviderType;
}

// Resource limits for deployments
export const RESOURCE_LIMITS = {
  MAX_CPU: 4,
  MAX_RAM: '2Gi',
  MAX_STORAGE: '5Gi',
  DEFAULT_PORT: 3000
};

// Default values for deployment requests
export const DEFAULT_DEPLOYMENT_VALUES = {
  cpuUnits: 1,
  memorySize: '1Gi',
  storageSize: '512Mi',
  port: 3000,
  branchName: 'main',
  provider: ProviderType.AUTO
}; 