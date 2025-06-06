/*

This file can potentially be removed OR needs to be re-considered

*/

import { Request, Response } from "express";
import { logger } from '../../utils/logger';

export interface WebhookDeploymentInfo {
    id: string;
    appUrl: string;
    monitorUrl: string;
    load: number;
    lastUpdated: number;
    apiKey?: string;
}

let currentDeploymentIndex = 0;

export async function handleApiProxy(req: Request, res: Response, activeDeployments: Map<string, WebhookDeploymentInfo>) {
    const apiKey = req.headers['x-api-key'] as string;
    const uid = req.query.uid as string;

    if (!apiKey || !uid) {
        return res.status(401).json({ error: 'API key and UID are required' });
    }

    logger.info(`Proxy request received for ${uid} with API key: ${apiKey}`);
    logger.info(`Active deployment lease ids: ${Array.from(activeDeployments.keys()).join(', ')}`);
    const d = activeDeployments.get(uid);

    if (!d || d.apiKey !== apiKey) {
        return res.status(403).json({ error: 'Invalid API key or UID' });
    }

    const deployments = Array.from(activeDeployments.values());
    if (deployments.length === 0) {
        return res.status(503).json({ error: 'No active deployments available' });
    }

    // Simple round-robin load balancing
    const deployment = deployments[currentDeploymentIndex];
    currentDeploymentIndex = (currentDeploymentIndex + 1) % deployments.length;
    try {
        const targetPath = req.path.replace(/^\/api/, '');
        logger.info(`Proxying request to ${deployment.id}: ${targetPath}`);
        
        // Forward the request with proper headers and body handling
        logger.info(`body: ${req.body}, headers: ${req.headers} and method: ${req.method}`);
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(`${deployment.appUrl}${targetPath}`, {
            method: req.method,
            headers: {
                ...req.headers as any,
                host: new URL(deployment.appUrl).host, // Update host header
            },
            body: req.method !== 'GET' && req.body ? JSON.stringify(req.body) : undefined
        });

        // Handle different response types
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            res.status(response.status).json(data);
        } else {
            const data = await response.text();
            res.status(response.status).send(data);
        }
    } catch (error) {
        logger.error(`Error proxying request to ${deployment.id}: ${error}`);
        res.status(502).json({ error: 'Failed to proxy request' });
    }
}
