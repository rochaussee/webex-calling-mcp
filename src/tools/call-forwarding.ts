/**
 * MCP Tools — Call Forwarding, Voicemail & Call Intercept
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebexApiClient } from "../webex-api.js";

export function registerCallForwardingTools(server: McpServer, api: WebexApiClient) {
  // ── Get Call Forwarding ──
  server.registerTool(
    "get_call_forwarding",
    {
      description: "Get the call forwarding settings for a specific user.",
      inputSchema: {
        personId: z.string().describe("The unique ID of the person"),
      },
    },
    async (params) => {
      try {
        const result = await api.getPersonCallForwarding(params.personId);
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

  // ── Update Call Forwarding ──
  server.registerTool(
    "update_call_forwarding",
    {
      description: "Update call forwarding settings for a user. Can enable/disable forwarding, " +
        "set always-forward, busy-forward, no-answer-forward, and selective forwarding rules.",
      inputSchema: {
      personId: z.string().describe("The unique ID of the person"),
      callForwarding: z
        .object({
          always: z
            .object({
              enabled: z.boolean(),
              destination: z.string().optional(),
              ringReminderEnabled: z.boolean().optional(),
              destinationVoicemailEnabled: z.boolean().optional(),
            })
            .optional()
            .describe("Always forward all calls"),
          busy: z
            .object({
              enabled: z.boolean(),
              destination: z.string().optional(),
              destinationVoicemailEnabled: z.boolean().optional(),
            })
            .optional()
            .describe("Forward when busy"),
          noAnswer: z
            .object({
              enabled: z.boolean(),
              destination: z.string().optional(),
              numberOfRings: z.number().optional(),
              systemMaxNumberOfRings: z.number().optional(),
              destinationVoicemailEnabled: z.boolean().optional(),
            })
            .optional()
            .describe("Forward when no answer"),
        })
        .describe("Call forwarding configuration"),
      },
    },
    async (params) => {
      try {
        const result = await api.updatePersonCallForwarding(params.personId, {
          callForwarding: params.callForwarding,
        });
        return {
          content: [
            {
              type: "text",
              text: `Call forwarding updated successfully.\n${JSON.stringify(result, null, 2)}`,
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

  // ── Get Voicemail Settings ──
  server.registerTool(
    "get_voicemail",
    {
      description: "Get voicemail settings for a specific user.",
      inputSchema: {
        personId: z.string().describe("The unique ID of the person"),
      },
    },
    async (params) => {
      try {
        const result = await api.getPersonVoicemail(params.personId);
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

  // ── Update Voicemail Settings ──
  server.registerTool(
    "update_voicemail",
    {
      description: "Update voicemail settings for a user. Enable/disable voicemail, configure notifications, greetings, etc.",
      inputSchema: {
      personId: z.string().describe("The unique ID of the person"),
      enabled: z.boolean().optional().describe("Enable or disable voicemail"),
      sendAllCalls: z
        .object({
          enabled: z.boolean(),
        })
        .optional()
        .describe("Send all calls to voicemail"),
      sendBusyCalls: z
        .object({
          enabled: z.boolean(),
        })
        .optional()
        .describe("Send calls to voicemail when busy"),
      sendUnansweredCalls: z
        .object({
          enabled: z.boolean(),
          numberOfRings: z.number().optional(),
        })
        .optional()
        .describe("Send unanswered calls to voicemail"),
      notifications: z
        .object({
          enabled: z.boolean(),
          destination: z.string().optional(),
        })
        .optional()
        .describe("Email notification settings for new voicemails"),
      },
    },
    async (params) => {
      try {
        const { personId, ...settings } = params;
        const result = await api.updatePersonVoicemail(personId, settings);
        return {
          content: [
            {
              type: "text",
              text: `Voicemail settings updated successfully.\n${JSON.stringify(result, null, 2)}`,
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

  // ── Redirect Calls to Voicemail (Call Intercept) ──
  server.registerTool(
    "redirect_calls_to_voicemail",
    {
      description: "Redirect all incoming calls for a user to voicemail using call intercept. " +
        "Perfect for out-of-office, holidays, or temporary redirections. " +
        'Example: "Redirect all calls from the Paris office to voicemail until Monday."',
      inputSchema: {
      personId: z.string().describe("The unique ID of the person"),
      enabled: z.boolean().describe("Enable (true) or disable (false) the call intercept / redirection"),
      incomingType: z
        .enum(["INTERCEPT_ALL", "ALLOW_ALL"])
        .optional()
        .default("INTERCEPT_ALL")
        .describe("INTERCEPT_ALL to redirect all calls, ALLOW_ALL to let calls through"),
      voicemailEnabled: z
        .boolean()
        .optional()
        .default(true)
        .describe("Send intercepted calls to voicemail"),
      },
    },
    async (params) => {
      try {
        const settings = {
          enabled: params.enabled,
          incoming: {
            type: params.incomingType,
            voicemailEnabled: params.voicemailEnabled,
          },
        };
        const result = await api.updatePersonCallIntercept(params.personId, settings);
        const action = params.enabled ? "enabled" : "disabled";
        return {
          content: [
            {
              type: "text",
              text: `Call intercept ${action} successfully. All incoming calls are now ${params.enabled ? "redirected to voicemail" : "ringing normally"}.\n${JSON.stringify(result, null, 2)}`,
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

  // ── Bulk Update Call Forwarding (all Webex Calling users) ──
  server.registerTool(
    "bulk_update_call_forwarding",
    {
      description:
        "Apply call forwarding settings to ALL Webex Calling users at once, or only to users at a specific location. " +
        "Webex Calling users are identified by having a locationId. " +
        "Use the optional locationId parameter to target a specific site (e.g. HQ FR). " +
        "Returns a summary of successes and failures per user.",
      inputSchema: {
        locationId: z
          .string()
          .optional()
          .describe("Optional: only apply to users at this location ID. Use list_locations to find the ID."),
        callForwarding: z
          .object({
            always: z
              .object({
                enabled: z.boolean(),
                destination: z.string().optional(),
                ringReminderEnabled: z.boolean().optional(),
                destinationVoicemailEnabled: z.boolean().optional(),
              })
              .optional()
              .describe("Always forward all calls"),
            busy: z
              .object({
                enabled: z.boolean(),
                destination: z.string().optional(),
                destinationVoicemailEnabled: z.boolean().optional(),
              })
              .optional()
              .describe("Forward when busy"),
            noAnswer: z
              .object({
                enabled: z.boolean(),
                destination: z.string().optional(),
                numberOfRings: z.number().optional(),
                systemMaxNumberOfRings: z.number().optional(),
                destinationVoicemailEnabled: z.boolean().optional(),
              })
              .optional()
              .describe("Forward when no answer"),
          })
          .describe("Call forwarding configuration to apply to all users"),
      },
    },
    async (params) => {
      try {
        // 1. List all people with calling data
        const people = (await api.listPeople({ callingData: true, max: 500 })) as {
          items?: Array<{
            id: string;
            displayName: string;
            locationId?: string;
          }>;
        };

        // 2. Filter to Webex Calling users (those with a locationId)
        // If locationId param is provided, also filter by that location
        const wxcUsers = (people.items || []).filter(
          (p) => p.locationId && (!params.locationId || p.locationId === params.locationId)
        );

        if (wxcUsers.length === 0) {
          return {
            content: [{ type: "text", text: "No Webex Calling users found." }],
          };
        }

        // 3. Apply call forwarding to each user
        const results: Array<{ user: string; status: string; error?: string }> = [];
        for (const user of wxcUsers) {
          try {
            await api.updatePersonCallForwarding(user.id, {
              callForwarding: params.callForwarding,
            });
            results.push({ user: user.displayName, status: "success" });
          } catch (err) {
            results.push({
              user: user.displayName,
              status: "failed",
              error: (err as Error).message,
            });
          }
        }

        const successCount = results.filter((r) => r.status === "success").length;
        const failCount = results.filter((r) => r.status === "failed").length;

        const summary = [
          `Bulk call forwarding update completed.`,
          `Total Webex Calling users: ${wxcUsers.length}`,
          `Successes: ${successCount} | Failures: ${failCount}`,
          ``,
          ...results.map(
            (r) =>
              `- ${r.user}: ${r.status === "success" ? "✅" : `❌ ${r.error}`}`
          ),
        ].join("\n");

        return { content: [{ type: "text", text: summary }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Do Not Disturb ──
  server.registerTool(
    "set_do_not_disturb",
    {
      description: "Enable or disable Do Not Disturb for a user. When enabled, all calls go directly to voicemail.",
      inputSchema: {
      personId: z.string().describe("The unique ID of the person"),
      enabled: z.boolean().describe("Enable (true) or disable (false) DND"),
      ringSplashEnabled: z
        .boolean()
        .optional()
        .describe("Play ring splash on phone when call arrives during DND"),
      },
    },
    async (params) => {
      try {
        const result = await api.updatePersonDoNotDisturb(params.personId, {
          enabled: params.enabled,
          ringSplashEnabled: params.ringSplashEnabled,
        });
        return {
          content: [
            {
              type: "text",
              text: `Do Not Disturb ${params.enabled ? "enabled" : "disabled"} successfully.\n${JSON.stringify(result, null, 2)}`,
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
