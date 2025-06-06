import { Request, Response, NextFunction } from "express";
import { User } from "@supabase/supabase-js";
import { logger } from "../utils/logger";
import { initializeUserCredits } from "../core/credits-service";
import supabase from "../core/deployer/deployments/db";


export interface AuthenticatedRequest extends Request {
  user?: User;
}

export const authenticateSupabase = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  const token = authHeader.split(" ")[1];

  supabase.auth
    .getUser(token)
    .then(async ({ data: { user }, error }) => {
      if (error || !user) {
        logger.error("Auth error:", error);
        res.status(401).json({ error: "Invalid token" });
        return;
      }

      req.user = user;

      // Check if user has credits initialized
      const { data: creditsData, error: creditsError } = await supabase
        .from("user_credits")
        .select("credits")
        .eq("user_id", user.id)
        .single();

      if (creditsError || !creditsData) {
        // Initialize credits for new user
        try {
          await initializeUserCredits(user.id);
        } catch (initError) {
          logger.error("Failed to initialize credits for user:", initError);
          // Continue with the request even if credit initialization fails
        }
      }

      next();
    })
    .catch((error) => {
      logger.error("Authentication error:", error);
      res.status(401).json({ error: "Authentication failed" });
    });
};
