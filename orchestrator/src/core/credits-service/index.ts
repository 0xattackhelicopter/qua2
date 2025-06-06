import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../../constants";
import { logger } from "../../utils/logger";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const INITIAL_CREDITS = 20;
export const DEPLOYMENT_CREDIT_COST = 4;

export class CreditsService {
  async initializeUserCredits(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("user_credits")
        .insert([{ user_id: userId, credits: INITIAL_CREDITS }]);

      if (error) {
        logger.error(`Error initializing credits for user ${userId}:`, error);
        throw error;
      }

      logger.info(`Initialized ${INITIAL_CREDITS} credits for user ${userId}`);
    } catch (error: any) {
      logger.error(`Failed to initialize credits for user ${userId}:`, error);
      throw error;
    }
  }
  async addCredits(userId: string, amount: number): Promise<void> {
    try {
      // Get current credits
      const { data: currentCredits, error: fetchError } = await supabase
        .from("user_credits")
        .select("credits")
        .eq("user_id", userId)
        .single();

      if (fetchError) {
        // If user doesn't exist yet, initialize them with 0 credits
        if (fetchError.code === 'PGRST116') {
          const { error: insertError } = await supabase
            .from("user_credits")
            .insert([{ user_id: userId, credits: amount }]);

          if (insertError) {
            logger.error(`Error initializing credits for user ${userId}:`, insertError);
            throw insertError;
          }
          logger.info(`Initialized user ${userId} with ${amount} credit(s)`);
          return;
        }

        logger.error(`Error fetching credits for user ${userId}:`, fetchError);
        throw fetchError;
      }

      // Update existing credits
      const newAmount = currentCredits.credits + amount;
      const { error: updateError } = await supabase
        .from("user_credits")
        .update({ credits: newAmount })
        .eq("user_id", userId);

      if (updateError) {
        logger.error(`Error adding credits for user ${userId}:`, updateError);
        throw updateError;
      }

      logger.info(`Added ${amount} credit(s) to user ${userId}`);
    } catch (error: any) {
      logger.error(`Failed to add credits for user ${userId}:`, error);
      throw error;
    }
  }

  async deductDeploymentCredits(userId: string): Promise<boolean> {
    try {
      // Get current credits
      const { data: currentCredits, error: fetchError } = await supabase
        .from("user_credits")
        .select("credits")
        .eq("user_id", userId)
        .single();

      if (fetchError) {
        logger.error(`Error fetching credits for user ${userId}:`, fetchError);
        throw fetchError;
      }

      if (!currentCredits || currentCredits.credits < DEPLOYMENT_CREDIT_COST) {
        logger.warn(`Insufficient credits for user ${userId}`);
        return false;
      }

      // Deduct credits
      const { error: updateError } = await supabase
        .from("user_credits")
        .update({ credits: currentCredits.credits - DEPLOYMENT_CREDIT_COST })
        .eq("user_id", userId);

      if (updateError) {
        logger.error(`Error deducting credits for user ${userId}:`, updateError);
        throw updateError;
      }

      logger.info(`Deducted ${DEPLOYMENT_CREDIT_COST} credit(s) from user ${userId}`);
      return true;
    } catch (error: any) {
      logger.error(`Failed to deduct credits for user ${userId}:`, error);
      throw error;
    }
  }

  async getUserCredits(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from("user_credits")
        .select("credits")
        .eq("user_id", userId)
        .single();

      if (error) {
        logger.error(`Error fetching credits for user ${userId}:`, error);
        throw error;
      }

      return data?.credits || 0;
    } catch (error: any) {
      logger.error(`Failed to get credits for user ${userId}:`, error);
      throw error;
    }
  }
}

// Create a singleton instance
const creditsService = new CreditsService();

// Export instance methods as standalone functions
export const initializeUserCredits = (userId: string): Promise<void> => {
  return creditsService.initializeUserCredits(userId);
};

export const deductDeploymentCredits = (userId: string): Promise<boolean> => {
  return creditsService.deductDeploymentCredits(userId);
};

export const getUserCredits = (userId: string): Promise<number> => {
  return creditsService.getUserCredits(userId);
};

// Export the service instance as default
export default creditsService;
