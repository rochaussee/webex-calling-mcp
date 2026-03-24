/**
 * MCP Tools — People & Users
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebexApiClient } from "../webex-api.js";

export function registerPeopleTools(server: McpServer, api: WebexApiClient) {
  // ── List People ──
  server.tool(
    "list_people",
    "List people/users in the Webex organization. Can filter by email, name, or location. " +
      "Always use callingData=true to include phone numbers and calling info. " +
      "When filtering by location name (e.g. 'Paris'), first use list_locations to resolve the locationId. " +
      "IMPORTANT: After getting results, always call list_locations to resolve each locationId into the location name. " +
      "Present results as a formatted table with columns: Display Name, Email, Phone Number(s), Extension, Location (name, not ID). " +
      "Display phone numbers exactly as returned by the API without adding spaces (e.g. +33189311254, not +33 1 89 31 12 54). " +
      "If no users match, suggest alternative search criteria.",
    {
      email: z.string().optional().describe("Filter by exact email address"),
      displayName: z
        .string()
        .optional()
        .describe("Filter by display name (partial match)"),
      locationId: z.string().optional().describe("Filter by location ID"),
      callingData: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include calling data (phone numbers, extension, etc.)"),
      max: z
        .number()
        .optional()
        .default(100)
        .describe("Maximum number of results (default: 100)"),
    },
    async (params) => {
      try {
        const result = await api.listPeople({
          email: params.email,
          displayName: params.displayName,
          locationId: params.locationId,
          callingData: params.callingData,
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

  // ── Get Person Details ──
  server.tool(
    "get_person",
    "Get detailed information about a specific person/user, including their calling settings, devices, and phone numbers.",
    {
      personId: z.string().describe("The unique ID of the person"),
      callingData: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include calling data"),
    },
    async (params) => {
      try {
        const result = await api.getPerson(params.personId, params.callingData);
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

  // ── Find Users Without Phones ──
  server.tool(
    "find_users_without_phones",
    "Find all users in the organization who do not have a phone number assigned. " +
      "Great for auditing and compliance checks.",
    {
      locationId: z
        .string()
        .optional()
        .describe("Optional: limit search to a specific location"),
      max: z
        .number()
        .optional()
        .default(200)
        .describe("Maximum number of users to check"),
    },
    async (params) => {
      try {
        const result = (await api.listPeople({
          callingData: true,
          locationId: params.locationId,
          max: params.max,
        })) as { items?: Array<{ displayName: string; emails: string[]; phoneNumbers?: Array<{ type: string; value: string }> }> };

        const usersWithoutPhones = (result.items || []).filter(
          (person) =>
            !person.phoneNumbers || person.phoneNumbers.length === 0
        );

        const summary = {
          totalUsersChecked: (result.items || []).length,
          usersWithoutPhones: usersWithoutPhones.length,
          users: usersWithoutPhones.map((p) => ({
            displayName: p.displayName,
            email: p.emails?.[0],
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
