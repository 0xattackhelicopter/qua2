export abstract class BaseProvider {
    protected network: string;
    constructor(network: string) {
        this.network = network;
    }
    protected abstract init(): Promise<void>;
    abstract createDeployment(deployYaml: string): Promise<any>;
    abstract closeDeployment(leaseId: string): Promise<void>;
}
