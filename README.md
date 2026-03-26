# Webex Calling MCP Server

An MCP (Model Context Protocol) server that lets you **manage your entire Webex Calling infrastructure using natural language** through an AI assistant like Claude.

Built for Cisco partners and network engineers to demonstrate the power of AI-driven network administration.

## Prerequisites

### 1. Node.js (v18 or later)

Node.js is the runtime needed to execute the MCP server. You must install it on every machine where you want to run the server.

<details>
<summary><strong>macOS</strong></summary>

**Option A — Installer:**
1. Go to [nodejs.org](https://nodejs.org) and download the **LTS** version (green button)
2. Open the `.pkg` file and follow the installer
3. Open **Terminal** (Spotlight → type "Terminal") and verify:
   ```bash
   node --version
   npm --version
   ```

**Option B — Homebrew** (if you have it):
```bash
brew install node
```

</details>

<details>
<summary><strong>Windows</strong></summary>

1. Go to [nodejs.org](https://nodejs.org) and download the **LTS** version (green button)
2. Run the `.msi` installer — **keep all default options** (this adds `node` and `npm` to your PATH automatically)
3. **Restart your terminal** (close and reopen PowerShell or cmd)
4. Verify the installation:
   ```powershell
   node --version
   npm --version
   ```

> **Troubleshooting:** If `npm` is not recognized after installation, restart your computer to ensure the PATH is updated.

</details>

### 2. Git

Git is needed to clone this repository.

<details>
<summary><strong>macOS</strong></summary>

Git is pre-installed on macOS. Verify with:
```bash
git --version
```
If prompted to install Xcode Command Line Tools, accept the installation.

</details>

<details>
<summary><strong>Windows</strong></summary>

1. Download Git from [git-scm.com](https://git-scm.com/download/win)
2. Run the installer — **keep all default options**
3. Restart your terminal and verify:
   ```powershell
   git --version
   ```

</details>

### 3. A Webex Full Admin account

### 4. An AI client that supports MCP

- **VS Code** with GitHub Copilot (Chat agent mode) — [Download VS Code](https://code.visualstudio.com)
- **Claude Desktop** — [Download Claude Desktop](https://claude.ai/download)

## Demo Scenarios (Live with partners)

| Natural Language Command | What it does |
| --- | --- |
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

### 1. Clone the repository

<details>
<summary><strong>macOS</strong></summary>

Open **Terminal** and run:
```bash
cd ~/Desktop
git clone https://github.com/rochaussee/webex-calling-mcp.git
cd webex-calling-mcp
```

</details>

<details>
<summary><strong>Windows</strong></summary>

Open **PowerShell** and run:
```powershell
cd $HOME\Desktop
git clone https://github.com/rochaussee/webex-calling-mcp.git
cd webex-calling-mcp
```

</details>

### 2. Create a Webex Integration

1. Go to [developer.webex.com](https://developer.webex.com/my-apps/new/integration)
2. Sign in with your Webex Full Admin account
3. Create a new **Integration** and note the **Client ID** and **Client Secret**
4. Set the Redirect URI to `http://localhost:22991/callback`
5. Select the required scopes (see `src/auth.ts` for the default list)

### 3. Install dependencies & Build

These commands are the same on macOS and Windows:

```bash
npm install
npm run build
```

> **Note:** You must be in the project folder (e.g. `cd webex-calling-mcp`) before running these commands.

### 4. Authenticate (one-time setup)

<details>
<summary><strong>macOS / Linux</strong></summary>

```bash
WEBEX_CLIENT_ID=xxx WEBEX_CLIENT_SECRET=yyy npm run auth
```

</details>

<details>
<summary><strong>Windows (PowerShell)</strong></summary>

On Windows, you must set environment variables separately — the `VAR=value command` syntax does not work in PowerShell:

```powershell
$env:WEBEX_CLIENT_ID="xxx"
$env:WEBEX_CLIENT_SECRET="yyy"
npm run auth
```

</details>

Replace `xxx` and `yyy` with the **Client ID** and **Client Secret** from step 2.

**What happens:**

1. Your browser opens the Webex login page
2. You sign in with your Webex admin account
3. Webex sends back authentication tokens to the local server
4. Tokens are saved locally in `~/.webex-mcp/tokens.json`

**About tokens:**

- **Access token** (~14 days): used by the MCP server to call Webex APIs
- **Refresh token** (~90 days): used to automatically renew the access token when it expires
- You only need to re-run `npm run auth` every ~90 days when the refresh token expires

Useful commands:

```bash
npm run auth -- --status   # Check token status
npm run auth -- --logout   # Clear stored tokens
npm run auth -- --help     # Full help
```

### 5. Configure in your MCP Client

The MCP server needs your **Client ID** and **Client Secret** at runtime to automatically refresh expired access tokens. These are passed as environment variables in the MCP configuration.

> **Why are Client ID / Secret needed here too?** The `npm run auth` step uses them to *obtain* tokens. The MCP server config needs them to *refresh* tokens automatically. Without them, you'd have to re-authenticate manually every ~14 days instead of every ~90 days.

#### VS Code (Copilot / Claude Dev)

Add to your `.vscode/mcp.json` or VS Code global settings:

- **macOS**: `~/Library/Application Support/Code/User/mcp.json`
- **Windows**: `%APPDATA%\Code\User\mcp.json`

<details>
<summary><strong>macOS example</strong></summary>

```json
{
  "mcpServers": {
    "webex-calling": {
      "command": "node",
      "args": ["/Users/<your-username>/Desktop/webex-calling-mcp/dist/index.js"],
      "env": {
        "WEBEX_CLIENT_ID": "your-integration-client-id",
        "WEBEX_CLIENT_SECRET": "your-integration-client-secret"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Windows example</strong></summary>

```json
{
  "mcpServers": {
    "webex-calling": {
      "command": "node",
      "args": ["C:\\Users\\<your-username>\\Desktop\\webex-calling-mcp\\dist\\index.js"],
      "env": {
        "WEBEX_CLIENT_ID": "your-integration-client-id",
        "WEBEX_CLIENT_SECRET": "your-integration-client-secret"
      }
    }
  }
}
```

> **Note:** Use double backslashes `\\` in JSON paths on Windows.

</details>

> **Security note:** This file is local to your machine and not tracked by git. Never commit your credentials.

#### Claude Desktop

Add to your Claude Desktop config:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

<details>
<summary><strong>macOS example</strong></summary>

```json
{
  "mcpServers": {
    "webex-calling": {
      "command": "node",
      "args": ["/Users/<your-username>/Desktop/webex-calling-mcp/dist/index.js"],
      "env": {
        "WEBEX_CLIENT_ID": "your-integration-client-id",
        "WEBEX_CLIENT_SECRET": "your-integration-client-secret"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Windows example</strong></summary>

```json
{
  "mcpServers": {
    "webex-calling": {
      "command": "node",
      "args": ["C:\\Users\\<your-username>\\Desktop\\webex-calling-mcp\\dist\\index.js"],
      "env": {
        "WEBEX_CLIENT_ID": "your-integration-client-id",
        "WEBEX_CLIENT_SECRET": "your-integration-client-secret"
      }
    }
  }
}
```

</details>

### 6. Start Talking to Your Infrastructure

Once configured, restart VS Code or Claude Desktop, then just ask questions in natural language. The AI will automatically pick the right MCP tools.

**How to open a terminal:**
- **macOS**: Spotlight (⌘ + Space) → type "Terminal", or in VS Code: `Ctrl + `` `
- **Windows**: Search → type "PowerShell", or in VS Code: `` Ctrl + ` ``

## Architecture

```text
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

```text
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

<details>
<summary><strong>macOS / Linux</strong></summary>

```bash
# Run in development mode (no build step)
WEBEX_CLIENT_ID=xxx WEBEX_CLIENT_SECRET=yyy npx tsx src/index.ts

# Build for production
npm run build

# Run production build
WEBEX_CLIENT_ID=xxx WEBEX_CLIENT_SECRET=yyy node dist/index.js
```

</details>

<details>
<summary><strong>Windows (PowerShell)</strong></summary>

```powershell
# Set environment variables (do this once per terminal session)
$env:WEBEX_CLIENT_ID="xxx"
$env:WEBEX_CLIENT_SECRET="yyy"

# Run in development mode
npx tsx src/index.ts

# Build for production
npm run build

# Run production build
node dist/index.js
```

</details>

## Security Notes

- **Never commit your Client ID / Client Secret** — always use environment variables
- Tokens are stored locally in `~/.webex-mcp/tokens.json` (macOS/Linux) or `%USERPROFILE%\.webex-mcp\tokens.json` (Windows) with restricted permissions
- Token scope requirements depend on which tools you use:
  - `spark-admin:people_read` — people listing
  - `spark-admin:telephony_config_read` / `_write` — calling config
  - `spark-admin:calling_cdr_read` — call history/CDR
  - `spark-admin:devices_read` — device inventory

## License

MIT
