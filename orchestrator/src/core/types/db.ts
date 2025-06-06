export interface User {
  id: number;
  address: string;
  created_at: string;
}
export interface DeploymentAppConfigSnapshot {
  serviceType: string;
  appCpuUnits: number;
  appMemorySize: string;
  appPort: number;
  appStorageSize: string;
  deploymentDuration: string;
  image: string;
  repoUrl?: string;
  branchName?: string;
  env?: Record<string, string>;
  runCommands?: string;
  spheronDeploymentMode?: string;
}



export interface Deployment {
  id: number;
  user: string; // UUID from auth.users
  monitor_url: string;
  api_key: string;
  app_url: string;
  lease_id: string;
  provider: string;
  created_at: string;
  deployment_type?: string;
  image?: string;
  cpu?: number;
  memory?: string;
  storage?: string;
  duration?: string;
  status?: string;
  monitoring_id?: string;
  name: string;
  parentDeploymentId: number | null;
  isReplica: boolean;
  autoscaling_enabled?: boolean;
  min_replicas?: number;
  max_replicas?: number;
  app_config_snapshot?: DeploymentAppConfigSnapshot | null;
}
