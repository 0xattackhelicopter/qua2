import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { logger } from "./utils/logger";
import { WEBHOOK_PORT } from "./constants";
import { specs } from "./utils/swagger";
import { authenticateSupabase } from "./middleware/auth";
import routes from "./routes";
import { initializeServices } from "./core/services";

// Create Express app
export const app = express();

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      /^https?:\/\/.*\.aquanode\.io$/, // Allow all subdomains of aquanode.io
    ],
  })
);
app.use(express.json());

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

// Public routes
app.use("/api", routes.public);

// Protected routes
app.use("/api", authenticateSupabase, routes.protected);

// Health check endpoint
app.get("/", (_, res) => {
  res.json({ status: "Server is Healthy", timestamp: new Date() });
});


// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

// Start the server
if (require.main === module) {
  app.listen(WEBHOOK_PORT, async () => {
    logger.info(`Webhook server running on port ${WEBHOOK_PORT}`);
    logger.info(
      `API Documentation available at http://localhost:${WEBHOOK_PORT}/api-docs`
    );

    try {
      // Initialize service handlers
      initializeServices();
      logger.info("Service handlers initialized successfully");
      
      logger.info("Server is Up!...");
    } catch (error) {
      logger.error(`Failed to initialize server: ${error}`);
      process.exit(1);
    }
  });
}
