import { Router } from 'express';
import { DeploymentStatsService } from '../../core/monitor/monitor';
import { deploymentDb } from '../../core/deployer/deployments/db';
import { assert } from 'console';
const router = Router();
const statsService = new DeploymentStatsService();

router.post('/mem', async (req, res) => {
    console.log(req.body);
    try {
        const { deploymentId: monitoringId, memoryCurrent, memoryMax, cpuStat } = req.body;
        console.log(monitoringId);

        // Handle null values with defaults
        const currentMemory = memoryCurrent || 0;
        const maxMemory = memoryMax || 0;
        const cpuUsage = cpuStat?.usage_usec || 0;
        const cpuUser = cpuStat?.user_usec || 0; 
        const cpuSystem = cpuStat?.system_usec || 0;

        // finding corresponding deployment id
        const deployment = await deploymentDb.getByMonitoringId(monitoringId);
        const deploymentId = deployment?.id;
        assert(deploymentId, "Deployment ID not found");

        console.log(`Recorded stats for deployment ${monitoringId} & deployment id ${deploymentId}:`, {
            memory: {
                current: `${(currentMemory / 1024 / 1024).toFixed(2)} MB`,
                max: `${(maxMemory / 1024 / 1024).toFixed(2)} MB`
            },
            cpu: {
                usage: `${(cpuUsage / 1000000).toFixed(2)}s`,
                user: `${(cpuUser / 1000000).toFixed(2)}s`,
                system: `${(cpuSystem / 1000000).toFixed(2)}s`
            }
        });

        await statsService.recordStats({
            // @ts-ignore
            deployment_id: deploymentId,  
            memory_current_bytes: currentMemory,
            memory_max_bytes: maxMemory,
            cpu_usage_usec: cpuUsage,
            cpu_user_usec: cpuUser,
            cpu_system_usec: cpuSystem,
        });

        res.status(200).send('Received');
    } catch (error) {
        console.error('Error recording stats:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/stats/:deploymentId', async (req, res) => {
    try {
        const { deploymentId } = req.params;
        console.log(`Fetching stats for deployment ${deploymentId}`);
        const stats = await statsService.getDeploymentStats(deploymentId || '0');
        res.status(200).json(stats);
    } catch (error) {
        console.error('Error fetching deployment stats:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;