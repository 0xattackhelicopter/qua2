/**
 * @swagger
 * /api/deployments:
 *   post:
 *     tags: [Deployments]
 *     summary: Get all deployments for a user
 *     description: Retrieve all deployments for a user, optionally filtered by provider
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user
 *             properties:
 *               user:
 *                 type: integer
 *                 format: int64
 *                 description: The user ID
 *               provider:
 *                 type: string
 *                 enum: [AUTO, AKASH, SPHERON]
 *                 description: Optional provider filter
 *     responses:
 *       200:
 *         description: List of deployments
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 * 
 * /api/deployments/create:
 *   post:
 *     tags: [Deployments]
 *     summary: Create a new deployment
 *     description: Create a new deployment from a repository
 *     deprecated: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user
 *               - repoUrl
 *               - branchName
 *               - config
 *             properties:
 *               user:
 *                 type: integer
 *                 format: int64
 *                 description: The user ID
 *               repoUrl:
 *                 type: string
 *                 description: URL of the repository to deploy
 *               branchName:
 *                 type: string
 *                 description: Branch name to deploy
 *               env:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *                 description: Environment variables for the deployment
 *               config:
 *                 type: object
 *                 required:
 *                   - appPort
 *                 properties:
 *                   appPort:
 *                     type: integer
 *                     description: Port the application runs on
 *                   deploymentDuration:
 *                     type: string
 *                     description: Duration of the deployment
 *                   appCpuUnits:
 *                     type: integer
 *                     description: CPU units for the application
 *                   appMemorySize:
 *                     type: string
 *                     description: Memory size for the application
 *                   appStorageSize:
 *                     type: string
 *                     description: Storage size for the application
 *                   deploymentMode:
 *                     type: string
 *                     description: Mode of deployment
 *                   monitorCpuUnits:
 *                     type: integer
 *                     description: CPU units for the monitor
 *                   monitorMemorySize:
 *                     type: string
 *                     description: Memory size for the monitor
 *                   monitorStorageSize:
 *                     type: string
 *                     description: Storage size for the monitor
 *                   image:
 *                     type: string
 *                     description: Docker image to use
 *                   provider:
 *                     type: string
 *                     enum: [AUTO, AKASH, SPHERON]
 *                     description: Provider to deploy to
 *               serviceType:
 *                 type: string
 *                 enum: [JUPYTER, BACKEND]
 *                 default: BACKEND
 *                 description: Type of service to deploy
 *     responses:
 *       201:
 *         description: Deployment created successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 *
 * /api/services/backend/deploy-custom:
 *   post:
 *     tags: [Backend Services]
 *     summary: Create a new backend deployment
 *     description: Create a new backend deployment from a repository (replaces /api/deployments/create)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - repoUrl
 *               - branchName
 *               - config
 *             properties:
 *               repoUrl:
 *                 type: string
 *                 description: URL of the repository to deploy
 *               branchName:
 *                 type: string
 *                 description: Branch name to deploy
 *               env:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *                 description: Environment variables for the deployment
 *               config:
 *                 type: object
 *                 required:
 *                   - appPort
 *                 properties:
 *                   appPort:
 *                     type: integer
 *                     description: Port the application runs on
 *                   deploymentDuration:
 *                     type: string
 *                     description: Duration of the deployment
 *                   appCpuUnits:
 *                     type: integer
 *                     description: CPU units for the application
 *                   appMemorySize:
 *                     type: string
 *                     description: Memory size for the application
 *                   appStorageSize:
 *                     type: string
 *                     description: Storage size for the application
 *                   deploymentMode:
 *                     type: string
 *                     description: Mode of deployment
 *                   monitorCpuUnits:
 *                     type: integer
 *                     description: CPU units for the monitor
 *                   monitorMemorySize:
 *                     type: string
 *                     description: Memory size for the monitor
 *                   monitorStorageSize:
 *                     type: string
 *                     description: Storage size for the monitor
 *                   image:
 *                     type: string
 *                     description: Docker image to use
 *                   provider:
 *                     type: string
 *                     enum: [AUTO, AKASH, SPHERON]
 *                     description: Provider to deploy to
 *               serviceType:
 *                 type: string
 *                 enum: [JUPYTER, BACKEND]
 *                 default: BACKEND
 *                 description: Type of service to deploy
 *     responses:
 *       201:
 *         description: Deployment created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 * 
 * /api/services/backend/create:
 *   post:
 *     tags: [Backend Services]
 *     summary: Create a new backend deployment (deprecated)
 *     description: This endpoint is deprecated, please use /api/services/backend/deploy-custom instead
 *     deprecated: true
 *     responses:
 *       301:
 *         description: Redirected to /api/services/backend/deploy-custom
 *
 * /api/deployments/{deploymentId}:
 *   get:
 *     tags: [Deployments]
 *     summary: Get deployment by ID
 *     description: Retrieve deployment information by its ID
 *     parameters:
 *       - in: path
 *         name: deploymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The deployment ID
 *     responses:
 *       200:
 *         description: Deployment information
 *       404:
 *         description: Deployment not found
 *       500:
 *         description: Server error
 * 
 * /api/deployments/service-instances:
 *   post:
 *     tags: [Deployments]
 *     summary: Get service instances by type
 *     description: Retrieve all service instances for a user by service type
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user
 *               - serviceType
 *             properties:
 *               user:
 *                 type: integer
 *                 format: int64
 *                 description: The user ID
 *               serviceType:
 *                 type: string
 *                 enum: [JUPYTER, BACKEND]
 *                 description: Type of service
 *     responses:
 *       200:
 *         description: List of service instances
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 * 
 * /api/deployments/close:
 *   post:
 *     tags: [Deployments]
 *     summary: Close a deployment
 *     description: Close and cleanup a deployment by its ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deploymentId
 *             properties:
 *               deploymentId:
 *                 type: string
 *                 description: The deployment ID to close
 *     responses:
 *       200:
 *         description: Deployment closed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Deployment closed successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 * 
 * /api/deployments/user:
 *   post:
 *     tags: [Deployments]
 *     summary: Get user deployments by type
 *     description: Retrieve all deployments for a user, optionally filtered by service type
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user
 *             properties:
 *               user:
 *                 type: integer
 *                 format: int64
 *                 description: The user ID
 *               type:
 *                 type: string
 *                 enum: [JUPYTER, BACKEND]
 *                 description: Optional service type filter
 *     responses:
 *       200:
 *         description: List of deployments
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */ 