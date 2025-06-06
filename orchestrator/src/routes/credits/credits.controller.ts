import { Request, Response } from "express";
import { CreditsService } from "../../core/credits-service";
import paymentService from "../../core/payment-service";

const creditsService = new CreditsService();

export const getUserCredits = async (req: Request, res: Response): Promise<void> => {
  try {
    const userAddress = req.user?.id
    
    if (!userAddress) {
      res.status(400).json({ message: "User address is required" });
      return;
    }

    const credits = await creditsService.getUserCredits(userAddress);
    res.status(200).json({ credits });
  } catch (error: any) {
    console.error("Error getting user credits:", error);
    res.status(500).json({ message: error.message || "Failed to get user credits" });
  }
}; 

export const purchaseCredits = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, creditAmount, currency = 'USD' } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!amount || !creditAmount) {
      res.status(400).json({ message: "Missing required parameters" });
      return;
    }

    // Create invoice with Plisio
    const invoice = await paymentService.createInvoice({
      amount,
      currency,
      userId,
      creditAmount,
      orderName: `${creditAmount} Aqua Credits`,
      description: `Purchase ${creditAmount} Aqua Credits for $${amount}`
    });

    res.status(200).json(invoice);
  } catch (error: any) {
    console.error("Error purchasing credits:", error);
    res.status(500).json({ message: error.message || "Failed to purchase credits" });
  }
}; 