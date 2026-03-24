/**
 * MCP Tools — Hunt Groups
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebexApiClient } from "../webex-api.js";

export function registerHuntGroupTools(server: McpServer, api: WebexApiClient) {
  // ── List Hunt Groups ──
  server.registerTool(
    "list_hunt_groups",
    {
      description: "List all hunt groups in the organization. Optionally filter by location or name.",
      inputSchema: {
      locationId: z.string().optional().describe("Filter by location ID"),
      name: z.string().optional().describe("Filter by hunt group name"),
      max: z.number().optional().default(100).describe("Maximum results"),
      },
    },
    async (params) => {
      try {
        const result = await api.listHuntGroups({
          locationId: params.locationId,
          name: params.name,
          max: params.max,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Get Hunt Group Details ──
  server.registerTool(
    "get_hunt_group",
    {
      description: "Get detailed configuration of a specific hunt group, including agents and call policies.",
      inputSchema: {
        locationId: z.string().describe("The location ID of the hunt group"),
        huntGroupId: z.string().describe("The unique ID of the hunt group"),
      },
    },
    async (params) => {
      try {
        const result = await api.getHuntGroup(params.locationId, params.huntGroupId);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Create Hunt Group ──
  server.registerTool(
    "create_hunt_group",
    {
      description: "Create a new hunt group at a specific location. A hunt group rings a set of agents " +
        "based on a routing policy (CIRCULAR = round-robin, REGULAR = top-down, SIMULTANEOUS = ring all, " +
        "UNIFORM = longest idle, WEIGHTED = weighted distribution). " +
        'Example: "Create a hunt group for the support team with 5 agents using round-robin."',
      inputSchema: {
      locationId: z.string().describe("The location ID where the hunt group will be created"),
      name: z.string().describe("Name of the hunt group"),
      phoneNumber: z
        .string()
        .optional()
        .describe("Phone number to assign (E.164 format, e.g., +33140000000)"),
      extension: z.string().optional().describe("Extension number"),
      policy: z
        .enum(["CIRCULAR", "REGULAR", "SIMULTANEOUS", "UNIFORM", "WEIGHTED"])
        .default("CIRCULAR")
        .describe(
          "Call routing policy: CIRCULAR=round-robin, REGULAR=top-down, " +
            "SIMULTANEOUS=ring all, UNIFORM=longest idle, WEIGHTED=weighted"
        ),
      agentIds: z
        .array(z.string())
        .describe("Array of person IDs to add as agents in this hunt group"),
      enabled: z.boolean().optional().default(true).describe("Enable the hunt group"),
      },
    },
    async (params) => {
      try {
        const agents = params.agentIds.map((id) => ({ id }));
        const result = await api.createHuntGroup(params.locationId, {
          name: params.name,
          phoneNumber: params.phoneNumber,
          extension: params.extension,
          callPolicies: {
            policy: params.policy,
          },
          agents,
          enabled: params.enabled,
        });
        return {
          content: [
            {
              type: "text",
              text: `Hunt group "${params.name}" created successfully with ${agents.length} agents using ${params.policy} policy.\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Update Hunt Group ──
  server.registerTool(
    "update_hunt_group",
    {
      description: "Update an existing hunt group's configuration — change agents, routing policy, name, etc.",
      inputSchema: {
      locationId: z.string().describe("The location ID of the hunt group"),
      huntGroupId: z.string().describe("The unique ID of the hunt group to update"),
      name: z.string().optional().describe("New name for the hunt group"),
      policy: z
        .enum(["CIRCULAR", "REGULAR", "SIMULTANEOUS", "UNIFORM", "WEIGHTED"])
        .optional()
        .describe("New call routing policy"),
      agentIds: z
        .array(z.string())
        .optional()
        .describe("New list of person IDs for agents (replaces existing agents)"),
      enabled: z.boolean().optional().describe("Enable or disable the hunt group"),
      },
    },
    async (params) => {
      try {
        const settings: Record<string, unknown> = {};
        if (params.name) settings.name = params.name;
        if (params.policy) settings.callPolicies = { policy: params.policy };
        if (params.agentIds) settings.agents = params.agentIds.map((id) => ({ id }));
        if (params.enabled !== undefined) settings.enabled = params.enabled;

        const result = await api.updateHuntGroup(params.locationId, params.huntGroupId, settings);
        return {
          content: [
            {
              type: "text",
              text: `Hunt group updated successfully.\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Delete Hunt Group ──
  server.registerTool(
    "delete_hunt_group",
    {
      description: "Delete a hunt group. This action cannot be undone.",
      inputSchema: {
        locationId: z.string().describe("The location ID of the hunt group"),
        huntGroupId: z.string().describe("The unique ID of the hunt group to delete"),
      },
    },
    async (params) => {
      try {
        await api.deleteHuntGroup(params.locationId, params.huntGroupId);
        return {
          content: [{ type: "text", text: "Hunt group deleted successfully." }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
