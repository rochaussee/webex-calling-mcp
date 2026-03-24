/**
 * MCP Tools — Call Analytics & Call Detail Records (CDR)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebexApiClient } from "../webex-api.js";

/** Shape of a single CDR record from the Webex analytics API */
interface CdrRecord {
  "User": string;
  "Direction": string;
  "Answered": string;
  "Called line ID": string;
  "Calling line ID": string;
  "Called number": string;
  "Calling number": string;
  "Start time": string;
  "Duration": number;
  "Correlation ID": string;
  "Call type": string;
  "Client type": string;
  "Sub client type": string;
  "Model": string;
  "Location": string;
  "User number": string;
  "Dialed digits": string;
  "Call outcome": string;
  "Call outcome reason": string;
  "Ring duration": string;
  "Original reason": string;
  [key: string]: unknown;
}

/** Format a duration in seconds to a human-readable string */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m${secs.toString().padStart(2, "0")}s`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h${remainMins.toString().padStart(2, "0")}m`;
}

/** Determine a friendly device label from CDR fields */
function getDeviceLabel(record: CdrRecord): string {
  const model = record["Model"];
  if (model && model !== "na" && model !== "") return `Cisco ${model}`;
  const sub = record["Sub client type"];
  if (sub === "MOBILE_APP") return "App Mobile";
  if (sub === "DESKTOP_APP") return "App Desktop";
  const client = record["Client type"];
  if (client === "TEAMS_WXC_CLIENT") return "Webex App";
  if (client === "WXC_DEVICE") return "Cisco Phone";
  if (client === "SIP") return "SIP";
  return client || "Unknown";
}

