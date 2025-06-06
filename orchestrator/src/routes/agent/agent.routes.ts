import express, { RequestHandler } from "express";
import { AgentController } from "./agent.controller";

const router = express.Router();

// Get available service types for validation
router.post("/chat/completions", (AgentController.handleChatCompletions as RequestHandler));

export default router;
