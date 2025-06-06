import axios from 'axios';
import { logger } from '../../utils/logger';
import { randomUUID } from 'crypto';
import { SUPPORTED_CURRENCIES } from '../../constants/supported-currencies';
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../../constants";

// Environment variables should be added to .env file
const PLISIO_API_KEY = process.env.PLISIO_API_KEY || '';
const PLISIO_API_URL = 'https://api.plisio.net/api/v1';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3080';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface CreateInvoiceParams {
  amount: number;
  currency: string;
  userId: string;
  creditAmount: number;
  orderName?: string;
  description?: string;
}

export interface PlisioInvoice {
  status: string;
  data: {
    txn_id: string;
    invoice_url: string;
    status: string;
    amount: string;
    currency: string;
    order_name: string;
    order_number: string;
  };
}

export class PaymentService {
  /**
   * Store payment information in Supabase
   */
  async storePaymentInfo(orderNumber: string, params: CreateInvoiceParams, txnId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("payment_transactions")
        .insert([{
          order_id: orderNumber,
          user_id: params.userId,
          amount: params.amount,
          credit_amount: params.creditAmount,
          currency: params.currency,
          txn_id: txnId,
          status: 'pending'
        }]);

      if (error) {
        logger.error(`Error storing payment info for order ${orderNumber}:`, error);
        throw error;
      }

      logger.info(`Stored payment info for order ${orderNumber}`);
    } catch (error: any) {
      logger.error(`Failed to store payment info for order ${orderNumber}:`, error);
      throw error;
    }
  }

  /**
   * Get payment information from Supabase by order ID
   */
  async getPaymentInfoByOrderId(orderId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from("payment_transactions")
        .select("*")
        .eq("order_id", orderId)
        .single();

      if (error) {
        logger.error(`Error fetching payment info for order ${orderId}:`, error);
        throw error;
      }

      return data;
    } catch (error: any) {
      logger.error(`Failed to get payment info for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Update payment status in Supabase
   */
  async updatePaymentStatus(txnId: string, status: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("payment_transactions")
        .update({ status })
        .eq("txn_id", txnId);

      if (error) {
        logger.error(`Error updating payment status for transaction ${txnId}:`, error);
        throw error;
      }

      logger.info(`Updated payment status to ${status} for transaction ${txnId}`);
    } catch (error: any) {
      logger.error(`Failed to update payment status for transaction ${txnId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new invoice using Plisio payment gateway
   */
  async createInvoice(params: CreateInvoiceParams): Promise<PlisioInvoice> {
    try {
      // Create a unique order number
      const orderNumber = randomUUID();

      const userId = params.userId;
      
      // Prepare data for Plisio API
      const queryParams = new URLSearchParams({
        api_key: PLISIO_API_KEY,
        order_number: orderNumber,
        order_name: params.orderName || `Aqua Credits: ${params.creditAmount}`,
        allowed_psys_cids: params.currency,
        currency: params.currency,
        description: params.description || `Purchase ${params.creditAmount} Aqua Credits`,
        callback_url: `${WEBHOOK_URL}/api/payment/webhook`,
        success_url: `${WEBHOOK_URL}/api/payment/success?order=${orderNumber}`,
        cancel_url: `${WEBHOOK_URL}/api/payment/cancel?order=${orderNumber}`,
        source_currency: "USD",
        source_amount: params.amount.toString(),
        email: "contact@aquanode.io",
      });
      // Call Plisio API to create transaction
      const response = await axios.get(`${PLISIO_API_URL}/invoices/new?${queryParams.toString()}`);
      
      if (response.data.status !== 'success') {
        throw new Error(`Failed to create invoice: ${response.data.message || 'Unknown error'}`);
      }
      
      // Store payment information in Supabase
      await this.storePaymentInfo(orderNumber, params, response.data.data.txn_id);
      
      logger.info(`Created invoice ${orderNumber} for ${params.userId} for ${params.creditAmount} credits`);
      return response.data;
    } catch (error: any) {
      logger.error('Error creating invoice:', error);
      throw new Error(`Failed to create invoice: ${error.message}`);
    }
  }

  /**
   * Verify the payment status with Plisio
   */
  async verifyPayment(txnId: string): Promise<any> {
    try {
      const response = await axios.get(`${PLISIO_API_URL}/operations/${txnId}?api_key=${PLISIO_API_KEY}`);
      
      if (response.data.status !== 'success') {
        throw new Error(`Failed to verify payment: ${response.data.message || 'Unknown error'}`);
      }
      
      return response.data.data;
    } catch (error: any) {
      logger.error('Error verifying payment:', error);
      throw new Error(`Failed to verify payment: ${error.message}`);
    }
  }

  /**
   * Get supported cryptocurrencies
   */
  async getSupportedCurrencies(): Promise<any> {
    try {
      return SUPPORTED_CURRENCIES;
      /* Commented out as we're using predefined constants instead of API call
      const response = await axios.get(`${PLISIO_API_URL}/currencies?api_key=${PLISIO_API_KEY}`);
      
      if (response.data.status !== 'success') {
        throw new Error(`Failed to get currencies: ${response.data.message || 'Unknown error'}`);
      }
      
      return response.data.data;
      */
    } catch (error: any) {
      logger.error('Error getting supported currencies:', error);
      throw new Error(`Failed to get currencies: ${error.message}`);
    }
  }
}

// Create singleton instance
const paymentService = new PaymentService();
export default paymentService; 