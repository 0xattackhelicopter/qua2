import {
    MsgCloseDeployment,
    MsgCreateDeployment,
} from "@akashnetwork/akash-api/akash/deployment/v1beta3";
import {
    QueryClientImpl as QueryProviderClient,
    QueryProviderRequest,
} from "@akashnetwork/akash-api/akash/provider/v1beta3";
import {
    QueryBidsRequest,
    MsgCreateLease,
    BidID,
} from "@akashnetwork/akash-api/akash/market/v1beta4";
import { QueryClientImpl as QueryMarketClient } from "@akashnetwork/akash-api/akash/market/v1beta4";
import { getRpc } from "@akashnetwork/akashjs/build/rpc";
import {
    getAkashTypeRegistry,
    getTypeUrl,
} from "@akashnetwork/akashjs/build/stargate";
import { SDL } from "@akashnetwork/akashjs/build/sdl";
import { certificateManager } from "@akashnetwork/akashjs/build/certificates/certificate-manager";
import * as cert from "@akashnetwork/akashjs/build/certificates";
import { DirectSecp256k1HdWallet, Registry } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";
import path from "path";
import fs from "fs";
import { logger } from "../../../utils/logger";
import "dotenv/config";
import https from "https";
import { BaseProvider } from "../types";
import { AKASH_RPC_ENDPOINT, AKASH_MNEMONIC } from "../../../constants";

const certificatePath = path.resolve(__dirname, "certificate.json");

let address: string;
let client: any;
let wallet: any;

export class AkashProvider extends BaseProvider {
    constructor(network: string) {
        super(network);
    }

    protected async init() {}

    protected async initializeAkashWallet() {
        console.log("Initializing wallet...");
        console.log("RPC endpoint:", AKASH_RPC_ENDPOINT);

        wallet = await DirectSecp256k1HdWallet.fromMnemonic(AKASH_MNEMONIC, {
            prefix: this.network,
        });
        const [account] = await wallet.getAccounts();
        address = account.address;
        const registry = getAkashTypeRegistry();
        client = await SigningStargateClient.connectWithSigner(
            AKASH_RPC_ENDPOINT,
            wallet,
            {
                registry: new Registry(registry),
            }
        );

        console.log(`Initialized account ${address}`);
        console.log("Wallet height:", await client.getHeight());

        return { address, client, wallet };
    }

    async createDeployment(sdlContent: string) {
        try {
            if (!address || !client || !wallet) {
                await this.initializeAkashWallet();
            }

            const sdl = SDL.fromString(sdlContent, "beta3");
            const blockheight = await client.getHeight();
            const groups = sdl.groups();
            const accounts = await wallet.getAccounts();

            const deployment = {
                id: {
                    owner: accounts[0].address,
                    dseq: blockheight,
                },
                groups: groups,
                deposit: {
                    denom: "uakt",
                    amount: "6000000",
                },
                version: await sdl.manifestVersion(),
                depositor: accounts[0].address,
            };

            const fee = {
                amount: [
                    {
                        denom: "uakt",
                        amount: "20000",
                    },
                ],
                gas: "800000",
            };

            const msg = {
                typeUrl: "/akash.deployment.v1beta3.MsgCreateDeployment",
                value: MsgCreateDeployment.fromPartial(deployment),
            };

            const tx = await client.signAndBroadcast(
                accounts[0].address,
                [msg],
                fee,
                "create deployment"
            );

            if (tx.code !== undefined && tx.code === 0) {
                // Create lease and send manifest
                const bid = await this.fetchBid(
                    deployment.id.dseq,
                    accounts[0].address
                );
                const lease = await this.createLease(bid);
                const certificate = await this.loadOrCreateCertificate();
                
                // Get provider info for the lease
                const rpc = await getRpc(AKASH_RPC_ENDPOINT);
                const providerClient = new QueryProviderClient(rpc);
                const request = QueryProviderRequest.fromPartial({
                    owner: lease.id.provider,
                });
                const providerResponse = await providerClient.Provider(request);
                if (!providerResponse.provider) {
                    throw new Error(`Could not find provider ${lease.id.provider}`);
                }
                
                await this.sendManifest(sdl, lease, certificate);
                
                // Wait for deployment to be ready and get service URL
                const serviceUrl = await this.waitForDeploymentReady(lease, providerResponse.provider.hostUri, certificate);

                return {
                    leaseId: deployment.id.dseq.toString(),
                    deploymentDetails: lease,
                    appUrl: serviceUrl,
                };
            }

            throw new Error(`Could not create deployment: ${tx.rawLog}`);
        } catch (error: any) {
            logger.error("Error in createAkashDeployment:", error);
            throw new Error(
                `Error in createAkashDeployment: ${error.message}\nTraceback: ${error.stack}`
            );
        }
    }

