/**
 * @swagger
 * /api/user/register:
 *   post:
 *     tags: [User Management]
 *     summary: Register a new user
 *     description: Register a new user by their address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *             properties:
 *               address:
 *                 type: string
 *                 description: The user's address
 *     responses:
 *       200:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Address already exists
 *                 user:
 *                   type: integer
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Address added successfully
 *                 user:
 *                   type: integer
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */ 