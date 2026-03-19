#!/usr/bin/env node
/**
 * Interactive CLI for Webex OAuth authentication.
 *
 * Usage:
 *   WEBEX_CLIENT_ID=xxx WEBEX_CLIENT_SECRET=yyy npm run auth
 *   npm run auth -- --status     # Check token status
 *   npm run auth -- --logout     # Clear stored tokens
 */

import {
  getOAuthConfig,
  loadTokens,
  refreshAccessToken,
  startOAuthFlow,
  clearTokens,
  DEFAULT_SCOPES,
} from "./auth.js";

async function main() {
  const args = process.argv.slice(2);

  // ── --logout ─────────────────────────────────────────────────────────────
  if (args.includes("--logout")) {
    clearTokens();
    console.log("Tokens supprimés. Vous êtes déconnecté.");
    return;
  }

  // ── --status ─────────────────────────────────────────────────────────────
  if (args.includes("--status")) {
    const tokens = loadTokens();
    if (!tokens) {
      console.log("Aucun token stocké.");
      console.log("Exécutez la commande suivante pour vous connecter :");
      console.log(
        "  WEBEX_CLIENT_ID=xxx WEBEX_CLIENT_SECRET=yyy npm run auth"
      );
      return;
    }

    const now = Date.now();
    const accessOk = tokens.expires_at > now;
    const refreshOk = tokens.refresh_token_expires_at > now;

    console.log("");
    console.log("  État des tokens Webex");
    console.log("  ─────────────────────");
    console.log(
      `  Access token:  ${accessOk ? "valide" : "expiré"} (expire le ${new Date(tokens.expires_at).toLocaleString()})`
    );
    console.log(
      `  Refresh token: ${refreshOk ? "valide" : "expiré"} (expire le ${new Date(tokens.refresh_token_expires_at).toLocaleString()})`
    );
    console.log(`  Scopes: ${tokens.scopes}`);
    console.log("");
    return;
  }

  // ── --help ───────────────────────────────────────────────────────────────
  if (args.includes("--help") || args.includes("-h")) {
    console.log("");
    console.log("  Webex MCP – Authentification OAuth2");
    console.log("  ────────────────────────────────────");
    console.log("");
    console.log("  Commandes :");
    console.log(
      "    npm run auth                 Se connecter (ouvre le navigateur)"
    );
    console.log("    npm run auth -- --status     Voir l'état des tokens");
    console.log("    npm run auth -- --logout     Supprimer les tokens");
    console.log("");
    console.log("  Variables d'environnement requises :");
    console.log("    WEBEX_CLIENT_ID              Client ID de l'intégration");
    console.log(
      "    WEBEX_CLIENT_SECRET          Client Secret de l'intégration"
    );
    console.log("");
    console.log("  Variables optionnelles :");
    console.log(
      "    WEBEX_REDIRECT_URI           (défaut: http://localhost:22991/callback)"
    );
    console.log("    WEBEX_SCOPES                 (défaut: scopes admin Calling)");
    console.log("");
    console.log("  Scopes par défaut :");
    DEFAULT_SCOPES.split(" ").forEach((s) => console.log("    " + s));
    console.log("");
    return;
  }

  // ── Login flow ───────────────────────────────────────────────────────────

  let config;
  try {
    config = getOAuthConfig();
  } catch (err) {
    console.error(
      (err as Error).message
    );
    console.error("");
    console.error("Définissez les variables d'environnement :");
    console.error(
      "  WEBEX_CLIENT_ID=xxx WEBEX_CLIENT_SECRET=yyy npm run auth"
    );
    console.error("");
    console.error("Pour plus d'aide : npm run auth -- --help");
    process.exit(1);
  }

  console.log("");
  console.log("  Webex MCP – Authentification");
  console.log("  ────────────────────────────");
  console.log(`  Client ID:    ${config.clientId.substring(0, 12)}...`);
  console.log(`  Redirect URI: ${config.redirectUri}`);
  console.log(`  Scopes:       ${config.scopes.split(" ").length} scopes`);

  // If we already have a valid refresh token, just refresh
  const existing = loadTokens();
  if (existing && existing.refresh_token_expires_at > Date.now()) {
    console.log("");
    console.log("  Refresh token existant trouvé, rafraîchissement...");
    try {
      const refreshed = await refreshAccessToken(
        config,
        existing.refresh_token
      );
      console.log("  Token rafraîchi avec succès !");
      console.log(
        `  Expire le : ${new Date(refreshed.expires_at).toLocaleString()}`
      );
      console.log("");
      return;
    } catch {
      console.log("  Échec du rafraîchissement, lancement du flux OAuth...");
    }
  }

  // Run full OAuth flow
  const tokens = await startOAuthFlow(config);
  console.log("");
  console.log(
    "  Authentification réussie ! Tokens stockés dans ~/.webex-mcp/tokens.json"
  );
  console.log(
    `  Access token expire le : ${new Date(tokens.expires_at).toLocaleString()}`
  );
  console.log(
    `  Refresh token expire le : ${new Date(tokens.refresh_token_expires_at).toLocaleString()}`
  );
  console.log("");
  console.log("  Vous pouvez maintenant démarrer le serveur MCP.");
  console.log("");
}

main().catch((err) => {
  console.error("Erreur: " + (err as Error).message);
  process.exit(1);
});
