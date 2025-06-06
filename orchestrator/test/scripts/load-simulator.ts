import axios from "axios";

const ENDPOINT = "https://94282a63d6d5.ngrok.app"

class LoadSimulator {
    private stats = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalLatency: 0,
        startTime: 0
    };

    constructor(
        private targetUrl: string,
        private requestsPerSecond: number = 100,
        private durationSeconds: number = 60,
        private batchSize: number = 20
    ) {}

    async run() {
        console.log(`Starting ${this.durationSeconds}s load test targeting ${this.requestsPerSecond} RPS: ${this.targetUrl}`);
        this.stats.startTime = Date.now();
        const endTime = this.stats.startTime + (this.durationSeconds * 1000);

        while (Date.now() < endTime) {
            const batchStartTime = Date.now();
            
            await Promise.all(
                Array(this.batchSize).fill(null).map(async () => {
                    try {
                        const requestStartTime = Date.now();
                        await axios.post(`${this.targetUrl}`);
                        this.stats.totalLatency += Date.now() - requestStartTime;
                        this.stats.successfulRequests++;
                    } catch (error) {
                        this.stats.failedRequests++;
                    }
                    this.stats.totalRequests++;
                })
            );

            const batchDuration = Date.now() - batchStartTime;
            const targetBatchDuration = (this.batchSize / this.requestsPerSecond) * 1000;
            const sleepTime = Math.max(0, targetBatchDuration - batchDuration);
            
            if (sleepTime > 0) {
                await new Promise(resolve => setTimeout(resolve, sleepTime));
            }
        }

        const totalDuration = (Date.now() - this.stats.startTime) / 1000;
        console.log('\nResults:', {
            total: this.stats.totalRequests,
            success: this.stats.successfulRequests,
            failed: this.stats.failedRequests,
            avgLatency: `${(this.stats.totalLatency / this.stats.successfulRequests).toFixed(2)}ms`,
            actualRps: (this.stats.totalRequests / totalDuration).toFixed(2),
            targetRps: this.requestsPerSecond,
            durationSeconds: totalDuration.toFixed(1)
        });
    }
}

if (ENDPOINT) {
    new LoadSimulator(`${ENDPOINT}/api/process`, 100, 30, 10).run().catch(console.error);
}

export default LoadSimulator; 