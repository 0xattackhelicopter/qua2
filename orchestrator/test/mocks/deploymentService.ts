export const mockDeploymentService = {
  createDeployment: jest.fn().mockResolvedValue({ id: 'test-deployment-id', status: 'created' }),
  getDeployments: jest.fn().mockResolvedValue([{ id: 'test-deployment-id', status: 'running' }]),
  getDeploymentById: jest.fn().mockResolvedValue({ id: 'test-deployment-id', status: 'running' }),
  getServiceInstances: jest.fn().mockResolvedValue([{ id: 'test-instance-id', status: 'running' }]),
  closeDeployment: jest.fn().mockResolvedValue({ id: 'test-deployment-id', status: 'closed' }),
  getDeploymentsByType: jest.fn().mockResolvedValue([{ id: 'test-deployment-id', status: 'running' }])
}; 