// Mock the services first
jest.mock('../src/core/deployer/deployments/deployments', () => ({
  createDeployment: jest.fn().mockResolvedValue({ id: 'test-deployment-id', status: 'created' }),
  getDeploymentByDeploymentId: jest.fn().mockResolvedValue({ id: 'test-deployment-id', status: 'running' }),
  getUserServiceDeployments: jest.fn().mockResolvedValue([{ id: 'test-deployment-id', status: 'running' }]),
  closeDeployment: jest.fn().mockResolvedValue({ id: 'test-deployment-id', status: 'closed' }),
}));

jest.mock('../src/core/deployer', () => ({
  handleUnifiedDeployment: jest.fn().mockResolvedValue({ id: 'test-deployment-id', status: 'created' }),
}));

jest.mock('../src/routes/ai/ai.controller', () => ({
  handleChatCompletion: jest.fn().mockResolvedValue({
    id: 'test-chat-id',
    choices: [{ message: { role: 'assistant', content: 'Test response' } }]
  })
}));

// Mock the authentication middleware
jest.mock('../src/middleware/auth', () => ({
  authenticateSupabase: jest.fn((req: any, res: any, next: any) => {
    req.user = {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'authenticated',
    };
    next();
  }),
}));

// Now import the actual modules
import express from 'express';
import request from 'supertest';
import { app } from '../src/server';
import { AuthenticatedRequest } from '../src/middleware/auth';

describe('Orchestrator Routes', () => {
  describe('Public Routes', () => {
    it('should return 200 for health check endpoint', async () => {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('Protected Routes', () => {
    describe('Deployments', () => {
      it('should create a deployment', async () => {
        const mockDeployment = {
          serviceType: 'test-service',
          config: { test: 'config' },
        };

        const response = await request(app)
          .post('/api/deployments/deploy')
          .set('Authorization', 'Bearer test-token')
          .send(mockDeployment);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ id: 'test-deployment-id', status: 'created' });
      });

      it('should get deployments', async () => {
        const response = await request(app)
          .post('/api/deployments')
          .set('Authorization', 'Bearer test-token')
          .send({});

        expect(response.status).toBe(200);
        expect(response.body).toEqual([{ id: 'test-deployment-id', status: 'running' }]);
      });

      it('should get deployment by ID', async () => {
        const deploymentId = 'test-deployment-id';
        const response = await request(app)
          .get(`/api/deployments/${deploymentId}`)
          .set('Authorization', 'Bearer test-token');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ id: 'test-deployment-id', status: 'running' });
      });

      it('should get service instances', async () => {
        const response = await request(app)
          .post('/api/deployments/service-instances')
          .set('Authorization', 'Bearer test-token')
          .send({ serviceType: 'test-service' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual([{ id: 'test-deployment-id', status: 'running' }]);
      });

      it('should close deployment', async () => {
        const response = await request(app)
          .post('/api/deployments/close')
          .set('Authorization', 'Bearer test-token')
          .send({ deploymentId: 'test-deployment-id' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ id: 'test-deployment-id', status: 'closed' });
      });

      it('should get deployments by type', async () => {
        const response = await request(app)
          .post('/api/deployments/user')
          .set('Authorization', 'Bearer test-token')
          .send({ type: 'test-type', provider: 'test-provider' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual([{ id: 'test-deployment-id', status: 'running' }]);
      });

      it('should handle deployment creation error', async () => {
        // Mock the createDeployment to throw an error
        jest.spyOn(require('../src/core/deployer/deployments/deployments'), 'createDeployment')
          .mockRejectedValueOnce(new Error('Deployment creation failed'));

        const mockDeployment = {
          serviceType: 'test-service',
          config: { test: 'config' },
        };

        const response = await request(app)
          .post('/api/deployments/deploy')
          .set('Authorization', 'Bearer test-token')
          .send(mockDeployment);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Deployment creation failed' });
      });

      it('should handle invalid deployment request', async () => {
        const invalidDeployment = {
          // Missing required serviceType
          config: { test: 'config' },
        };

        const response = await request(app)
          .post('/api/deployments/deploy')
          .set('Authorization', 'Bearer test-token')
          .send(invalidDeployment);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('AI Routes', () => {
      it('should handle chat completion', async () => {
        const mockChatRequest = {
          messages: [{ role: 'user', content: 'Hello' }],
        };

        const response = await request(app)
          .post('/api/ai/chat/completions')
          .set('Authorization', 'Bearer test-token')
          .send(mockChatRequest);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          id: 'test-chat-id',
          choices: [{ message: { role: 'assistant', content: 'Test response' } }]
        });
      });

      it('should handle chat completion error', async () => {
        // Mock the handleChatCompletion to throw an error
        jest.spyOn(require('../src/routes/ai/ai.controller'), 'handleChatCompletion')
          .mockRejectedValueOnce(new Error('Chat completion failed'));

        const mockChatRequest = {
          messages: [{ role: 'user', content: 'Hello' }],
        };

        const response = await request(app)
          .post('/api/ai/chat/completions')
          .set('Authorization', 'Bearer test-token')
          .send(mockChatRequest);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Chat completion failed' });
      });

      it('should handle invalid chat request', async () => {
        const invalidChatRequest = {
          // Missing required messages array
          otherField: 'value',
        };

        const response = await request(app)
          .post('/api/ai/chat/completions')
          .set('Authorization', 'Bearer test-token')
          .send(invalidChatRequest);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Authentication', () => {
    it('should return 401 for protected routes without token', async () => {
      const response = await request(app).get('/api/deployments/test-id');
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'No token provided' });
    });

    it('should return 401 for protected routes with invalid token', async () => {
      // Mock the authentication to fail
      jest.spyOn(require('../src/middleware/auth'), 'authenticateSupabase')
        .mockImplementationOnce((...args: unknown[]) => {
          const res = args[1] as express.Response;
          res.status(401).json({ error: 'Invalid token' });
        });

      const response = await request(app)
        .get('/api/deployments/test-id')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid token' });
    });

    it('should handle malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/deployments/test-id')
        .set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid authorization header format' });
    });

    it('should handle expired token', async () => {
      jest.spyOn(require('../src/middleware/auth'), 'authenticateSupabase')
        .mockImplementationOnce((...args: unknown[]) => {
          const res = args[1] as express.Response;
          res.status(401).json({ error: 'Token expired' });
        });

      const response = await request(app)
        .get('/api/deployments/test-id')
        .set('Authorization', 'Bearer expired-token');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Token expired' });
    });
  });
}); 