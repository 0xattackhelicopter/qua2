/**
 * @swagger
 * /api/services/backend/deploy-default:
 *   post:
 *     tags: [Backend Services]
 *     summary: Deploy a backend service with default configuration
 *     description: Creates a new backend service deployment with default configuration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: integer
 *                 format: int64
 *                 description: The ID of the user requesting the deployment
 *               env:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *                 description: Environment variables for the deployment
 *               provider:
 *                 type: string
 *                 enum: [AUTO, AKASH, SPHERON]
 *                 default: AUTO
 *                 description: Cloud provider for deployment
 *     responses:
 *       200:
 *         description: Backend service deployed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 deploymentId:
 *                   type: string
 *                 url:
 *                   type: string
 *                   format: url
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 * 
 * /api/services/backend/deploy-custom:
 *   post:
 *     tags: [Backend Services]
 *     summary: Deploy a backend service with custom configuration
 *     description: Creates a new backend service deployment with the specified configuration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeployBackend'
 *     responses:
 *       200:
 *         description: Backend service deployed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 deploymentId:
 *                   type: string
 *                 url:
 *                   type: string
 *                   format: url
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 * 
 * /api/admin/credits:
 *   post:
 *     operationId: addCredits
 *     summary: Add credits to a user account
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         "application/json":
 *           schema:
 *             type: object
 *             required:
 *               - userAddress
 *               - credits
 *             properties:
 *               userAddress:
 *                 type: string
 *                 description: The address of the user to add credits to
 *               credits:
 *                 type: number
 *                 description: The amount of credits to add
 *     responses:
 *       200:
 *         description: Credits added successfully
 *         content:
 *           "application/json":
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not an admin
 */ 