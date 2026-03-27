/**
 * MCP Tools — Phone Numbers
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebexApiClient } from "../webex-api.js";

export function registerNumberTools(server: McpServer, api: WebexApiClient) {
  // ── List Numbers ──
  server.registerTool(
    "list_numbers",
    {
      description: "List phone numbers in the organization. Can filter by location, specific number, " +
        "or availability status. Useful for auditing number usage and finding available numbers.",
      inputSchema: {
      locationId: z.string().optional().describe("Filter by location ID"),
      phoneNumber: z.string().optional().describe("Filter by exact phone number"),
      available: z
        .boolean()
        .optional()
        .describe("Filter available (unassigned) or assigned numbers"),
      max: z.number().optional().default(100).describe("Maximum results"),
      },
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
  server.registerTool(
    "find_available_numbers",
    {
      description: "Find phone numbers that are available (not assigned to any user, workspace, or feature). " +
        "Useful when you need to assign a number to a new user or hunt group.",
      inputSchema: {
      locationId: z.string().optional().describe("Limit search to a specific location"),
      max: z.number().optional().default(50).describe("Maximum results"),
      },
    },
    async (params) => {
      try {
        const result = (await api.listNumbers({
          location: params.locationId,
          available: true,
          max: params.max,
        })) as { phoneNumbers?: Array<{ phoneNumber: string; location?: { name: string }; phoneNumberType?: string }> };

        const numbers = (result.phoneNumbers || []).map((n) => ({
          number: n.phoneNumber,
          location: n.location?.name || "Unknown",
          type: n.phoneNumberType,
        }));

        // Group by location
        const byLocation = new Map<string, string[]>();
        for (const n of numbers) {
          const list = byLocation.get(n.location) || [];
          list.push(n.number);
          byLocation.set(n.location, list);
        }

        // Build a compact range description for consecutive numbers
        function formatRanges(nums: string[]): string {
          if (nums.length === 0) return "";
          const sorted = [...nums].sort();
          const ranges: string[] = [];
          let start = sorted[0];
          let prev = sorted[0];
          for (let i = 1; i < sorted.length; i++) {
            const prevNum = BigInt(prev.replace(/\D/g, ""));
            const currNum = BigInt(sorted[i].replace(/\D/g, ""));
            if (currNum === prevNum + 1n) {
              prev = sorted[i];
            } else {
              ranges.push(start === prev ? start : `${start} to ${prev}`);
              start = sorted[i];
              prev = sorted[i];
            }
          }
          ranges.push(start === prev ? start : `${start} to ${prev}`);
          return ranges.join(", ");
        }

        const lines: string[] = [];
        lines.push(`Available numbers: ${numbers.length}`);
        lines.push("");
        lines.push("| Site | Qty | Numbers |");
        lines.push("|---|---|---|");
        for (const [location, nums] of byLocation) {
          lines.push(`| ${location} | ${nums.length} | ${formatRanges(nums)} |`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
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
