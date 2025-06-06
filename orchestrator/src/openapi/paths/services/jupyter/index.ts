/**
 * @swagger
 * /api/services/jupyter/deploy-default:
 *   post:
 *     tags: [Jupyter Services]
 *     summary: Deploy a default Jupyter notebook instance
 *     description: Creates a new Jupyter notebook instance with default configuration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeployDefaultJupyter'
 *     responses:
 *       200:
 *         description: Jupyter notebook instance created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 * 
 * /api/services/jupyter/deploy-custom:
 *   post:
 *     tags: [Jupyter Services]
 *     summary: Deploy a custom Jupyter notebook instance
 *     description: Creates a new Jupyter notebook instance with custom configuration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeployCustomJupyter'
 *     responses:
 *       200:
 *         description: Custom Jupyter notebook instance created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */ 