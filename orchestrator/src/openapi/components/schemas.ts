/**
 * @swagger
 * components:
 *   schemas:
 *     DeploymentConfig:
 *       type: object
 *       required:
 *         - appPort
 *         - deploymentDuration
 *         - appCpuUnits
 *         - appMemorySize
 *         - appStorageSize
 *         - image
 *       properties:
 *         appPort:
 *           type: integer
 *           description: Port number for the application
 *         deploymentMode:
 *           type: string
 *           description: Optional deployment mode configuration
 *         deploymentDuration:
 *           type: string
 *           description: Duration of the deployment (e.g., "1h", "1d")
 *         appCpuUnits:
 *           type: integer
 *           description: Number of CPU units to allocate
 *         appMemorySize:
 *           type: string
 *           description: Memory size (e.g., "2Gi", "512Mi")
 *         appStorageSize:
 *           type: string
 *           description: Storage size (e.g., "10Gi", "1Ti")
 *         image:
 *           type: string
 *           description: Docker image for the backend service
 *     DeployBackend:
 *       type: object
 *       required:
 *         - userId
 *         - config
 *       properties:
 *         userId:
 *           type: integer
 *           format: int64
 *           description: The ID of the user requesting the deployment
 *         repoUrl:
 *           type: string
 *           format: url
 *           description: Optional Git repository URL
 *         branchName:
 *           type: string
 *           default: main
 *           description: Git branch name
 *         env:
 *           type: object
 *           additionalProperties:
 *             type: string
 *           description: Environment variables for the deployment
 *         config:
 *           $ref: '#/components/schemas/DeploymentConfig'
 *         provider:
 *           type: string
 *           enum: [AUTO, AKASH, SPHERON]
 *           default: AUTO
 *           description: Cloud provider for deployment
 *     DeployDefaultJupyter:
 *       type: object
 *       required:
 *         - userId
 *       properties:
 *         userId:
 *           type: integer
 *           format: int64
 *           description: The ID of the user requesting the deployment
 *     DeployCustomJupyter:
 *       type: object
 *       required:
 *         - userId
 *         - cpuUnits
 *         - memorySize
 *         - storageSize
 *         - duration
 *       properties:
 *         userId:
 *           type: integer
 *           format: int64
 *           description: The ID of the user requesting the deployment
 *         cpuUnits:
 *           type: integer
 *           description: Number of CPU units to allocate
 *         memorySize:
 *           type: string
 *           description: Memory size (e.g., "2Gi", "512Mi")
 *         storageSize:
 *           type: string
 *           description: Storage size (e.g., "10Gi", "1Ti")
 *         duration:
 *           type: string
 *           description: Duration of the deployment (e.g., "1h", "1d")
 *         image:
 *           type: string
 *           description: Optional custom Jupyter notebook image
 */ 