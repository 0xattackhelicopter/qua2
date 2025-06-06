import express from "express";
import deploymentRoutes from "./deployments/deployments.routes";
import agentRoutes from "./agent/agent.routes";
import creditsRoutes from "./credits/credits.routes";
import adminRoutes from "./admin/admin.routes";
import monitoringRoutes from "./monitoring/monitoring.routes";
import paymentRoutes, { paymentPublicRouter } from "./payment/payment.routes";


// Public routes
const publicRouter = express.Router();
publicRouter.get("/health", (_, res) => {
  res.json({ status: "ok" });
});
publicRouter.use("/monitoring", monitoringRoutes);
// Payment webhook doesn't need authentication
publicRouter.use("/payment", paymentPublicRouter);

publicRouter.all('/api/proxy-infer/:deploymentDbId/*', inferenceProxyHandler);

// Protected routes
const protectedRouter = express.Router();
protectedRouter.use("/deployments", deploymentRoutes);
protectedRouter.use("/agent", agentRoutes);
protectedRouter.use("/credits", creditsRoutes);
protectedRouter.use("/admin", adminRoutes);
protectedRouter.use("/payment", paymentRoutes);

export default {
  public: publicRouter,
  protected: protectedRouter,
};
