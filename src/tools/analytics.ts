/**
 * MCP Tools — Call Analytics & Call Detail Records (CDR)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebexApiClient } from "../webex-api.js";

export function registerAnalyticsTools(server: McpServer, api: WebexApiClient) {
  // ── Get Call History / CDR ──
  server.tool(
    "get_call_history",
    "Retrieve call detail records (CDR) for the organization. " +
      "Use this to generate reports on missed calls, call volumes, durations, etc. " +
      'Example: "Generate a report of missed calls over the last 24 hours."',
    {
      startTime: z
        .string()
        .optional()
        .describe(
          "Start time in ISO 8601 format (e.g., 2025-03-16T00:00:00.000Z). " +
            "Defaults to 48 hours ago if not specified."
        ),
      endTime: z
        .string()
        .optional()
        .describe("End time in ISO 8601 format. Defaults to now if not specified."),
      locationId: z.string().optional().describe("Filter by location ID"),
      max: z.number().optional().default(200).describe("Maximum number of records"),
    },
    async (params) => {
      try {
        // CDR API constraints: startTime between 5min and 48h ago, endTime at least 5min ago, max range 12h
        const now = Date.now();
        const fiveMinAgo = new Date(now - 5 * 60 * 1000).toISOString();
        const twelveHoursAgo = new Date(now - 12 * 60 * 60 * 1000).toISOString();

        const result = await api.getCallDetailRecords({
          startTime: params.startTime || twelveHoursAgo,
          endTime: params.endTime || fiveMinAgo,
          locations: params.locationId,
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

  // ── Missed Calls Report ──
  server.tool(
    "get_missed_calls_report",
    "Generate a summary report of missed calls for the organization or a specific location. " +
      "Returns total missed calls, breakdown by user, and time distribution. " +
      "Ideal for quick dashboards and partner demos.",
    {
      startTime: z
        .string()
        .optional()
        .describe("Start time in ISO 8601 format (defaults to 24 hours ago)"),
      endTime: z
        .string()
        .optional()
        .describe("End time in ISO 8601 format (defaults to now)"),
      locationId: z.string().optional().describe("Filter by location ID"),
      max: z.number().optional().default(500).describe("Maximum CDR records to analyze"),
    },
    async (params) => {
      try {
        // CDR API constraints: endTime must be at least 5 minutes in the past
        const now = Date.now();
        const fiveMinAgo = new Date(now - 5 * 60 * 1000);
        const yesterday = new Date(now - 24 * 60 * 60 * 1000);
        const startTime = params.startTime || yesterday.toISOString();
        const endTime = params.endTime || fiveMinAgo.toISOString();

        const result = (await api.getCallDetailRecords({
          startTime,
          endTime,
          locations: params.locationId,
          max: params.max,
        })) as { items?: Array<{ 
          callType?: string; 
          answered?: string; 
          calledNumber?: string; 
          callingNumber?: string; 
          calledUser?: string;
          callingUser?: string;
          startTime?: string;
          duration?: number;
          direction?: string;
          originalReason?: string;
        }> };

        const records = result.items || [];
        const missedCalls = records.filter(
          (r) => r.answered === "false" || r.originalReason === "Unanswered"
        );

        // Group by called user
        const byUser: Record<string, number> = {};
        for (const call of missedCalls) {
          const user = call.calledUser || call.calledNumber || "Unknown";
          byUser[user] = (byUser[user] || 0) + 1;
        }

        // Sort by count descending
        const topMissed = Object.entries(byUser)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 20)
          .map(([user, count]) => ({ user, missedCalls: count }));

        // Group by hour
        const byHour: Record<string, number> = {};
        for (const call of missedCalls) {
          if (call.startTime) {
            const hour = call.startTime.substring(0, 13); // YYYY-MM-DDTHH
            byHour[hour] = (byHour[hour] || 0) + 1;
          }
        }

        const report = {
          period: { startTime, endTime },
          totalRecords: records.length,
          totalMissedCalls: missedCalls.length,
          missedCallRate:
            records.length > 0
              ? `${((missedCalls.length / records.length) * 100).toFixed(1)}%`
              : "N/A",
          topUsersByMissedCalls: topMissed,
          missedCallsByHour: byHour,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
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
