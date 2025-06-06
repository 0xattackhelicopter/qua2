import "dotenv/config";
import { logger } from "../../../utils/logger";
import { BaseProvider } from "../types";
import { SPHERON_PRIVATE_KEY, SPHERON_WALLET_ADDRESS, ALCHEMY_API_KEY, PROVIDER_PROXY_URL } from "../../../constants";
let SpheronSDK: any;

export class SpheronProvider extends BaseProvider {
    constructor(network: string) {
        super(network);
    }
    // Initialize the SDK
    protected async init(): Promise<void> {
        if (!SpheronSDK) {
            const sdk = await import("@spheron/protocol-sdk");
            SpheronSDK = sdk.SpheronSDK;
        }
    }

    async createDeployment(DEPLOY_YAML: string): Promise<any> {
        try {
            await this.init();
    
            const sdk = new SpheronSDK({
                networkType: this.network,
                privateKey: SPHERON_PRIVATE_KEY,
                rpcUrls: {
                    http: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
                    websocket: `wss://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
                },
              });

            const currentBalance = await sdk.escrow.getUserBalance("uSPON", SPHERON_WALLET_ADDRESS);
            logger.info(`Current uSPON balance: ${currentBalance}`);

            logger.info(
                `Current uSPON balance: ${JSON.stringify(currentBalance)}`
            );


            const deploymentTxn = await sdk.deployment.createDeployment(DEPLOY_YAML, PROVIDER_PROXY_URL);
            
            logger.info(`Deployment created: ${deploymentTxn}`);

            logger.info(
                "Checking deployment status every 5 seconds while the node instantiates container..."
            );
            
            // Check deployment status every 5 seconds
            let maxAttempts = 12; // 12 attempts * 5 seconds = 1 minute total
            let attempts = 0;
            let deploymentDetails;
            
            while (attempts < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, 5000));
                attempts++;
                logger.info(`Checking deployment status (attempt ${attempts}/${maxAttempts})...`);
                
                if (deploymentTxn.leaseId) {
                    try {
                        deploymentDetails = await sdk.deployment.getDeployment(
                            deploymentTxn.leaseId,
                            PROVIDER_PROXY_URL
                        );
                        if (deploymentDetails && deploymentDetails.forwarded_ports) {
                            break;
                        }
                    } catch (err) {
                        logger.info(`Deployment not ready yet, will retry...`);
                    }
                }
            }

            // Fetch deployment logs
            if (deploymentTxn.leaseId) {
                logger.info("Fetching lease details...");
                const leaseDetails = await sdk.leases.getLeaseDetails(
                    deploymentTxn.leaseId
                );
                logger.info(`Lease details: ${JSON.stringify(leaseDetails)}`);

                logger.info("Fetching deployment details...");
                if (!deploymentDetails) {
                    deploymentDetails = await sdk.deployment.getDeployment(
                        deploymentTxn.leaseId,
                        PROVIDER_PROXY_URL
                    );
                }
                logger.info(
                    `Deployment details: ${JSON.stringify(deploymentDetails)}`
                );
                return {
                    forwarded_ports: deploymentDetails.forwarded_ports,
                    leaseId: deploymentTxn.leaseId.toString(),
                    deploymentDetails: deploymentDetails,
                    appUrl: deploymentDetails.forwarded_ports?.app?.[0]?.host && deploymentDetails.forwarded_ports.app[0].externalPort
                        ? `http://${deploymentDetails.forwarded_ports.app[0].host.includes('provider.provider')
                            ? 'provider.' + deploymentDetails.forwarded_ports.app[0].host.split('provider.provider.')[1]
                            : deploymentDetails.forwarded_ports.app[0].host}:${deploymentDetails.forwarded_ports.app[0].externalPort}`
                        : null,
                };
            }
        } catch (error: any) {
            throw new Error(
                `Error message: ${error}\nTraceback: ${error.stack}`
            );
        }
    }

    async closeDeployment(_leaseId: string): Promise<void> {
        try {
            const sdk = new SpheronSDK("testnet", SPHERON_PRIVATE_KEY);
            logger.info("Closing deployment...");
            const closeDeploymentDetails = await sdk.deployment.closeDeployment(
                _leaseId
            );
            logger.info(`Deployment closed: ${closeDeploymentDetails}`);
        } catch (error: any) {
            throw new Error(`Error closing deployment: ${error.message}`);
        }
    }
}
