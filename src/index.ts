#!/usr/bin/env node
/**
 * Webex Calling MCP Server
 *
 * An MCP (Model Context Protocol) server that exposes Webex Calling
 * administration tools to AI assistants like Claude.
 *
 * Manage your entire Webex Calling infrastructure using natural language:
 *   - Users, phones & devices
 *   - Call forwarding, voicemail, DND
 *   - Hunt groups & call queues
 *   - Locations, schedules & holidays
 *   - Phone numbers & availability
 *   - Call analytics & missed call reports
 *   - Auto attendants (IVR)
 *
 * Authentication:
 *   Uses OAuth2 Integration (Client ID / Client Secret).
 *   Run `npm run auth` first to obtain tokens.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebexApiClient } from "./webex-api.js";
import {
  getOAuthConfig,
  loadTokens,
  refreshAccessToken,
  TokenManager,
} from "./auth.js";

// Tool registrations
import { registerPeopleTools } from "./tools/people.js";
import { registerCallForwardingTools } from "./tools/call-forwarding.js";
import { registerHuntGroupTools } from "./tools/hunt-groups.js";
import { registerCallQueueTools } from "./tools/call-queues.js";
import { registerNumberTools } from "./tools/numbers.js";
import { registerAnalyticsTools } from "./tools/analytics.js";
import { registerLocationTools } from "./tools/locations.js";
import { registerDeviceTools } from "./tools/devices.js";
import { registerContactTools } from "./tools/contacts.js";

// Prompt registrations
import { registerPeoplePrompts } from "./prompts/people.js";

// ─── Configuration ───────────────────────────────────────────────────────────

const config = getOAuthConfig(); // requires WEBEX_CLIENT_ID + WEBEX_CLIENT_SECRET
let tokens = loadTokens();

if (!tokens || tokens.refresh_token_expires_at <= Date.now()) {
  console.error("═══════════════════════════════════════════════════════════");
  console.error("  ERROR: No valid Webex tokens found.");
  console.error("");
  console.error("  Run the authentication flow first:");
  console.error("    WEBEX_CLIENT_ID=xxx WEBEX_CLIENT_SECRET=yyy npm run auth");
  console.error("");
  console.error("  This will open your browser for Webex login.");
  console.error("  Tokens are then stored locally and auto-refreshed.");
  console.error("═══════════════════════════════════════════════════════════");
  process.exit(1);
}

// Ensure access token is fresh at startup
if (tokens.expires_at <= Date.now() + 5 * 60 * 1000) {
  console.error("[webex-mcp] Access token expired, refreshing at startup...");
  try {
    tokens = await refreshAccessToken(config, tokens.refresh_token);
    console.error("[webex-mcp] Token refreshed successfully.");
  } catch (err) {
    console.error("[webex-mcp] Token refresh failed:", (err as Error).message);
    console.error("  Re-run: WEBEX_CLIENT_ID=xxx WEBEX_CLIENT_SECRET=yyy npm run auth");
    process.exit(1);
  }
}

const manager = new TokenManager(config, tokens);
console.error("[webex-mcp] OAuth mode active (auto-refresh enabled)");

// Warn if refresh token is expiring within 7 days
const daysUntilRefreshExpiry = Math.floor(
  (tokens.refresh_token_expires_at - Date.now()) / (1000 * 60 * 60 * 24)
);
if (daysUntilRefreshExpiry <= 7) {
  console.error("══════════════════════════════════════════════════════════");
  console.error(`  ⚠ ATTENTION: Refresh token expire dans ${daysUntilRefreshExpiry} jour(s) !`);
  console.error("  Exécutez: npm run auth  pour renouveler la session.");
  console.error("══════════════════════════════════════════════════════════");
} else {
  console.error(`[webex-mcp] Refresh token valide encore ${daysUntilRefreshExpiry} jours.`);
}

const api = new WebexApiClient(() => manager.getValidToken());

const server = new McpServer({
  name: "webex-calling",
  version: "1.0.0",
});

// ─── Register All Tools ──────────────────────────────────────────────────────

registerPeopleTools(server, api);
registerCallForwardingTools(server, api);
registerHuntGroupTools(server, api);
registerCallQueueTools(server, api);
registerNumberTools(server, api);
registerAnalyticsTools(server, api);
registerLocationTools(server, api);
registerDeviceTools(server, api);
registerContactTools(server, api);

// ─── Register Prompts ─────────────────────────────────────────────────────────

registerPeoplePrompts(server);

// ─── Start Server ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Webex Calling MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
