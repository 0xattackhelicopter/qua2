import { User } from "@supabase/supabase-js";
import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
