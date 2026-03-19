/**
 * MCP Tools — Call Forwarding, Voicemail & Call Intercept
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebexApiClient } from "../webex-api.js";

export function registerCallForwardingTools(server: McpServer, api: WebexApiClient) {
  // ── Get Call Forwarding ──
  server.tool(
    "get_call_forwarding",
    "Get the call forwarding settings for a specific user.",
    {
      personId: z.string().describe("The unique ID of the person"),
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
  server.tool(
    "update_call_forwarding",
    "Update call forwarding settings for a user. Can enable/disable forwarding, " +
      "set always-forward, busy-forward, no-answer-forward, and selective forwarding rules.",
    {
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
  server.tool(
    "get_voicemail",
    "Get voicemail settings for a specific user.",
    {
      personId: z.string().describe("The unique ID of the person"),
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
  server.tool(
    "update_voicemail",
    "Update voicemail settings for a user. Enable/disable voicemail, configure notifications, greetings, etc.",
    {
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
  server.tool(
    "redirect_calls_to_voicemail",
    "Redirect all incoming calls for a user to voicemail using call intercept. " +
      "Perfect for out-of-office, holidays, or temporary redirections. " +
      'Example: "Redirect all calls from the Paris office to voicemail until Monday."',
    {
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

  // ── Do Not Disturb ──
  server.tool(
    "set_do_not_disturb",
    "Enable or disable Do Not Disturb for a user. When enabled, all calls go directly to voicemail.",
    {
      personId: z.string().describe("The unique ID of the person"),
      enabled: z.boolean().describe("Enable (true) or disable (false) DND"),
      ringSplashEnabled: z
        .boolean()
        .optional()
        .describe("Play ring splash on phone when call arrives during DND"),
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
