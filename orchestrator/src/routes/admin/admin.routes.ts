import { Router } from "express";
// import { authenticateSupabase } from "../../middleware/auth";
// import { isAdmin } from "../../middleware/admin";
import { addUserCredits } from "./admin.controller";

const router = Router();

// Admin routes for managing user credits
router.post(
    "/credits/add",
    // TODO: Uncomment when needed again
    // authenticateSupabase as any, isAdmin, 
    addUserCredits
);

export default router; 