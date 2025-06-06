import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth";

const ADMIN_EMAILS = [
  "arnavmehta.contact@gmail.com",
  "sarthakvaish184@gmail.com", 
  "anshsaxena4190@gmail.com"
].map(email => email.toLowerCase());

export const isAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const user = req.user;

  if (!user || !user.email) {
    res.status(401).json({ error: "Unauthorized - User not authenticated" });
    return;
  }

  const userEmail = user.email.toLowerCase();
  if (!ADMIN_EMAILS.includes(userEmail)) {
    console.log("User is not an admin", userEmail);
    res.status(403).json({ error: "Forbidden - Admin access required" });
    return;
  }

  next();
};