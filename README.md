# Webex Calling MCP Server

An MCP (Model Context Protocol) server that lets you **manage your entire Webex Calling infrastructure using natural language** through an AI assistant like Claude.

Built for Cisco partners and network engineers to demonstrate the power of AI-driven network administration.

## Demo Scenarios (Live with partners)

| Natural Language Command | What it does |
|---|---|
| *"Redirect all incoming calls from the Paris office to voicemail until Monday morning."* | Uses call intercept to redirect calls |
| *"Create a hunt group for the support team with these 5 numbers, using a round-robin distribution."* | Creates a hunt group with CIRCULAR policy |
| *"Show me which users in the organization do not have a phone assigned."* | Audits users missing phone numbers |
| *"Generate a report of missed calls over the last 24 hours."* | Analyzes CDR data and produces a summary |
| *"Set up a holiday schedule for all locations — close offices Dec 24-Jan 2."* | Creates holiday schedules per location |
| *"List all call queues and their average wait times."* | Queries call queue configurations |
| *"Enable Do Not Disturb for the entire executive team."* | Batch-updates DND settings |
| *"Find available phone numbers in the London office."* | Queries number inventory |

## Available Tools (30+)

### People & Users
- `list_people` — List/search users with calling data
- `get_person` — Get detailed user info
- `find_users_without_phones` — Audit users without phone numbers

### Call Forwarding & Voicemail
- `get_call_forwarding` / `update_call_forwarding` — Manage forwarding rules
- `get_voicemail` / `update_voicemail` — Configure voicemail
- `redirect_calls_to_voicemail` — Quick call intercept (great for demos!)
- `set_do_not_disturb` — Enable/disable DND

### Hunt Groups
- `list_hunt_groups` / `get_hunt_group` — View hunt groups
- `create_hunt_group` — Create with agents & routing policy
- `update_hunt_group` / `delete_hunt_group` — Manage existing groups

### Call Queues
- `list_call_queues` / `get_call_queue` — View queues
- `create_call_queue` — Create with agents & queue settings
- `update_call_queue` / `delete_call_queue` — Manage existing queues

### Phone Numbers
- `list_numbers` — List all numbers with filtering
- `find_available_numbers` — Find unassigned numbers

### Call Analytics
- `get_call_history` — Raw CDR data
- `get_missed_calls_report` — Formatted missed call analysis with charts-ready data

### Locations & Schedules
- `list_locations` / `get_location` — View office locations
- `list_schedules` — View business hours & holiday schedules
- `create_holiday_schedule` — Create holiday schedules
- `list_auto_attendants` / `get_auto_attendant` — View IVR menus

### Devices & Workspaces
- `list_devices` / `get_device` — View device inventory
- `list_workspaces` — View conference rooms & shared spaces
- `get_caller_id` / `update_caller_id` — Manage caller ID settings

## Quick Start

### 1. Create a Webex Integration

1. Go to [developer.webex.com](https://developer.webex.com/my-apps/new/integration)
2. Sign in with your Webex admin account
3. Create a new **Integration** and note the **Client ID** and **Client Secret**
4. Set the Redirect URI to `http://localhost:22991/callback`
5. Select the required scopes (see `src/auth.ts` for the default list)

### 2. Install & Build

```bash
npm install
npm run build
```

### 3. Authenticate

```bash
WEBEX_CLIENT_ID=xxx WEBEX_CLIENT_SECRET=yyy npm run auth
```

This opens your browser for Webex login. Tokens are stored locally in `~/.webex-mcp/tokens.json` and auto-refreshed (access token ~14 days, refresh token ~90 days).

Useful commands:
```bash
npm run auth -- --status   # Check token status
npm run auth -- --logout   # Clear stored tokens
npm run auth -- --help     # Full help
```

### 4. Configure in your MCP Client

#### VS Code (Copilot / Claude Dev)

Add to your `.vscode/mcp.json` or VS Code settings:

```json
{
  "mcpServers": {
    "webex-calling": {
      "command": "node",
      "args": ["<absolute-path-to>/dist/index.js"],
      "env": {
        "WEBEX_CLIENT_ID": "your-integration-client-id",
        "WEBEX_CLIENT_SECRET": "your-integration-client-secret"
      }
    }
  }
}
```

#### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "webex-calling": {
      "command": "node",
      "args": ["<absolute-path-to>/dist/index.js"],
      "env": {
        "WEBEX_CLIENT_ID": "your-integration-client-id",
        "WEBEX_CLIENT_SECRET": "your-integration-client-secret"
      }
    }
  }
}
```

### 5. Start Talking to Your Infrastructure!

Once configured, just ask Claude/Copilot questions in natural language. The AI will automatically pick the right MCP tools.

## Architecture

```
┌─────────────────┐     stdio / JSON-RPC     ┌──────────────────────┐
│   AI Assistant   │ ◄──────────────────────► │  MCP Server          │
│ (Claude/Copilot) │                          │  (this project)      │
└─────────────────┘                          └──────┬───────────────┘
                                                     │ HTTPS
                                                     ▼
                                              ┌──────────────────────┐
                                              │  Webex REST APIs     │
                                              │  webexapis.com/v1    │
                                              └──────────────────────┘
```

- **Transport**: stdio (standard model context protocol)
- **SDK**: `@modelcontextprotocol/sdk` (official MCP TypeScript SDK)
- **API Client**: Typed wrapper around Webex REST API v1
- **Auth**: OAuth2 Integration (Client ID / Client Secret) with auto-refresh

## Project Structure

```
src/
├── index.ts             # MCP server entry point
├── auth.ts              # OAuth2 authentication (PKCE flow + token refresh)
├── auth-cli.ts          # CLI for login, status, logout
├── webex-api.ts         # Webex REST API client
└── tools/
    ├── people.ts        # People & user management
    ├── call-forwarding.ts # Call forwarding, voicemail, DND, intercept
    ├── hunt-groups.ts   # Hunt group CRUD
    ├── call-queues.ts   # Call queue CRUD
    ├── numbers.ts       # Phone number management
    ├── analytics.ts     # CDR & missed call reports
    ├── locations.ts     # Locations, schedules, auto attendants
    └── devices.ts       # Devices, workspaces, caller ID
```

## Development

```bash
# Run in development mode (no build step)
WEBEX_CLIENT_ID=xxx WEBEX_CLIENT_SECRET=yyy npx tsx src/index.ts

# Build for production
npm run build

# Run production build
WEBEX_CLIENT_ID=xxx WEBEX_CLIENT_SECRET=yyy node dist/index.js
```

## Security Notes

- **Never commit your Client ID / Client Secret** — always use environment variables
- Tokens are stored locally in `~/.webex-mcp/tokens.json` with restricted permissions
- Token scope requirements depend on which tools you use:
  - `spark-admin:people_read` — people listing
  - `spark-admin:telephony_config_read` / `_write` — calling config
  - `spark-admin:calling_cdr_read` — call history/CDR
  - `spark-admin:devices_read` — device inventory

## License

MIT
