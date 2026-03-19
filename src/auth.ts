/**
 * OAuth2 Authentication for Webex Integration.
 *
 * Implements Authorization Code Flow with PKCE:
 *   1. User runs `npm run auth` → browser opens → logs into Webex
 *   2. Tokens stored locally in ~/.webex-mcp/tokens.json
 *   3. MCP server auto-refreshes access tokens using the refresh token
 *
 * Tokens lifetime:
 *   - Access token:  ~14 days
 *   - Refresh token: ~90 days (renewed on each refresh)
 */

import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { exec } from "node:child_process";

// ─── Constants ───────────────────────────────────────────────────────────────

const WEBEX_AUTH_URL = "https://webexapis.com/v1/authorize";
const WEBEX_TOKEN_URL = "https://webexapis.com/v1/access_token";

const TOKEN_DIR = path.join(os.homedir(), ".webex-mcp");
const TOKEN_FILE = path.join(TOKEN_DIR, "tokens.json");

const DEFAULT_PORT = 22991;
const DEFAULT_REDIRECT_URI = `http://localhost:${DEFAULT_PORT}/callback`;

/**
 * Default scopes for Webex Calling administration.
 * Override with WEBEX_SCOPES env var if needed.
 */
export const DEFAULT_SCOPES = [
  "spark-admin:people_read",
  "spark-admin:people_write",
  "spark-admin:telephony_config_read",
  "spark-admin:telephony_config_write",
  "spark-admin:devices_read",
  "spark-admin:devices_write",
  "spark-admin:licenses_read",
  "spark-admin:locations_read",
  "spark-admin:workspaces_read",
  "spark-admin:calling_cdr_read",
  "Identity:contact",
  "identity:groups_read",
  "identity:groups_rw",
  "spark:kms",
].join(" ");

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;              // Unix timestamp in ms
  refresh_token_expires_at: number; // Unix timestamp in ms
  scopes: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

/**
 * Build OAuth config from environment variables.
 */
export function getOAuthConfig(): OAuthConfig {
  const clientId = process.env.WEBEX_CLIENT_ID;
  const clientSecret = process.env.WEBEX_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "WEBEX_CLIENT_ID and WEBEX_CLIENT_SECRET environment variables are required"
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: process.env.WEBEX_REDIRECT_URI || DEFAULT_REDIRECT_URI,
    scopes: process.env.WEBEX_SCOPES || DEFAULT_SCOPES,
  };
}

// ─── Token Storage ───────────────────────────────────────────────────────────

export function loadTokens(): StoredTokens | null {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8")) as StoredTokens;
    }
  } catch {
    // Corrupt file — will need re-auth
  }
  return null;
}

