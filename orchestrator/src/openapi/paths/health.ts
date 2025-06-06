/**
 * @swagger
 * /:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the server health status and current timestamp
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: Server is Healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */ 