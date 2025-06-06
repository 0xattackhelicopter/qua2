import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Orchestrator API Documentation',
      version: '1.0.0',
      description: 'API documentation for the Orchestrator service',
    },
    servers: [
      {
        url: `http://localhost:${process.env.WEBHOOK_PORT || 3000}`,
        description: 'Development server',
      },
    ],
  },
  apis: [
    './src/openapi/**/*.ts'
  ],
};

export const specs = swaggerJsdoc(options); 