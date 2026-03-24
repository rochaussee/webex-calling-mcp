/**
 * MCP Prompts — People & Users
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPeoplePrompts(server: McpServer) {
  server.prompt(
    "list-people",
    "Search and list users in the Webex organization. Helps find users by name, email, or location and display their calling information.",
    {
      name: z
        .string()
        .optional()
        .describe("User display name to search for (partial match)"),
      email: z
        .string()
        .optional()
        .describe("Exact email address to look up"),
      locationId: z
        .string()
        .optional()
        .describe("Location ID to filter users by site/office"),
    },
    (args) => {
      const filters: string[] = [];
      if (args.name) filters.push(`- Name contains: "${args.name}"`);
      if (args.email) filters.push(`- Email: ${args.email}`);
      if (args.locationId) filters.push(`- Location ID: ${args.locationId}`);

      const filterSection =
        filters.length > 0
          ? `Apply these filters:\n${filters.join("\n")}`
          : "No filters specified — list all users (up to 100).";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                "Use the `list_people` tool to search for users in the Webex organization.",
                "",
                filterSection,
                "",
                "Always include calling data (callingData=true) so we can see phone numbers and extensions.",
                "",
                "Present the results as a clear, formatted table with these columns:",
                "- Display Name",
                "- Email",
                "- Phone Number(s)",
                "- Extension",
                "- Location",
                "",
                "If no users are found, suggest alternative search criteria.",
              ].join("\n"),
            },
          },
        ],
      };
    }
  );
}
