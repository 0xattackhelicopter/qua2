import { Request, Response } from "express";
import paymentService from "../../core/payment-service";
import { CreditsService } from "../../core/credits-service";
import { logger } from "../../utils/logger";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../../constants";

const creditsService = new CreditsService();
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Create a payment invoice using Plisio
 */
export const createPaymentInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, currency, creditAmount } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!amount || !currency || !creditAmount) {
      res.status(400).json({ message: "Missing required parameters" });
      return;
    }

    const invoice = await paymentService.createInvoice({
      amount,
      currency,
      userId,
      creditAmount,
    });

    res.status(200).json(invoice);
  } catch (error: any) {
    logger.error("Error creating payment invoice:", error);
    res.status(500).json({ message: error.message || "Failed to create payment invoice" });
  }
};

/**
 * Handle webhook notifications from Plisio
 */
export const handlePaymentWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { txn_id, status } = req.body;

    if (!txn_id) {
      logger.error("Missing transaction ID in webhook payload");
      res.status(200).json({ status: "error", message: "Missing transaction ID" });
      return;
    }

    // Verify the payment status with Plisio to prevent spoofing
    const paymentDetails = await paymentService.verifyPayment(txn_id);
    
    // Update payment status in Supabase
    await paymentService.updatePaymentStatus(txn_id, paymentDetails.status);
    
    if (paymentDetails.status === 'completed' || paymentDetails.status === 'confirmed') {
      // Get payment information from Supabase
      const { data } = await supabase
        .from("payment_transactions")
        .select("*")
        .eq("txn_id", txn_id)
        .single();
      
      if (data) {
        // Add credits to the user's account
        await creditsService.addCredits(data.user_id, data.credit_amount);
        logger.info(`Added ${data.credit_amount} credits to user ${data.user_id} from payment ${txn_id}`);
      } else {
        logger.error(`Payment transaction not found for txn_id ${txn_id}`);
      }
    }
    
    // Always respond with 200 OK to acknowledge receipt
    res.status(200).json({ status: "success" });
  } catch (error: any) {
    logger.error("Error handling payment webhook:", error);
    // Still return 200 to prevent Plisio from retrying
    res.status(200).json({ status: "error", message: error.message });
  }
};

/**
 * Handle successful payment redirect
 */
export const handlePaymentSuccess = async (req: Request, res: Response): Promise<void> => {
  try {
    const { order } = req.query;
    
    if (!order) {
      logger.error("Missing order ID in payment success redirect");
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/error`);
      return;
    }

    // Get payment information from Supabase
    const paymentInfo = await paymentService.getPaymentInfoByOrderId(order as string);
    
    if (!paymentInfo) {
      logger.error(`Payment information not found for order ${order}`);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/error`);
      return;
    }

    // Verify the payment status with Plisio
    const paymentDetails = await paymentService.verifyPayment(paymentInfo.txn_id);
    
    if (paymentDetails.status === 'completed' || paymentDetails.status === 'confirmed') {
      // Add credits to the user's account
      await creditsService.addCredits(
        paymentInfo.user_id, 
        paymentInfo.credit_amount
      );
      
      // Update payment status in Supabase
      await paymentService.updatePaymentStatus(paymentInfo.txn_id, paymentDetails.status);
      
      logger.info(`Added ${paymentInfo.credit_amount} credits to user ${paymentInfo.user_id} from order ${order}`);
    } else {
      logger.warn(`Payment not completed for order ${order}, status: ${paymentDetails.status}`);
    }
    
    // Redirect to the frontend success page
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?order=${order}`);
  } catch (error: any) {
    logger.error("Error handling payment success:", error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/error`);
  }
};

/**
 * Handle cancelled payment redirect 
 */
export const handlePaymentCancel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { order } = req.query;
    
    // Redirect to the frontend cancel page
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/cancel?order=${order}`);
  } catch (error: any) {
    logger.error("Error handling payment cancel:", error);
    res.status(500).json({ message: error.message || "Failed to process cancelled payment" });
  }
};

/**
 * Get list of supported cryptocurrencies
 */
export const getSupportedCryptocurrencies = async (_req: Request, res: Response): Promise<void> => {
  try {
    const currencies = await paymentService.getSupportedCurrencies();
    res.status(200).json(currencies);
  } catch (error: any) {
    logger.error("Error getting supported cryptocurrencies:", error);
    res.status(500).json({ message: error.message || "Failed to get supported cryptocurrencies" });
  }
}; 