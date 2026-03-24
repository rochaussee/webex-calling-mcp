/**
 * MCP Tools — Call Queues
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebexApiClient } from "../webex-api.js";

export function registerCallQueueTools(server: McpServer, api: WebexApiClient) {
  // ── List Call Queues ──
  server.registerTool(
    "list_call_queues",
    {
      description: "List all call queues in the organization. Optionally filter by location or name.",
      inputSchema: {
      locationId: z.string().optional().describe("Filter by location ID"),
      name: z.string().optional().describe("Filter by queue name"),
      max: z.number().optional().default(100).describe("Maximum results"),
      },
    },
    async (params) => {
      try {
        const result = await api.listCallQueues({
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

  // ── Get Call Queue Details ──
  server.registerTool(
    "get_call_queue",
    {
      description: "Get detailed configuration of a specific call queue, including agents, policies, and overflow settings.",
      inputSchema: {
        locationId: z.string().describe("The location ID of the call queue"),
        queueId: z.string().describe("The unique ID of the call queue"),
      },
    },
    async (params) => {
      try {
        const result = await api.getCallQueue(params.locationId, params.queueId);
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

  // ── Create Call Queue ──
  server.registerTool(
    "create_call_queue",
    {
      description: "Create a new call queue at a specific location. A call queue holds callers in a queue " +
        "and distributes calls to agents. Supports CIRCULAR, REGULAR, SIMULTANEOUS, UNIFORM, " +
        "WEIGHTED, and LONGEST_IDLE routing policies.",
      inputSchema: {
      locationId: z.string().describe("The location ID where the queue will be created"),
      name: z.string().describe("Name of the call queue"),
      phoneNumber: z
        .string()
        .optional()
        .describe("Phone number (E.164 format)"),
      extension: z.string().optional().describe("Extension number"),
      policy: z
        .enum(["CIRCULAR", "REGULAR", "SIMULTANEOUS", "UNIFORM", "WEIGHTED", "LONGEST_IDLE"])
        .default("LONGEST_IDLE")
        .describe("Call routing policy"),
      agentIds: z
        .array(z.string())
        .describe("Array of person IDs to add as agents"),
      queueSize: z
        .number()
        .optional()
        .default(25)
        .describe("Max number of callers allowed in the queue (2-525)"),
      enabled: z.boolean().optional().default(true).describe("Enable the queue"),
      },
    },
    async (params) => {
      try {
        const agents = params.agentIds.map((id) => ({ id }));
        const result = await api.createCallQueue(params.locationId, {
          name: params.name,
          phoneNumber: params.phoneNumber,
          extension: params.extension,
          callPolicies: {
            policy: params.policy,
          },
          queueSettings: {
            queueSize: params.queueSize,
          },
          agents,
          enabled: params.enabled,
        });
        return {
          content: [
            {
              type: "text",
              text: `Call queue "${params.name}" created successfully with ${agents.length} agents.\n${JSON.stringify(result, null, 2)}`,
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

  // ── Update Call Queue ──
  server.registerTool(
    "update_call_queue",
    {
      description: "Update an existing call queue — change agents, routing policy, queue size, etc.",
      inputSchema: {
      locationId: z.string().describe("The location ID of the call queue"),
      queueId: z.string().describe("The unique ID of the call queue to update"),
      name: z.string().optional().describe("New name"),
      policy: z
        .enum(["CIRCULAR", "REGULAR", "SIMULTANEOUS", "UNIFORM", "WEIGHTED", "LONGEST_IDLE"])
        .optional()
        .describe("New call routing policy"),
      agentIds: z
        .array(z.string())
        .optional()
        .describe("New list of person IDs for agents"),
      queueSize: z.number().optional().describe("New max queue size"),
      enabled: z.boolean().optional().describe("Enable or disable"),
      },
    },
    async (params) => {
      try {
        const settings: Record<string, unknown> = {};
        if (params.name) settings.name = params.name;
        if (params.policy) settings.callPolicies = { policy: params.policy };
        if (params.agentIds) settings.agents = params.agentIds.map((id) => ({ id }));
        if (params.queueSize) settings.queueSettings = { queueSize: params.queueSize };
        if (params.enabled !== undefined) settings.enabled = params.enabled;

        const result = await api.updateCallQueue(params.locationId, params.queueId, settings);
        return {
          content: [
            {
              type: "text",
              text: `Call queue updated successfully.\n${JSON.stringify(result, null, 2)}`,
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

  // ── Delete Call Queue ──
  server.registerTool(
    "delete_call_queue",
    {
      description: "Delete a call queue. This action cannot be undone.",
      inputSchema: {
        locationId: z.string().describe("The location ID of the call queue"),
        queueId: z.string().describe("The unique ID of the call queue to delete"),
      },
    },
    async (params) => {
      try {
        await api.deleteCallQueue(params.locationId, params.queueId);
        return {
          content: [{ type: "text", text: "Call queue deleted successfully." }],
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
