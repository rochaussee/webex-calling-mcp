/**
 * MCP Tools — Call Analytics & Call Detail Records (CDR)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebexApiClient } from "../webex-api.js";

/** Shape of a single CDR record from the Webex Detailed Call History API */
interface CdrRecord {
  // ── Core call info ──
  "Call ID": string;
  "Correlation ID": string;
  "Direction": string;          // ORIGINATING | TERMINATING
  "Answered": string;           // "true" | "false"
  "Answer indicator": string;   // "Yes" | "No" | ""
  "Call type": string;          // SIP_ENTERPRISE | SIP_MOBILE | SIP_NATIONAL | ...
  "Call outcome": string;       // Success | Failure | Refusal | ...
  "Call outcome reason": string;// Normal | Busy | NoAnswer | ...

  // ── Participants ──
  "User": string;
  "User UUID": string;
  "User type": string;          // User | Place | AutomatedAttendantVideo | ...
  "User number": string;
  "Called line ID": string;
  "Calling line ID": string;
  "Called number": string;
  "Calling number": string;
  "Dialed digits": string;
  "Caller ID number": string;
  "External caller ID number": string;

  // ── Timing ──
  "Start time": string;         // ISO 8601
  "Answer time": string;        // ISO 8601
  "Release time": string;       // ISO 8601
  "Report time": string;        // ISO 8601
  "Duration": number;           // seconds
  "Ring duration": string;      // seconds (string)
  "Hold duration": number;      // seconds

  // ── Device & client ──
  "Client type": string;        // WXC_DEVICE | TEAMS_WXC_CLIENT | SIP | ...
  "Client version": string;
  "Sub client type": string;    // MOBILE_APP | DESKTOP_APP | ...
  "Model": string;              // 9871 | 8845 | na | ...
  "Device MAC": string;
  "OS type": string;

  // ── Location & routing ──
  "Location": string;
  "Site main number": string;
  "Site UUID": string;
  "Site timezone": string;
  "Route group": string;
  "Inbound trunk": string;
  "Outbound trunk": string;

  // ── Transfer & redirect ──
  "Original reason": string;
  "Redirect reason": string;
  "Related reason": string;
  "Releasing party": string;    // Local | Remote
  "Redirecting number": string;
  "Transfer related call ID": string;
  "Related call ID": string;
  "Call transfer time": string;

  // ── Misc ──
  "Department ID": string;
  "International country": string;
  "Authorization code": string;
  "Report ID": string;
  "Org UUID": string;
  "Network call ID": string;
  "Local call ID": string;
  "Remote call ID": string;
  "Local SessionID": string;
  "Remote SessionID": string;
  "Final local SessionID": string;
  "Final remote SessionID": string;
  "PSTN vendor name": string;
  "Queue type": string;
  "Answered elsewhere": string;
  "Interaction ID": string;

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
  if (model && model !== "na" && model !== "") {
    // Cisco phone models: 9871, 8845, etc.
    return /^\d+$/.test(model) ? `Cisco ${model}` : model;
  }
  const sub = record["Sub client type"];
  if (sub === "MOBILE_APP") return "App Mobile";
  if (sub === "DESKTOP_APP") return "App Desktop";
  const client = record["Client type"];
  if (client === "TEAMS_WXC_CLIENT") return "Webex App";
  if (client === "WXC_DEVICE") return "Cisco Phone";
  if (client === "SIP") return "SIP";
  return client || "Unknown";
}

/** Get the best contact label: line ID if meaningful, else number */
function getContact(record: CdrRecord): { name: string; number: string } {
  const isOutgoing = record["Direction"] === "ORIGINATING";
  const lineId = isOutgoing ? record["Called line ID"] : record["Calling line ID"];
  const number = isOutgoing ? record["Called number"] : record["Calling number"];
  const name = (lineId && lineId !== "NA" && lineId !== "") ? lineId : "";
  return { name, number: number || "" };
}

/** Get a human-readable call status */
function getCallStatus(record: CdrRecord): string {
  if (record["Answered"] === "true" || record["Answer indicator"] === "Yes") {
    return "✅ Décroché";
  }
  const outcome = record["Call outcome reason"];
  if (outcome === "Busy") return "🔴 Occupé";
  if (outcome === "NoAnswer" || record["Original reason"] === "Unanswered") return "📵 Manqué";
  if (outcome === "Refusal") return "🚫 Refusé";
  if (record["Answered"] === "false") return "📵 Manqué";
  return record["Call outcome"] || "Unknown";
}

/** Max time span per CDR API request: 12 hours */
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
/** CDR data retention: 30 days */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
/** Minimum delay before data is available: 5 minutes */
const FIVE_MIN_MS = 5 * 60 * 1000;

/**
 * Fetch CDR records across a period that may exceed 12 hours.
 * Splits into consecutive 12-hour chunks automatically.
 */