    async closeDeployment(dseq: string): Promise<void> {
        try {
            if (!address || !client || !wallet) {
                await this.initializeAkashWallet();
            }

            const accounts = await wallet.getAccounts();
            const message = MsgCloseDeployment.create({
                id: {
                    dseq: dseq,
                    owner: accounts[0].address,
                },
            });

            const msg = {
                typeUrl: getTypeUrl(MsgCloseDeployment),
                value: message,
            };

            const fee = {
                amount: [
                    {
                        denom: "uakt",
                        amount: "20000",
                    },
                ],
                gas: "800000",
            };

            const tx = await client.signAndBroadcast(
                accounts[0].address,
                [msg],
                fee,
                "close deployment"
            );

            if (tx.code !== 0) {
                throw new Error(`Failed to close deployment: ${tx.rawLog}`);
            }
            
            logger.info(`Successfully closed deployment with dseq: ${dseq}`);
        } catch (error: any) {
            logger.error("Error in closeAkashDeployment:", error);
            throw error;
        }
    }

    protected async fetchBid(dseq: number, owner: string) {
        try {
            const rpc = await getRpc(AKASH_RPC_ENDPOINT);
            const Qclient = new QueryMarketClient(rpc);
            const request = QueryBidsRequest.fromPartial({
                filters: {
                    owner: owner,
                    dseq: dseq,
                },
            });

            const startTime = Date.now();
            const timeout = 1000 * 60 * 5;

            while (Date.now() - startTime < timeout) {
                logger.info("Fetching bids...");
                await new Promise((resolve) => setTimeout(resolve, 5000));
                const bids = await Qclient.Bids(request);

                if (bids.bids.length > 0 && bids.bids[0].bid !== undefined) {
                    return bids.bids[0].bid;
                }

                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            throw new Error(
                `Could not fetch bid for deployment ${dseq}. Timeout reached.`
            );
        } catch (error: any) {
            throw new Error(
                `Error fetching bid: ${error.message}\nTraceback: ${error.stack}`
            );
        }
    }

    protected async createLease(bid: any) {
        if (!bid.bidId) {
            throw new Error("Bid ID is undefined");
        }

        const accounts = await wallet.getAccounts();
        const lease = {
            bidId: bid.bidId,
        };

        const fee = {
            amount: [
                {
                    denom: "uakt",
                    amount: "50000",
                },
            ],
            gas: "2000000",
        };

        const msg = {
            typeUrl: `/${MsgCreateLease.$type}`,
            value: MsgCreateLease.fromPartial(lease),
        };

        const tx = await client.signAndBroadcast(
            accounts[0].address,
            [msg],
            fee,
            "create lease"
        );

        if (tx.code !== undefined && tx.code === 0) {
            return {
                id: BidID.toJSON(bid.bidId) as {
                    owner: string;
                    dseq: number;
                    provider: string;
                    gseq: number;
                    oseq: number;
                }
            };
        }

        throw new Error(`Could not create lease: ${tx.rawLog}`);
    }

    protected async loadOrCreateCertificate() {
        const accounts = await wallet.getAccounts();

        if (fs.existsSync(certificatePath)) {
            return JSON.parse(fs.readFileSync(certificatePath, "utf8"));
        }

        const certificate = certificateManager.generatePEM(accounts[0].address);
        const result = await cert.broadcastCertificate(
            certificate,
            accounts[0].address,
            client
        );

        if (result.code !== undefined && result.code === 0) {
            fs.writeFileSync(certificatePath, JSON.stringify(certificate));
            return certificate;
        }

        throw new Error(`Could not create certificate: ${result.rawLog}`);
    }

    protected async queryLeaseStatus(lease: any, providerUri: string, certificate: any) {
        const id = lease.id;
        
        if (id === undefined) {
            throw new Error("Lease ID is undefined");
        }
        
        const leasePath = `/lease/${id.dseq}/${id.gseq}/${id.oseq}/status`;
        
        const agent = new https.Agent({
            cert: certificate.cert,
            key: certificate.privateKey,
            rejectUnauthorized: false
        });
        
        const uri = new URL(providerUri);
        
        return new Promise<{
            services: {
                [serviceName: string]: {
                    name: string;
                    available: number;
                    total: number;
                    uris: string[] | null;
                    observed_generation: number;
                    replicas: number;
                    updated_replicas: number;
                    ready_replicas: number;
                    available_replicas: number;
                }
            },
            forwarded_ports: {
                [serviceName: string]: Array<{
                    host: string;
                    port: number;
                    externalPort: number;
                    proto: string;
                    name: string;
                }>
            } | null,
            ips: any | null;
        }>((resolve, reject) => {
            const req = https.request(
                {
                    hostname: uri.hostname,
                    port: uri.port,
                    path: leasePath,
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json"
                    },
                    agent: agent
                },
                res => {
                    if (res.statusCode !== 200) {
                        return reject(`Could not query lease status: ${res.statusCode}`);
                    }
                    
                    let data = "";
                    
                    res.on("data", chunk => (data += chunk));
                    res.on("end", () => resolve(JSON.parse(data)));
                }
            );
            
            req.on("error", reject);
            req.end();
        });
    }

