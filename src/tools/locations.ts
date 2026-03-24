/**
 * MCP Tools — Locations, Schedules, and Organization-level operations
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebexApiClient } from "../webex-api.js";

export function registerLocationTools(server: McpServer, api: WebexApiClient) {
  // ── List Locations ──
  server.registerTool(
    "list_locations",
    {
      description: "List all locations (offices/sites) in the Webex organization. " +
        "Returns location IDs needed for most other operations.",
      inputSchema: {
      name: z.string().optional().describe("Filter by location name"),
      max: z.number().optional().default(100).describe("Maximum results"),
      },
    },
    async (params) => {
      try {
        const result = await api.listLocations({
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

  // ── Get Location Details ──
  server.registerTool(
    "get_location",
    {
      description: "Get detailed info about a specific location, including address and time zone.",
      inputSchema: {
        locationId: z.string().describe("The unique ID of the location"),
      },
    },
    async (params) => {
      try {
        const result = await api.getLocation(params.locationId);
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

  // ── List Schedules ──
  server.registerTool(
    "list_schedules",
    {
      description: "List schedules (business hours or holidays) for a location.",
      inputSchema: {
      locationId: z.string().describe("The location ID"),
      type: z
        .enum(["businessHours", "holidays"])
        .optional()
        .describe("Filter by schedule type"),
      name: z.string().optional().describe("Filter by schedule name"),
      },
    },
    async (params) => {
      try {
        const result = await api.listSchedules(params.locationId, {
          type: params.type,
          name: params.name,
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

  // ── Create Holiday Schedule ──
  server.registerTool(
    "create_holiday_schedule",
    {
      description: "Create a holiday schedule for a location. This can be used to route calls " +
        "differently during holidays (e.g., send to voicemail). " +
        'Example: "Set up a holiday schedule for Paris — close Dec 24 to Jan 2."',
      inputSchema: {
      locationId: z.string().describe("The location ID"),
      name: z.string().describe("Name for the schedule (e.g., 'Christmas Break 2025')"),
      events: z
        .array(
          z.object({
            name: z.string().describe("Event name (e.g., 'Christmas Day')"),
            startDate: z.string().describe("Start date in YYYY-MM-DD format"),
            endDate: z.string().describe("End date in YYYY-MM-DD format"),
            allDayEnabled: z
              .boolean()
              .optional()
              .default(true)
              .describe("All day event"),
          })
        )
        .describe("Array of holiday events"),
      },
    },
    async (params) => {
      try {
        const result = await api.createSchedule(params.locationId, {
          name: params.name,
          type: "holidays",
          events: params.events,
        });
        return {
          content: [
            {
              type: "text",
              text: `Holiday schedule "${params.name}" created with ${params.events.length} event(s).\n${JSON.stringify(result, null, 2)}`,
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

  // ── List Auto Attendants ──
  server.registerTool(
    "list_auto_attendants",
    {
      description: "List all auto attendants (IVR menus) in the organization.",
      inputSchema: {
      locationId: z.string().optional().describe("Filter by location ID"),
      name: z.string().optional().describe("Filter by name"),
      max: z.number().optional().default(100).describe("Maximum results"),
      },
    },
    async (params) => {
      try {
        const result = await api.listAutoAttendants({
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

  // ── Get Auto Attendant ──
  server.registerTool(
    "get_auto_attendant",
    {
      description: "Get the detailed configuration of an auto attendant (IVR), including menus and key actions.",
      inputSchema: {
        locationId: z.string().describe("The location ID of the auto attendant"),
        autoAttendantId: z.string().describe("The unique ID of the auto attendant"),
      },
    },
    async (params) => {
      try {
        const result = await api.getAutoAttendant(params.locationId, params.autoAttendantId);
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
}
