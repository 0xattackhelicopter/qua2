import "dotenv/config";
import assert from 'assert';

// Server configuration
export const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PORT || "3080");

// Supabase configuration
export const SUPABASE_URL = process.env.SUPABASE_URL || "";
export const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

assert(SUPABASE_URL, "SUPABASE_URL must be defined in environment variables");
assert(SUPABASE_KEY, "SUPABASE_KEY must be defined in environment variables");

// Spheron configuration
export const SPHERON_PRIVATE_KEY = process.env.SPHERON_PRIVATE_KEY;
export const SPHERON_WALLET_ADDRESS = process.env.SPHERON_WALLET_ADDRESS;
// TODO: This shouldn't be neeeded.
export const PROVIDER_PROXY_URL = process.env.PROVIDER_PROXY_URL || "http://localhost:3040";

// Akash configuration
export const AKASH_RPC_ENDPOINT = process.env.AKASH_RPC_ENDPOINT || "";
export const AKASH_MNEMONIC = process.env.AKASH_MNEMONIC || "";

// Alchemy configuration
export const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;