/**
 * MCP Tools — Organization Contacts
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebexApiClient, extractUuid } from "../webex-api.js";

export function registerContactTools(server: McpServer, api: WebexApiClient) {
  // ── List Organization Contacts ──
  server.tool(
    "list_org_contacts",
    "List organization contacts in the Webex directory. Can search by keyword (name, email). " +
      "These are external contacts visible to all users in the Webex org directory.",
    {
      keyword: z
        .string()
        .optional()
        .describe(
          "Search keyword — matches displayName, firstName, lastName, or email. Leave empty to list all contacts."
        ),
      source: z
        .enum(["CH", "Webex4Broadworks"])
        .optional()
        .describe("Filter by contact source (default: all)"),
      limit: z
        .number()
        .optional()
        .default(100)
        .describe("Maximum number of results (default: 100)"),
    },
    async (params) => {
      try {
        const result = await api.listOrgContacts({
          keyword: params.keyword,
          source: params.source,
          limit: params.limit,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error: ${(error as Error).message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ── Get Organization Contact Details ──
  server.tool(
    "get_org_contact",
    "Get detailed information about a specific organization contact by its contact ID.",
    {
      contactId: z.string().describe("The unique ID of the contact"),
    },
    async (params) => {
      try {
        const result = await api.getOrgContact(params.contactId);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error: ${(error as Error).message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ── Create Organization Contact ──
  server.tool(
    "create_org_contact",
    "Create a new organization contact in the Webex directory. " +
      "At least one of phoneNumbers, emails, or sipAddresses is required. " +
      "This contact will be visible to all users in the org.",
    {
      firstName: z.string().optional().describe("First name of the contact"),
      lastName: z.string().optional().describe("Last name of the contact"),
      displayName: z
        .string()
        .optional()
        .describe("Full display name of the contact"),
      companyName: z
        .string()
        .optional()
        .describe("Company the contact works for"),
      title: z.string().optional().describe("Job title of the contact"),
      address: z.string().optional().describe("Address of the contact"),
      primaryContactMethod: z
        .enum(["SIPADDRESS", "EMAIL", "PHONE", "IMS"])
        .optional()
        .describe("Primary contact method"),
      emails: z
        .array(
          z.object({
            value: z.string().describe("Email address"),
            type: z
              .string()
              .optional()
              .describe("Email type (e.g. 'work', 'home')"),
            primary: z
              .boolean()
              .optional()
              .describe("Whether this is the primary email"),
          })
        )
        .optional()
        .describe("Email addresses"),
      phoneNumbers: z
        .array(
          z.object({
            value: z.string().describe("Phone number"),
            type: z
              .string()
              .optional()
              .describe("Phone type (e.g. 'work', 'mobile', 'home')"),
            primary: z
              .boolean()
              .optional()
              .describe("Whether this is the primary phone number"),
          })
        )
        .optional()
        .describe("Phone numbers"),
      sipAddresses: z
        .array(
          z.object({
            value: z.string().describe("SIP address"),
            type: z
              .string()
              .optional()
              .describe("SIP address type"),
            primary: z
              .boolean()
              .optional()
              .describe("Whether this is the primary SIP address"),
          })
        )
        .optional()
        .describe("SIP addresses"),
      groupIds: z
        .array(z.string())
        .optional()
        .describe(
          "Array of group IDs to associate with this contact. Use list_groups to find available group IDs. " +
            "Contacts with group IDs are only visible to users in those groups."
        ),
    },
    async (params) => {
      try {
        const result = await api.createOrgContact({
          firstName: params.firstName,
          lastName: params.lastName,
          displayName: params.displayName,
          companyName: params.companyName,
          title: params.title,
          address: params.address,
          primaryContactMethod: params.primaryContactMethod,
          emails: params.emails,
          phoneNumbers: params.phoneNumbers,
          sipAddresses: params.sipAddresses,
          groupIds: params.groupIds,
        });
        return {
          content: [
            {
              type: "text",
              text: `Contact created successfully.\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error: ${(error as Error).message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ── Update Organization Contact ──
  server.tool(
    "update_org_contact",
    "Update an existing organization contact. Only the fields provided will be updated. " +
      "Use list_org_contacts first to find the contactId.",
    {
      contactId: z.string().describe("The unique ID of the contact to update"),
      firstName: z.string().optional().describe("Updated first name"),
      lastName: z.string().optional().describe("Updated last name"),
      displayName: z.string().optional().describe("Updated display name"),
      companyName: z.string().optional().describe("Updated company name"),
      title: z.string().optional().describe("Updated job title"),
      address: z.string().optional().describe("Updated address"),
      primaryContactMethod: z
        .enum(["SIPADDRESS", "EMAIL", "PHONE", "IMS"])
        .optional()
        .describe("Updated primary contact method"),
      emails: z
        .array(
          z.object({
            value: z.string().describe("Email address"),
            type: z.string().optional().describe("Email type"),
            primary: z.boolean().optional().describe("Primary email"),
          })
        )
        .optional()
        .describe("Updated email addresses (replaces all existing emails)"),
      phoneNumbers: z
        .array(
          z.object({
            value: z.string().describe("Phone number"),
            type: z.string().optional().describe("Phone type"),
            primary: z.boolean().optional().describe("Primary phone"),
          })
        )
        .optional()
        .describe(
          "Updated phone numbers (replaces all existing phone numbers)"
        ),
      sipAddresses: z
        .array(
          z.object({
            value: z.string().describe("SIP address"),
            type: z.string().optional().describe("SIP type"),
            primary: z.boolean().optional().describe("Primary SIP"),
          })
        )
        .optional()
        .describe("Updated SIP addresses"),
      groupIds: z
        .array(z.string())
        .optional()
        .describe(
          "Updated group IDs. Pass an empty array to remove all group associations."
        ),
    },
    async (params) => {
      try {
        const { contactId, ...updateFields } = params;
        const result = await api.updateOrgContact(contactId, updateFields);
        return {
          content: [
            {
              type: "text",
              text: `Contact updated successfully.\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error: ${(error as Error).message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ── Delete Organization Contact ──
  server.tool(
    "delete_org_contact",
    "Delete an organization contact from the Webex directory. This is irreversible. " +
      "Use list_org_contacts first to find the contactId.",
    {
      contactId: z.string().describe("The unique ID of the contact to delete"),
    },
    async (params) => {
      try {
        await api.deleteOrgContact(params.contactId);
        return {
          content: [
            {
              type: "text",
              text: `Contact ${params.contactId} deleted successfully.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error: ${(error as Error).message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ── List Groups ──
  server.tool(
    "list_groups",
    "List groups in the Webex organization. Groups are used to scope org contacts visibility — " +
      "a contact assigned to a group is only visible to members of that group. " +
      "Use the returned group IDs when creating or updating org contacts with groupIds.",
    {
      filter: z
        .string()
        .optional()
        .describe(
          'Filter by displayName. Use format: displayName eq "Marketing" or displayName sw "Sales"'
        ),
      includeMembers: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include group members in the response (max 500 members)"),
      count: z
        .number()
        .optional()
        .default(100)
        .describe("Number of results per page (default: 100)"),
    },
    async (params) => {
      try {
        // Fetch groups and locations in parallel
        const [groupsResult, locationsResult] = await Promise.all([
          api.listGroups({
            filter: params.filter,
            includeMembers: params.includeMembers,
            count: params.count,
          }) as Promise<{ groups?: Array<{ id: string; displayName: string; [key: string]: unknown }>; [key: string]: unknown }>,
          api.listLocations({ max: 500 }) as Promise<{ items?: Array<{ id: string; [key: string]: unknown }> }>,
        ]);

        // Extract location UUIDs
        const locationUuids = new Set(
          (locationsResult.items || []).map((loc) => extractUuid(loc.id))
        );

        // Filter out groups whose UUID matches a location UUID
        const allGroups = groupsResult.groups || [];
        const functionalGroups = allGroups.filter((group) => {
          const groupUuid = extractUuid(group.id).split(":")[0];
          return !locationUuids.has(groupUuid);
        });

        const filtered = {
          ...groupsResult,
          totalResults: functionalGroups.length,
          itemsPerPage: functionalGroups.length,
          groups: functionalGroups,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error: ${(error as Error).message}` },
          ],
          isError: true,
        };
      }
    }
  );
}