async function fetchCdrChunked(
  api: WebexApiClient,
  startTime: Date,
  endTime: Date,
  locations?: string,
  max?: number
): Promise<CdrRecord[]> {
  let allRecords: CdrRecord[] = [];
  let chunkStart = startTime.getTime();
  const end = endTime.getTime();
  let isFirstChunk = true;

  while (chunkStart < end) {
    const chunkEnd = Math.min(chunkStart + TWELVE_HOURS_MS, end);

    // Rate limit: 1 initial request/min — wait 61s between chunks
    if (!isFirstChunk) {
      await new Promise((resolve) => setTimeout(resolve, 61_000));
    }
    isFirstChunk = false;

    const result = (await api.getCallDetailRecords({
      startTime: new Date(chunkStart).toISOString(),
      endTime: new Date(chunkEnd).toISOString(),
      locations,
      max,
    })) as { items?: CdrRecord[] };

    if (result.items) {
      allRecords = allRecords.concat(result.items);
    }

    chunkStart = chunkEnd;
  }

  return allRecords;
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
            "Can go back up to 30 days. Defaults to 12 hours ago. " +
            "Periods > 12h require multiple API calls (~1 min each)."
        ),
      endTime: z
        .string()
        .optional()
        .describe(
          "End time in ISO 8601 format. Must be after startTime, at least 5 min ago. " +
            "Defaults to 5 minutes ago."
        ),
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
      locations: z
        .string()
        .optional()
        .describe(
          "Filter by location name (as shown in Control Hub). " +
            "Up to 10 comma-separated location names."
        ),
      max: z
        .number()
        .optional()
        .default(5000)
        .describe("Maximum CDR records per page (range 500-5000, default 5000)"),
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
        const fiveMinAgo = new Date(now - FIVE_MIN_MS);
        const thirtyDaysAgo = new Date(now - THIRTY_DAYS_MS);
        const twelveHoursAgo = new Date(now - TWELVE_HOURS_MS);

        // Default startTime: 12 hours ago (fits in 1 API call)
        let startTime = params.startTime
          ? new Date(params.startTime)
          : twelveHoursAgo;
        // Clamp: cannot be older than 30 days
        if (startTime.getTime() < thirtyDaysAgo.getTime()) {
          startTime = thirtyDaysAgo;
        }

        // Default endTime: 5 minutes ago (API minimum delay)
        let endTime = params.endTime
          ? new Date(params.endTime)
          : fiveMinAgo;
        // Clamp: cannot be more recent than 5 min ago
        if (endTime.getTime() > fiveMinAgo.getTime()) {
          endTime = fiveMinAgo;
        }

        // Fetch CDR records (auto-chunks periods > 12h)
        let records = await fetchCdrChunked(
          api, startTime, endTime, params.locations, params.max
        );

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
          `**Period:** ${startTime.toISOString()} → ${endTime.toISOString()}`
        );
        lines.push(
          `**Total:** ${unique.length} calls | ${answered} answered | ${missed} missed | Total duration: ${formatDuration(totalDuration)}`
        );
        lines.push("");
        lines.push("| # | Time (UTC) | User | Direction | Contact | Number | Duration | Status | Device | Location |");
        lines.push("|---|-----------|------|-----------|---------|--------|----------|--------|--------|----------|");

        for (let i = 0; i < unique.length; i++) {
          const r = unique[i];
          const dir = r["Direction"] === "ORIGINATING" ? "→ Sortant" : "← Entrant";
          const status = getCallStatus(r);
          const { name: contact, number } = getContact(r);
          const dur = formatDuration(Number(r["Duration"] || 0));
          const device = getDeviceLabel(r);
          const time = r["Start time"].substring(11, 16); // HH:MM
          const user = r["User"] || "—";
          const location = r["Location"] || "—";

          lines.push(
            `| ${i + 1} | ${time} | ${user} | ${dir} | ${contact || "—"} | ${number} | ${dur} | ${status} | ${device} | ${location} |`
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
        .describe(
          "Start time in ISO 8601 format. Can go back up to 30 days. Defaults to 12 hours ago. " +
            "Periods > 12h require multiple API calls (~1 min each)."
        ),
      endTime: z
        .string()
        .optional()
        .describe(
          "End time in ISO 8601 format. Must be after startTime, at least 5 min ago. " +
            "Defaults to 5 minutes ago."
        ),
      locations: z
        .string()
        .optional()
        .describe(
          "Filter by location name (as shown in Control Hub). " +
            "Up to 10 comma-separated location names."
        ),
      personName: z
        .string()
        .optional()
        .describe("Filter by person display name (case-insensitive partial match)"),
      max: z
        .number()
        .optional()
        .default(5000)
        .describe("Maximum CDR records per page (range 500-5000, default 5000)"),
      },
    },
    async (params) => {
      try {
        const now = Date.now();
        const fiveMinAgo = new Date(now - FIVE_MIN_MS);
        const thirtyDaysAgo = new Date(now - THIRTY_DAYS_MS);
        const twelveHoursAgo = new Date(now - TWELVE_HOURS_MS);

        let startTime = params.startTime
          ? new Date(params.startTime)
          : twelveHoursAgo;
        if (startTime.getTime() < thirtyDaysAgo.getTime()) {
          startTime = thirtyDaysAgo;
        }

        let endTimeDate = params.endTime
          ? new Date(params.endTime)
          : fiveMinAgo;
        if (endTimeDate.getTime() > fiveMinAgo.getTime()) {
          endTimeDate = fiveMinAgo;
        }
        const endTime = endTimeDate.toISOString();

        // Fetch CDR records (auto-chunks periods > 12h)
        let records = await fetchCdrChunked(
          api, startTime, new Date(endTime), params.locations, params.max
        );

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
        lines.push(`**Period:** ${startTime.toISOString()} → ${endTime}`);
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
