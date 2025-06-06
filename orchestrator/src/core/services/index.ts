import { HostingService } from "../../../aqua/hosting";
import { JupyterService } from "../../../aqua/jupyter";
import { ServiceDeploymentConfig, ServiceType } from "../types/services";
import { logger } from "../../utils/logger";
import * as fs from "fs";
import * as path from "path";

const serviceHandlers: Map<ServiceType, ServiceDeploymentConfig> = new Map();

export function registerServiceHandler(handler: ServiceDeploymentConfig) {
    serviceHandlers.set(handler.getServiceType(), handler);
    logger.info(`Registered service handler for ${handler.getServiceType()}`);
}

// Type for service constructor
type ServiceConstructor = new () => ServiceDeploymentConfig;

// Get all available service types
export function getAvailableServiceTypes(): ServiceType[] {
    return Array.from(serviceHandlers.keys());
}

// Get a specific service handler
export function getServiceHandler(serviceType: ServiceType): ServiceDeploymentConfig | undefined {
    return serviceHandlers.get(serviceType);
}

async function discoverAndInitializeServices() {
    try {
        // Get the absolute path to the aqua directory
        const aquaDir = path.resolve(__dirname, "../../../aqua");
        // Read all directories in aqua folder
        const entries = fs.readdirSync(aquaDir, { withFileTypes: true });
        
        // Filter for directories only and exclude special directories
        const serviceDirs = entries
            .filter(entry => entry.isDirectory())
            .filter(entry => !["types", "node_modules", ".git"].includes(entry.name));

        for (const dir of serviceDirs) {
            try {
                // Import the service module
                // Try to find the appropriate entry point (index.js or index.ts)
                const servicePath = path.join(aquaDir, dir.name);
                const indexPath = fs.existsSync(path.join(servicePath, 'index.ts')) 
                    ? path.join(servicePath, 'index.ts')
                    : fs.existsSync(path.join(servicePath, 'index.js'))
                        ? path.join(servicePath, 'index.js')
                        : servicePath; // Fall back to the directory itself if no index file found

                const serviceModule = await import(indexPath);
                
                // Find the service class - it should implement ServiceDeploymentConfig
                const ServiceClass = Object.values(serviceModule).find((exp: any): exp is ServiceConstructor => {
                    return typeof exp === 'function' && exp.prototype && typeof exp.prototype.getServiceType === 'function';
                });

                if (ServiceClass) {
                    // Initialize and register the service
                    const service = new ServiceClass();
                    registerServiceHandler(service);
                    logger.info(`Successfully initialized service from ${dir.name}`);
                } else {
                    logger.warn(`No valid service class found in ${dir.name}`);
                }
            } catch (error: any) {
                logger.error(`Failed to initialize service from ${dir.name}: ${error.message}`);
            }
        }
    } catch (error: any) {
        logger.error(`Failed to discover services: ${error.message}`);
        // Fall back to manual initialization if discovery fails
        const hostingService = new HostingService();
        registerServiceHandler(hostingService);
        const jupyterService = new JupyterService();
        registerServiceHandler(jupyterService);
    }
}

export async function initializeServices() {
    await discoverAndInitializeServices();
    logger.info(`Available services: ${getAvailableServiceTypes().join(", ")}`);
} 