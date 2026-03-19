/**
 * MCP Tools — Devices & Workspaces
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebexApiClient } from "../webex-api.js";

export function registerDeviceTools(server: McpServer, api: WebexApiClient) {
  // ── List Devices ──
  server.tool(
    "list_devices",
    "List devices in the organization. Filter by person, workspace, or name. " +
      "Useful for auditing device assignments.",
    {
      personId: z.string().optional().describe("Filter by person ID"),
      workspaceId: z.string().optional().describe("Filter by workspace ID"),
      displayName: z.string().optional().describe("Filter by device name"),
      max: z.number().optional().default(100).describe("Maximum results"),
    },
    async (params) => {
      try {
        const result = await api.listDevices({
          personId: params.personId,
          workspaceId: params.workspaceId,
          displayName: params.displayName,
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

  // ── Get Device ──
  server.tool(
    "get_device",
    "Get detailed information about a specific device.",
    {
      deviceId: z.string().describe("The unique ID of the device"),
    },
    async (params) => {
      try {
        const result = await api.getDevice(params.deviceId);
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

  // ── List Workspaces ──
  server.tool(
    "list_workspaces",
    "List workspaces (conference rooms, shared spaces) in the organization.",
    {
      displayName: z.string().optional().describe("Filter by name"),
      locationId: z.string().optional().describe("Filter by location"),
      max: z.number().optional().default(100).describe("Maximum results"),
    },
    async (params) => {
      try {
        const result = await api.listWorkspaces({
          displayName: params.displayName,
          locationId: params.locationId,
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

  // ── Caller ID ──
  server.tool(
    "get_caller_id",
    "Get the caller ID settings for a specific user.",
    {
      personId: z.string().describe("The unique ID of the person"),
    },
    async (params) => {
      try {
        const result = await api.getPersonCallerId(params.personId);
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

  // ── Update Caller ID ──
  server.tool(
    "update_caller_id",
    "Update the caller ID settings for a person (name, number to display on outbound calls).",
    {
      personId: z.string().describe("The unique ID of the person"),
      selected: z
        .enum(["DIRECT_LINE", "LOCATION_NUMBER", "CUSTOM"])
        .describe("Which number to use as caller ID"),
      customNumber: z
        .string()
        .optional()
        .describe("Custom phone number (required if selected=CUSTOM)"),
      firstName: z.string().optional().describe("First name to display"),
      lastName: z.string().optional().describe("Last name to display"),
    },
    async (params) => {
      try {
        const settings: Record<string, unknown> = { selected: params.selected };
        if (params.customNumber) settings.customNumber = params.customNumber;
        if (params.firstName) settings.firstName = params.firstName;
        if (params.lastName) settings.lastName = params.lastName;

        const result = await api.updatePersonCallerId(params.personId, settings);
        return {
          content: [
            {
              type: "text",
              text: `Caller ID updated successfully.\n${JSON.stringify(result, null, 2)}`,
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
}
