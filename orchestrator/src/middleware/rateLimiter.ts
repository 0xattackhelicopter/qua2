import { Request, Response, NextFunction, RequestHandler } from "express";
import { logger } from "../utils/logger";
import { hasReachedDeploymentLimit } from "../core/deployer/deployments/deployments";

/**
 * Middleware that checks if a user has reached the maximum allowed deployments (2)
 * Returns a 429 status code if the limit is reached
 */
export const deploymentRateLimiter = (async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const limitReached = await hasReachedDeploymentLimit(req.user.id);
    if (limitReached) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: "You cannot deploy more than 2 services at the same time",
      });
    }

    next();
  } catch (error: any) {
    logger.error(`Error checking deployment limit: ${error.message}`);
    // If there's an error in the rate limiting check, let the request proceed
    next();
  }
}) as RequestHandler;