export function registerAnalyticsTools(server: McpServer, api: WebexApiClient) {
  // ── Get Call History / CDR ──
  server.registerTool(
    "get_call_history",
    {
      description: "Retrieve call detail records (CDR) for the organization. " +
        "Can filter by person (name or ID), direction, call status, and location. " +
        "Returns a formatted summary with deduplicated calls. " +
        'Examples: "Show me Ronan\'s calls from yesterday", "List missed calls for the Paris office".',
      inputSchema: {
      startTime: z
        .string()
        .optional()
        .describe(
          "Start time in ISO 8601 format (e.g., 2025-03-16T00:00:00.000Z). " +
            "Defaults to 12 hours ago if not specified."
        ),
      endTime: z
        .string()
        .optional()
        .describe("End time in ISO 8601 format. Defaults to now if not specified."),
      personId: z
        .string()
        .optional()
        .describe("Filter by person ID (Webex ID). Only show calls for this user."),
      personName: z
        .string()
        .optional()
        .describe(
          "Filter by person display name (case-insensitive partial match). " +
            'E.g., "Ronan" will match "Ronan CHAUSSEE".'
        ),
      direction: z
        .enum(["placed", "received", "missed", "all"])
        .optional()
        .default("all")
        .describe(
          "Filter calls: 'placed' (outgoing), 'received' (incoming answered), " +
            "'missed' (incoming unanswered), 'all' (default)"
        ),
      locationId: z.string().optional().describe("Filter by location ID"),
      max: z.number().optional().default(500).describe("Maximum number of raw CDR records to fetch"),
      rawOutput: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, return raw CDR JSON instead of formatted summary"),
      },
    },
    async (params) => {
      try {
        const now = Date.now();
        const tenMinAgo = new Date(now - 10 * 60 * 1000);
        const twelveHoursAgo = new Date(now - 12 * 60 * 60 * 1000).toISOString();

        // Clamp endTime to at least 10 minutes in the past (Webex API requirement)
        let endTime = params.endTime
          ? new Date(params.endTime)
          : tenMinAgo;
        if (endTime.getTime() > tenMinAgo.getTime()) {
          endTime = tenMinAgo;
        }

        const result = (await api.getCallDetailRecords({
          startTime: params.startTime || twelveHoursAgo,
          endTime: endTime.toISOString(),
          locations: params.locationId,
          max: params.max,
        })) as { items?: CdrRecord[] };

        let records = result.items || [];

        // ── Filter by person ──
        if (params.personName) {
          const search = params.personName.toLowerCase();
          records = records.filter(
            (r) => r["User"].toLowerCase().includes(search)
          );
        }
        if (params.personId) {
          // Resolve personId to display name via People API for matching
          try {
            const person = (await api.getPerson(params.personId, false)) as {
              displayName?: string;
            };
            if (person.displayName) {
              const name = person.displayName;
              records = records.filter((r) => r["User"] === name);
            }
          } catch {
            // Fallback: try UUID-based matching
          }
        }

        // ── Deduplicate by Correlation ID (keep ORIGINATING leg preferably) ──
        const byCorrelation = new Map<string, CdrRecord>();
        for (const r of records) {
          const cid = r["Correlation ID"];
          const existing = byCorrelation.get(cid);
          if (!existing || r["Direction"] === "ORIGINATING") {
            byCorrelation.set(cid, r);
          }
        }
        let unique = Array.from(byCorrelation.values());

        // ── Filter by direction ──
        if (params.direction === "placed") {
          unique = unique.filter((r) => r["Direction"] === "ORIGINATING");
        } else if (params.direction === "received") {
          unique = unique.filter(
            (r) => r["Direction"] === "TERMINATING" && r["Answered"] === "true"
          );
        } else if (params.direction === "missed") {
          unique = unique.filter(
            (r) => r["Answered"] === "false" || r["Original reason"] === "Unanswered"
          );
        }

        // ── Sort by start time ──
        unique.sort(
          (a, b) =>
            new Date(a["Start time"]).getTime() - new Date(b["Start time"]).getTime()
        );

        // ── Raw output mode ──
        if (params.rawOutput) {
          return {
            content: [{ type: "text", text: JSON.stringify({ items: unique }, null, 2) }],
          };
        }

        // ── Formatted summary ──
        const totalDuration = unique.reduce((sum, r) => sum + Number(r["Duration"] || 0), 0);
        const answered = unique.filter((r) => r["Answered"] === "true").length;
        const missed = unique.filter(
          (r) => r["Answered"] === "false" || r["Original reason"] === "Unanswered"
        ).length;

        const personLabel =
          params.personName || (unique.length > 0 ? unique[0]["User"] : "Organization");

        const lines: string[] = [];
        lines.push(`## Call History — ${personLabel}`);
        lines.push(
          `**Period:** ${params.startTime || twelveHoursAgo} → ${endTime.toISOString()}`
        );
        lines.push(
          `**Total:** ${unique.length} calls | ${answered} answered | ${missed} missed | Total duration: ${formatDuration(totalDuration)}`
        );
        lines.push("");
        lines.push("| # | Time (UTC) | Direction | Contact | Number | Duration | Status | Device |");
        lines.push("|---|-----------|-----------|---------|--------|----------|--------|--------|");

        for (let i = 0; i < unique.length; i++) {
          const r = unique[i];
          const dir = r["Direction"] === "ORIGINATING" ? "→ Sortant" : "← Entrant";
          const status = r["Answered"] === "true" ? "Décroché" : "Manqué";
          const contact =
            r["Direction"] === "ORIGINATING"
              ? r["Called line ID"]
              : r["Calling line ID"];
          const number =
            r["Direction"] === "ORIGINATING"
              ? r["Called number"]
              : r["Calling number"];
          const dur = formatDuration(Number(r["Duration"] || 0));
          const device = getDeviceLabel(r);
          const time = r["Start time"].substring(11, 16); // HH:MM

          lines.push(
            `| ${i + 1} | ${time} | ${dir} | ${contact || "—"} | ${number} | ${dur} | ${status} | ${device} |`
          );
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

  // ── Missed Calls Report ──
  server.registerTool(
    "get_missed_calls_report",
    {
      description: "Generate a summary report of missed calls for the organization, a specific location, or a specific person. " +
        "Returns total missed calls, breakdown by user, and time distribution. " +
        "Ideal for quick dashboards and partner demos.",
      inputSchema: {
      startTime: z
        .string()
        .optional()
        .describe("Start time in ISO 8601 format (defaults to 12 hours ago)"),
      endTime: z
        .string()
        .optional()
        .describe("End time in ISO 8601 format (defaults to now)"),
      locationId: z.string().optional().describe("Filter by location ID"),
      personName: z
        .string()
        .optional()
        .describe("Filter by person display name (case-insensitive partial match)"),
      max: z.number().optional().default(500).describe("Maximum CDR records to analyze"),
      },
    },
    async (params) => {
      try {
        const now = Date.now();
        const tenMinAgo = new Date(now - 10 * 60 * 1000);
        const twelveHoursAgo = new Date(now - 12 * 60 * 60 * 1000);
        const startTime = params.startTime || twelveHoursAgo.toISOString();

        // Clamp endTime to at least 10 minutes in the past (Webex API requirement)
        let endTimeDate = params.endTime
          ? new Date(params.endTime)
          : tenMinAgo;
        if (endTimeDate.getTime() > tenMinAgo.getTime()) {
          endTimeDate = tenMinAgo;
        }
        const endTime = endTimeDate.toISOString();

        const result = (await api.getCallDetailRecords({
          startTime,
          endTime,
          locations: params.locationId,
          max: params.max,
        })) as { items?: CdrRecord[] };

        let records = result.items || [];

        // Filter by person name
        if (params.personName) {
          const search = params.personName.toLowerCase();
          records = records.filter(
            (r) => r["User"].toLowerCase().includes(search)
          );
        }

        // Deduplicate by Correlation ID
        const byCorrelation = new Map<string, CdrRecord>();
        for (const r of records) {
          const cid = r["Correlation ID"];
          const existing = byCorrelation.get(cid);
          if (!existing || r["Direction"] === "TERMINATING") {
            byCorrelation.set(cid, r);
          }
        }
        const unique = Array.from(byCorrelation.values());

        const missedCalls = unique.filter(
          (r) => r["Answered"] === "false" || r["Original reason"] === "Unanswered"
        );

        // Group by called user
        const byUser: Record<string, number> = {};
        for (const call of missedCalls) {
          const user = call["User"] || "Unknown";
          byUser[user] = (byUser[user] || 0) + 1;
        }

        const topMissed = Object.entries(byUser)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 20)
          .map(([user, count]) => ({ user, missedCalls: count }));

        // Group by hour
        const byHour: Record<string, number> = {};
        for (const call of missedCalls) {
          const st = call["Start time"];
          if (st) {
            const hour = st.substring(0, 13); // YYYY-MM-DDTHH
            byHour[hour] = (byHour[hour] || 0) + 1;
          }
        }

        // Build formatted report
        const lines: string[] = [];
        const label = params.personName || "Organization";
        lines.push(`## Missed Calls Report — ${label}`);
        lines.push(`**Period:** ${startTime} → ${endTime}`);
        lines.push(
          `**Total calls analyzed:** ${unique.length} (deduplicated) | **Missed:** ${missedCalls.length} | **Rate:** ${unique.length > 0 ? ((missedCalls.length / unique.length) * 100).toFixed(1) : "0"}%`
        );
        lines.push("");

        if (topMissed.length > 0) {
          lines.push("### By User");
          lines.push("| User | Missed Calls |");
          lines.push("|------|-------------|");
          for (const { user, missedCalls: count } of topMissed) {
            lines.push(`| ${user} | ${count} |`);
          }
          lines.push("");
        }

        if (Object.keys(byHour).length > 0) {
          lines.push("### By Hour");
          lines.push("| Hour (UTC) | Missed Calls |");
          lines.push("|-----------|-------------|");
          for (const [hour, count] of Object.entries(byHour).sort()) {
            lines.push(`| ${hour}:00 | ${count} |`);
          }
        }

        if (missedCalls.length === 0) {
          lines.push("*No missed calls during this period.*");
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
