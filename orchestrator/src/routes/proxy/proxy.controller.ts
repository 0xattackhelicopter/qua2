import { Request, Response, NextFunction } from 'express';
import { deploymentDb } from '../../core/deployer/deployments/db';
import { logger } from '../../utils/logger';
import { createProxyMiddleware } from 'http-proxy-middleware';

export const inferenceProxyHandler = async (req: Request, res: Response, next: NextFunction) => {
    const { deploymentDbId } = req.params;
    const authHeader = req.headers.authorization;

    logger.info(`[ProxyInfer ${deploymentDbId}] Received request for path: ${req.url}`);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn(`[ProxyInfer ${deploymentDbId}] Auth header missing or malformed`);
        return res.status(401).json({ error: 'Authorization header missing or malformed. Use Bearer token.' });
    }
    const userProvidedApiKey = authHeader.split(' ')[1];

    try {
        const deployment = await deploymentDb.getByDeploymentId(parseInt(deploymentDbId, 10));

        if (!deployment) {
            logger.warn(`[ProxyInfer ${deploymentDbId}] Deployment not found in DB`);
            return res.status(404).json({ error: 'Deployment not found' });
        }

        if (deployment.status === 'creating' || deployment.status === 'pending' || !deployment.app_url) {
            logger.warn(`[ProxyInfer ${deploymentDbId}] Deployment ${deployment.id} not yet active or URL missing. Status: ${deployment.status}`);
            return res.status(503).json({ error: 'Service not ready or URL missing. Please try again shortly.' });
        }
        
        if (!deployment.api_key) {
            logger.error(`[ProxyInfer ${deploymentDbId}] CRITICAL: Deployment ${deployment.id} has no API key configured in DB!`);
            return res.status(500).json({ error: 'Service configuration error. API key missing for deployment.' });
        }

        if (deployment.api_key !== userProvidedApiKey) {
            logger.warn(`[ProxyInfer ${deploymentDbId}] Invalid API key provided by user.`);
            return res.status(403).json({ error: 'Invalid API key' });
        }

        // Target is the direct URL of the container
        const targetServiceUrl = deployment.app_url;
        logger.info(`[ProxyInfer ${deploymentDbId}] Authenticated. Target service URL: ${targetServiceUrl}`);
        
        const targetUrlObject = new URL(targetServiceUrl);

        const proxy = createProxyMiddleware({
            target: targetUrlObject.origin, // e.g., "http://123.45.67.89:8000"
            changeOrigin: true,
            secure: targetUrlObject.protocol === 'https:', // Use secure: false if target is http or self-signed https
            pathRewrite: (_path, _req) => {
                // req.url here will be the path *after* /api/proxy-infer/:deploymentDbId/
                // e.g. if original was /api/proxy-infer/123/predict, req.url is /predict
                return _req.url || ''; // Forward the remaining path
            },
            onProxyReq: (proxyReq, _clientReq, _clientRes) => {
                // Remove the Authorization header meant for *this* proxy,
                // as the backend AI model doesn't expect/need it.
                proxyReq.removeHeader('Authorization');
                logger.info(`[ProxyInfer ${deploymentDbId}] Forwarding ${proxyReq.method} to ${targetUrlObject.origin}${proxyReq.path}`);
            },
            onError: (err, _clientReq, _clientRes, _target) => {
                logger.error(`[ProxyInfer ${deploymentDbId}] Proxy error for target ${_target}:`, err);
                if (!_clientRes.headersSent) {
                    (_clientRes as Response).status(502).json({ error: "Proxy error", details: err.message });
                } else {
                    _clientRes.end();
                }
            }
        });

        return proxy(req, res, next);

    } catch (error) {
        logger.error(`[ProxyInfer ${deploymentDbId}] Unexpected error in proxy handler:`, error);
        // Ensure 'next' is called for unhandled errors to reach global error handler
        if (!res.headersSent) {
             return next(error);
        }
    }
};