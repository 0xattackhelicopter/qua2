import express, { RequestHandler } from "express";
import { getUserCredits, purchaseCredits } from "./credits.controller";

const router = express.Router();

// Get user credits
router.get("/", getUserCredits as RequestHandler);

// Purchase credits
router.post("/purchase", purchaseCredits as RequestHandler);

export default router;