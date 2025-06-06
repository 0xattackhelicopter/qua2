import express, { RequestHandler } from "express";
import { 
  createPaymentInvoice,
  handlePaymentWebhook,
  handlePaymentSuccess,
  handlePaymentCancel,
  getSupportedCryptocurrencies
} from "./payment.controller";

const router = express.Router();
const paymentPublicRouter = express.Router();

// Create a new payment invoice
router.post("/create-invoice", createPaymentInvoice as RequestHandler);

// Get supported cryptocurrencies
router.get("/currencies", getSupportedCryptocurrencies as RequestHandler);

// Webhook endpoint for Plisio callbacks
paymentPublicRouter.post("/webhook", handlePaymentWebhook as RequestHandler);

// Success and cancel URLs
paymentPublicRouter.get("/success", handlePaymentSuccess as RequestHandler);
paymentPublicRouter.get("/cancel", handlePaymentCancel as RequestHandler);

export {
  paymentPublicRouter
}
export default router; 
