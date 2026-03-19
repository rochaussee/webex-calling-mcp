/**
 * MCP Tools — Phone Numbers
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebexApiClient } from "../webex-api.js";

export function registerNumberTools(server: McpServer, api: WebexApiClient) {
  // ── List Numbers ──
  server.tool(
    "list_numbers",
    "List phone numbers in the organization. Can filter by location, specific number, " +
      "or availability status. Useful for auditing number usage and finding available numbers.",
    {
      locationId: z.string().optional().describe("Filter by location ID"),
      phoneNumber: z.string().optional().describe("Filter by exact phone number"),
      available: z
        .boolean()
        .optional()
        .describe("Filter available (unassigned) or assigned numbers"),
      max: z.number().optional().default(100).describe("Maximum results"),
    },
    async (params) => {
      try {
        const result = await api.listNumbers({
          location: params.locationId,
          phoneNumber: params.phoneNumber,
          available: params.available,
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

  // ── Find Available Numbers ──
  server.tool(
    "find_available_numbers",
    "Find phone numbers that are available (not assigned to any user, workspace, or feature). " +
      "Useful when you need to assign a number to a new user or hunt group.",
    {
      locationId: z.string().optional().describe("Limit search to a specific location"),
      max: z.number().optional().default(50).describe("Maximum results"),
    },
    async (params) => {
      try {
        const result = (await api.listNumbers({
          location: params.locationId,
          available: true,
          max: params.max,
        })) as { phoneNumbers?: Array<{ phoneNumber: string; location?: { name: string }; phoneNumberType?: string }> };

        const summary = {
          availableCount: (result.phoneNumbers || []).length,
          numbers: (result.phoneNumbers || []).map((n) => ({
            number: n.phoneNumber,
            location: n.location?.name,
            type: n.phoneNumberType,
          })),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
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
