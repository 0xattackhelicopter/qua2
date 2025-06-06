import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../../../constants";
import { logger } from "../../../utils/logger";
import { Deployment } from "../../types/db";
import { ServiceType } from "../../types/services";

// Create a single instance of the Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);



// Deployment-related database operations
export const deploymentDb = {
  async getByLeaseId(leaseId: string): Promise<Deployment | null> {
    const { data, error } = await supabase
      .from("deployments")
      .select("*")
      .eq("lease_id", leaseId)
      .single();

    if (error) {
      logger.error(`Error fetching deployment by lease ID: ${error.message}`);
      return null;
    }

    return data as Deployment | null;
  },

  async getByMonitoringId(monitoringId: string): Promise<Deployment | null> {
    const { data, error } = await supabase
      .from("deployments")
      .select("*")
      .eq("monitoring_id", monitoringId)
      .single();

    if (error) {
      logger.error(`Error fetching deployment by monitoring ID: ${error.message}`);
      return null;
    }
    return data as Deployment | null;
  },


  async linkDeploymentToMonitoringId(deploymentId: number, monitoringId: string): Promise<void> {
    const { data, error } = await supabase
      .from("deployments")
      .update({ monitoring_id: monitoringId })
      .eq("id", deploymentId)
      .select("*")
      .single();

    if (error) {
      logger.error(`Error linking deployment to monitoring ID: ${error.message}`);
      throw error;
    }
  },

  // Get deployment by deployment ID
  async getByDeploymentId(deploymentId: number): Promise<Deployment | null> {
    const { data, error } = await supabase
      .from("deployments")
      .select("*")
      .eq("id", deploymentId)
      .single();

    if (error) {
      logger.error(
        `Error fetching deployment by deployment ID: ${error.message}`
      );
      return null;
    }

    return data as Deployment | null;
  },

  async getByUser(
    userId: string,
    type: ServiceType | null,
    sortByTime: boolean = true,
    provider: string | null = null
  ): Promise<Deployment[]> {
    let query = supabase.from("deployments").select("*").eq("user", userId);

    if (type) {
      query = query.eq("deployment_type", type.toLocaleLowerCase());
    }

    if (provider && provider !== "auto") {
      query = query.eq("provider", provider.toLocaleLowerCase());
    }

    if (sortByTime) {
      query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      logger.error(`Error fetching deployments by user: ${error.message}`);
      throw error;
    }

    return data as Deployment[];
  },

  async create(deployment: Partial<Deployment>): Promise<Deployment> {
    const { data, error } = await supabase
      .from("deployments")
      .insert([deployment])
      .select("*")
      .single();

    if (error) {
      logger.error(`Error creating deployment: ${error.message}`);
      throw error;
    }

    return data as Deployment;
  },

  async updateByDeploymentId(
    deploymentId: number,
    updates: Partial<Deployment>
  ): Promise<Deployment | null> {
    const { data, error } = await supabase
      .from("deployments")
      .update(updates)
      .eq("id", deploymentId)
      .select("*")
      .single();

    if (error) {
      logger.error(`Error updating deployment: ${error.message}`);
      return null;
    }

    return data as Deployment;
  },

  async update(
    leaseId: string,
    updates: Partial<Deployment>
  ): Promise<Deployment | null> {
    const { data, error } = await supabase
      .from("deployments")
      .update(updates)
      .eq("lease_id", leaseId)
      .select("*")
      .single();

    if (error) {
      logger.error(`Error updating deployment: ${error.message}`);
      return null;
    }

    return data as Deployment;
  },
};

export default supabase;
