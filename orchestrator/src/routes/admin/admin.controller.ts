import { Request, Response } from "express";
import { CreditsService } from "../../core/credits-service";

const creditsService = new CreditsService();

export const addUserCredits = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userAddress, credits } = req.body;

    if (!userAddress || !credits) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }

    await creditsService.addCredits(req.user?.id!, Number(credits));
    res.status(200).json({ message: "Credits added successfully" });
  } catch (error: any) {
    console.error("Error adding credits:", error);
    res.status(500).json({ message: error.message || "Failed to add credits" });
  }
}; 