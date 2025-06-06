import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../../constants";
import { logger } from "../../utils/logger";

export interface DeploymentStats {
    deployment_id: number;
    memory_current_bytes: number;
    memory_max_bytes: number;
    cpu_usage_usec: number;
    cpu_user_usec: number;
    cpu_system_usec: number;
}

export class DeploymentStatsService {
    private supabase;

    constructor() {
        this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    }

    async recordStats(stats: DeploymentStats): Promise<void> {
        // Log the stats before recording
        logger.info('Recording deployment stats:', {
            deploymentId: stats.deployment_id,
            memory: {
                current: `${(stats.memory_current_bytes / 1024 / 1024).toFixed(2)} MB`,
                max: `${(stats.memory_max_bytes / 1024 / 1024).toFixed(2)} MB`
            },
            cpu: {
                usage: `${(stats.cpu_usage_usec / 1000000).toFixed(2)} seconds`,
                user: `${(stats.cpu_user_usec / 1000000).toFixed(2)} seconds`,
                system: `${(stats.cpu_system_usec / 1000000).toFixed(2)} seconds`
            }
        });

        const { error } = await this.supabase
            .from('deployment_stats')
            .insert([{
                deployment_id: stats.deployment_id,
                memory_current_bytes: stats.memory_current_bytes,
                memory_max_bytes: stats.memory_max_bytes,
                cpu_usage_usec: stats.cpu_usage_usec,
                cpu_user_usec: stats.cpu_user_usec,
                cpu_system_usec: stats.cpu_system_usec,
            }]);

        if (error) {
            logger.error(`Error recording deployment stats: ${error.message}`);
            throw error;
        }
    }

    async getDeploymentStats(deploymentId: string): Promise<DeploymentStats[]> {
        const { data, error } = await this.supabase
            .from('deployment_stats')
            .select('*')
            .eq('deployment_id', deploymentId)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error(`Error fetching deployment stats: ${error.message}`);
            throw error;
        }

        return data as DeploymentStats[];
    }
}