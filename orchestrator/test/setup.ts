import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Mock environment variables for testing
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_KEY = 'test-key';
process.env.WEBHOOK_PORT = '3000';

// Mock console methods to keep test output clean
console.log = jest.fn();
console.error = jest.fn();
console.warn = jest.fn(); 