function saveTokens(tokens: StoredTokens): void {
  if (!fs.existsSync(TOKEN_DIR)) {
    fs.mkdirSync(TOKEN_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export function clearTokens(): void {
  if (fs.existsSync(TOKEN_FILE)) {
    fs.unlinkSync(TOKEN_FILE);
  }
}

// ─── Token Refresh ───────────────────────────────────────────────────────────

export async function refreshAccessToken(
  config: OAuthConfig,
  refreshToken: string
): Promise<StoredTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch(WEBEX_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    refresh_token_expires_in: number;
    scope?: string;
  };

  const now = Date.now();
  const tokens: StoredTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: now + data.expires_in * 1000,
    refresh_token_expires_at: now + data.refresh_token_expires_in * 1000,
    scopes: data.scope || config.scopes,
  };

  saveTokens(tokens);
  return tokens;
}

// ─── OAuth Authorization Code Flow (PKCE) ────────────────────────────────────

/**
 * Start the OAuth flow: opens browser, waits for callback, exchanges code.
 * Returns stored tokens on success.
 */
export async function startOAuthFlow(config: OAuthConfig): Promise<StoredTokens> {
  // Generate PKCE code verifier + challenge
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const state = crypto.randomBytes(16).toString("hex");

  // Build authorization URL
  const authUrl = new URL(WEBEX_AUTH_URL);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("scope", config.scopes);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return new Promise<StoredTokens>((resolve, reject) => {
    const parsedRedirect = new URL(config.redirectUri);
    const port = parseInt(parsedRedirect.port, 10) || DEFAULT_PORT;
    const callbackPath = parsedRedirect.pathname;

    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith(callbackPath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const reqUrl = new URL(req.url, `http://localhost:${port}`);
      const code = reqUrl.searchParams.get("code");
      const returnedState = reqUrl.searchParams.get("state");
      const error = reqUrl.searchParams.get("error");
      const errorDescription = reqUrl.searchParams.get("error_description");

      if (error) {
        const msg = `Webex OAuth error: ${error}${errorDescription ? " — " + errorDescription : ""}`;
        console.error("\n  " + msg);
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<h1>Erreur OAuth</h1><p>${error}</p><p>${errorDescription || ""}</p>`);
        server.close();
        reject(new Error(msg));
        return;
      }

      if (!code || returnedState !== state) {
        console.error("\n  Callback reçu sans code. Params:", Object.fromEntries(reqUrl.searchParams));
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>Erreur : code manquant ou state invalide</h1>");
        server.close();
        reject(new Error("OAuth callback: missing code or state mismatch"));
        return;
      }

      try {
        // Exchange authorization code for tokens
        const tokenBody = new URLSearchParams({
          grant_type: "authorization_code",
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.redirectUri,
          code_verifier: codeVerifier,
        });

        const tokenResponse = await fetch(WEBEX_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenBody.toString(),
        });

        if (!tokenResponse.ok) {
          const errText = await tokenResponse.text();
          throw new Error(
            `Token exchange failed (${tokenResponse.status}): ${errText}`
          );
        }

        const data = (await tokenResponse.json()) as {
          access_token: string;
          refresh_token: string;
          expires_in: number;
          refresh_token_expires_in: number;
          scope?: string;
        };

        const now = Date.now();
        const tokens: StoredTokens = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: now + data.expires_in * 1000,
          refresh_token_expires_at: now + data.refresh_token_expires_in * 1000,
          scopes: data.scope || config.scopes,
        };

        saveTokens(tokens);

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding-top: 80px; background: #f5f5f5;">
  <div style="background: white; display: inline-block; padding: 40px 60px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h1 style="color: #07C160;">Authentification réussie !</h1>
    <p>Vous pouvez fermer cette fenêtre et retourner à VS Code.</p>
    <p style="color: #888; font-size: 0.9em;">Tokens stockés dans ~/.webex-mcp/tokens.json</p>
  </div>
</body></html>`);

        server.close();
        resolve(tokens);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<h1>Erreur d'authentification</h1><pre>" + String(err) + "</pre>"
        );
        server.close();
        reject(err);
      }
    });

    server.listen(port, () => {
      const url = authUrl.toString();
      console.log("");
      console.log("══════════════════════════════════════════════════════════");
      console.log("  Webex OAuth – Connexion requise");
      console.log("══════════════════════════════════════════════════════════");
      console.log("");
      console.log("  Votre navigateur va s'ouvrir automatiquement.");
      console.log("  Sinon, copiez-collez l'URL ci-dessous :");
      console.log("");
      console.log("  " + url);
      console.log("");
      console.log("  En attente de l'authentification...");
      console.log("");

      // Auto-open browser
      const cmd =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
            ? "start"
            : "xdg-open";
      exec(`${cmd} "${url}"`, () => {
        /* ignore errors — user can open manually */
      });
    });

    server.on("error", (err) => {
      reject(
        new Error(`Impossible de démarrer le serveur sur le port ${port}: ${err.message}`)
      );
    });

    // 5-minute timeout
    setTimeout(() => {
      server.close();
      reject(new Error("Timeout : pas d'authentification reçue (5 minutes)"));
    }, 5 * 60 * 1000);
  });
}

// ─── Token Manager (used by the MCP server at runtime) ───────────────────────

/**
 * Manages access token lifecycle: auto-refreshes before expiry.
 */
export class TokenManager {
  private config: OAuthConfig;
  private tokens: StoredTokens;

  constructor(config: OAuthConfig, tokens: StoredTokens) {
    this.config = config;
    this.tokens = tokens;
  }

  /**
   * Returns a valid access token, refreshing automatically if needed.
   */
  async getValidToken(): Promise<string> {
    const now = Date.now();

    // Refresh 5 minutes before expiry
    if (now >= this.tokens.expires_at - 5 * 60 * 1000) {
      console.error("[webex-mcp] Access token expiring soon, refreshing...");
      this.tokens = await refreshAccessToken(
        this.config,
        this.tokens.refresh_token
      );
      console.error("[webex-mcp] Token refreshed successfully.");
    }

    return this.tokens.access_token;
  }
}