    protected async waitForDeploymentReady(lease: any, providerUri: string, certificate: any) {
        const startTime = Date.now();
        const timeout = 1000 * 60 * 10;
        
        while (Date.now() - startTime < timeout) {
            logger.info("Waiting for deployment to start...");
            try {
                const status = await this.queryLeaseStatus(lease, providerUri, certificate);
                console.log(status);

                if (status) {
                    logger.info(`Received status: ${JSON.stringify(status, null, 2)}`);
                    // First, check the services section for any services with URIs
                    if (status.services) {
                        for (const [name, service] of Object.entries(status.services)) {
                            if (service.uris && Array.isArray(service.uris) && service.uris.length > 0) {
                                logger.info(`Service ${name} is available at: ${service.uris[0]}`);
                                return service.uris[0];
                            }
                        }
                    }
                    
                    // If no URIs in services, check if we have forwarded_ports that we can use to build a URL
                    if (status.forwarded_ports) {
                        for (const [name, ports] of Object.entries(status.forwarded_ports)) {
                            if (Array.isArray(ports) && ports.length > 0) {
                                // Build a URL from the port information
                                const portInfo = ports[0];
                                const protocol = portInfo.proto === "TCP" ? "http" : "https";
                                const url = `${protocol}://${portInfo.host}:${portInfo.externalPort}`;
                                logger.info(`Created URL for service ${name} from forwarded port: ${url}`);
                                return url;
                            }
                        }
                    }
                    
                    // No usable URIs found yet, log the status of services
                    if (status.services) {
                        for (const [name, service] of Object.entries(status.services)) {
                            if (service.ready_replicas > 0) {
                                logger.info(`Service ${name} has ${service.ready_replicas} ready replicas but no URIs yet`);
                            }
                        }
                    }
                }
            } catch (error) {
                // If 404, deployment not ready yet
                if (error instanceof Error && error.toString().includes("Could not query lease status: 404")) {
                    logger.info("Deployment not ready yet, waiting...");
                } else {
                    throw error;
                }
            }
            
            // Wait before trying again
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        throw new Error(`Could not start deployment. Timeout reached.`);
    }

    protected async sendManifest(sdl: any, lease: any, certificate: any) {
        if (!lease.id) {
            throw new Error("Lease ID is undefined");
        }
        const { dseq, provider } = lease.id;
        const rpc = await getRpc(AKASH_RPC_ENDPOINT);
        const providerClient = new QueryProviderClient(rpc);
        const request = QueryProviderRequest.fromPartial({
            owner: provider,
        });

        const tx = await providerClient.Provider(request);
        if (!tx.provider) {
            throw new Error(`Could not find provider ${provider}`);
        }

        const providerInfo = tx.provider;
        const manifest = sdl.manifestSortedJSON();
        const path = `/deployment/${dseq}/manifest`;

        const uri = new URL(providerInfo.hostUri);
        const agent = new https.Agent({
            cert: certificate.cert,
            key: certificate.privateKey,
            rejectUnauthorized: false,
        });

        await new Promise((resolve, reject) => {
            const req = https.request(
                {
                    hostname: uri.hostname,
                    port: uri.port,
                    path: path,
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        "Content-Length": manifest.length,
                    },
                    agent: agent,
                },
                (res) => {
                    res.on("error", reject);

                    let data = "";
                    res.on("data", (chunk) => {
                        data += chunk;
                        logger.info("Response:", chunk.toString());
                    });

                    res.on("end", () => {
                        if (res.statusCode !== 200) {
                            return reject(
                                `Could not send manifest: ${res.statusCode}, ${res.statusMessage}`
                            );
                        }

                        try {
                            const response = JSON.parse(data);
                            resolve(response);
                        } catch (err) {
                            resolve(data); // Return raw data if not JSON
                        }
                    });
                }
            );

            req.on("error", reject);
            req.write(manifest);
            req.end();
        });
    }
}
