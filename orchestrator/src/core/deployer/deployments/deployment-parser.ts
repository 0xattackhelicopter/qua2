import axios from 'axios';
import { logger } from '../../../utils/logger';
import { 
  DeploymentRequest, 
  RESOURCE_LIMITS,
  DEFAULT_DEPLOYMENT_VALUES
} from '../../types/agent';
import { ProviderType } from '../../types/deployments';

// LLM client for parsing deployment requests
const client = axios.create({
  baseURL: 'https://chatapi.akash.network/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.AKASH_CHAT_API_KEY}`
  }
});

// System prompt for parsing deployment requests
const DEPLOYMENT_PARSER_PROMPT = `You are a deployment request parser. Your task is to extract deployment information from user messages.
When a user asks to deploy an application, extract the following information:
1. GitHub/GitLab repository URL
2. Branch name (default to 'main' if not specified)
3. Resource requirements (CPU, memory, storage, port)

Your response must be a valid JSON object with the following structure:
{
  "repoUrl": "The repository URL (e.g., https://github.com/username/repo)",
  "branchName": "The branch name (default: main)",
  "resources": {
    "cpuUnits": number (default: 1),
    "memorySize": "Amount of memory (e.g., '1Gi', '512Mi')",
    "storageSize": "Amount of storage (e.g., '1Gi', '512Mi')",
    "port": number (default: 3000)
  }
}

Only respond with this JSON object and nothing else. If you cannot find some information, use default values. If you cannot find a repository URL, return { "error": "No repository URL found" }.`;

/**
 * Extracts deployment request information from a user message using LLM.
 * This approach avoids using regex and relies on the LLM's understanding of natural language.
 * 
 * @param userMessage - The user's message containing deployment information
 * @returns A promise resolving to DeploymentRequest if successful, or null if no repository is found
 */
export async function parseDeploymentRequest(userMessage: string): Promise<DeploymentRequest | null> {
  try {
    logger.info('Parsing deployment request from user message');
    
    // Request LLM to parse the deployment request
    const response = await client.post('/chat/completions', {
      model: "Meta-Llama-3-1-8B-Instruct-FP8",
      messages: [
        { role: 'system', content: DEPLOYMENT_PARSER_PROMPT },
        { role: 'user', content: userMessage }
      ],
      stream: false
    });
    
    const content = response.data.choices[0].message.content;
    logger.info(`LLM parser response: ${content}`);
    
    // Parse the JSON response
    const parsedResponse = JSON.parse(content);
    
    // Check for error case
    if (parsedResponse.error) {
      logger.warn(`Deployment parser error: ${parsedResponse.error}`);
      return null;
    }
    
    // Extract and validate repository info
    if (!parsedResponse.repoUrl) {
      logger.warn('No repository URL found in the parsed response');
      return null;
    }
    
    // Extract resources with defaults for missing values
    const resources = parsedResponse.resources || {};
    
    // Build the deployment request
    const deploymentRequest: DeploymentRequest = {
      repoUrl: parsedResponse.repoUrl,
      branchName: parsedResponse.branchName || DEFAULT_DEPLOYMENT_VALUES.branchName,
      cpuUnits: validateCpuUnits(resources.cpuUnits),
      memorySize: validateMemorySize(resources.memorySize),
      storageSize: validateStorageSize(resources.storageSize),
      port: resources.port || DEFAULT_DEPLOYMENT_VALUES.port,
      provider: ProviderType.AUTO
    };
    
    logger.info(`Parsed deployment request: ${JSON.stringify(deploymentRequest)}`);
    return deploymentRequest;
    
  } catch (error: any) {
    logger.error(`Error parsing deployment request: ${error.message}`);
    return null;
  }
}

/**
 * Validates and normalizes CPU units to ensure they are within limits
 */
function validateCpuUnits(cpuUnits?: number): number {
  if (!cpuUnits || isNaN(cpuUnits)) {
    return DEFAULT_DEPLOYMENT_VALUES.cpuUnits;
  }
  
  return Math.min(Math.max(1, cpuUnits), RESOURCE_LIMITS.MAX_CPU);
}

/**
 * Validates and normalizes memory size to ensure it is within limits
 * Converts to Kubernetes format (Mi, Gi) if needed
 */
function validateMemorySize(memorySize?: string): string {
  if (!memorySize) {
    return DEFAULT_DEPLOYMENT_VALUES.memorySize;
  }
  
  // Extract value and unit
  const match = memorySize.match(/^(\d+)([a-zA-Z]+)$/);
  if (!match) {
    return DEFAULT_DEPLOYMENT_VALUES.memorySize;
  }
  
  const value = parseInt(match[1]);
  let unit = match[2].toLowerCase();
  
  // Normalize unit to Kubernetes format
  if (unit === 'g' || unit === 'gb') {
    unit = 'Gi';
  } else if (unit === 'm' || unit === 'mb') {
    unit = 'Mi';
  } else if (unit !== 'gi' && unit !== 'mi') {
    // If unit is not recognized, use default
    return DEFAULT_DEPLOYMENT_VALUES.memorySize;
  }
  
  // Convert to Gi for comparison
  let valueInGi = value;
  if (unit === 'Mi' || unit === 'mi') {
    valueInGi = value / 1024;
  }
  
  // Check if exceeds maximum
  const maxMemoryValueInGi = parseInt(RESOURCE_LIMITS.MAX_RAM.replace(/[^0-9]/g, ''));
  if (valueInGi > maxMemoryValueInGi) {
    return RESOURCE_LIMITS.MAX_RAM;
  }
  
  return `${value}${unit}`;
}

/**
 * Validates and normalizes storage size to ensure it is within limits
 * Converts to Kubernetes format (Mi, Gi) if needed
 */
function validateStorageSize(storageSize?: string): string {
  if (!storageSize) {
    return DEFAULT_DEPLOYMENT_VALUES.storageSize;
  }
  
  // Extract value and unit
  const match = storageSize.match(/^(\d+)([a-zA-Z]+)$/);
  if (!match) {
    return DEFAULT_DEPLOYMENT_VALUES.storageSize;
  }
  
  const value = parseInt(match[1]);
  let unit = match[2].toLowerCase();
  
  // Normalize unit to Kubernetes format
  if (unit === 'g' || unit === 'gb') {
    unit = 'Gi';
  } else if (unit === 'm' || unit === 'mb') {
    unit = 'Mi';
  } else if (unit !== 'gi' && unit !== 'mi') {
    // If unit is not recognized, use default
    return DEFAULT_DEPLOYMENT_VALUES.storageSize;
  }
  
  // Convert to Gi for comparison
  let valueInGi = value;
  if (unit === 'Mi' || unit === 'mi') {
    valueInGi = value / 1024;
  }
  
  // Check if exceeds maximum
  const maxStorageValueInGi = parseInt(RESOURCE_LIMITS.MAX_STORAGE.replace(/[^0-9]/g, ''));
  if (valueInGi > maxStorageValueInGi) {
    return RESOURCE_LIMITS.MAX_STORAGE;
  }
  
  return `${value}${unit}`;
}

/**
 * Checks if a message indicates a deployment request.
 * Using a simple keyword detection approach.
 */
export function isDeploymentRequest(message: string): boolean {
  const deploymentKeywords = [
    'deploy', 'create deployment', 'setup deployment', 
    'launch website', 'launch app', 'launch service', 
    'host code', 'host repo', 'host website'
  ];
  
  const lowercaseMessage = message.toLowerCase();
  return deploymentKeywords.some(keyword => lowercaseMessage.includes(keyword));
} 