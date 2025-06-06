import express from "express";
import {
  createDeployment,
  getDeployments,
  getDeploymentById,
  getServiceInstances,
  closeDeploymentHandler,
  getDeploymentsByType,
  deployModelFromTemplateHandler
} from "./deployments.controller";

const router = express.Router();

// Create deployment for an aquanode service
router.post('/deploy', createDeployment);

// Get all deployments for a user, optionally filtered by type
router.post("/", getDeployments);

// Get deployment info by deployment ID
router.get("/:deploymentId", getDeploymentById);

// Get all service instances for a user by service type
router.post("/service-instances", getServiceInstances);

// Close deployment
router.post("/close", closeDeploymentHandler);

// Get all deployments for a user, optionally filtered by type and provider
router.post("/user", getDeploymentsByType);

// Get template deployment for a model
router.post("/deploy-model-template", deployModelFromTemplateHandler); 

export default router;
