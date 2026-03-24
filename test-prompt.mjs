#!/usr/bin/env node
/**
 * Quick test: verify that the MCP server exposes the "list-people" prompt.
 * Spawns the server, sends initialize → prompts/list → prompts/get, then exits.
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const server = spawn("node", ["dist/index.js"], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env },
});

// Collect stderr (server logs) for debugging
server.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

const rl = createInterface({ input: server.stdout });

let id = 1;
function send(method, params = {}) {
  const msg = JSON.stringify({ jsonrpc: "2.0", id: id++, method, params });
  server.stdin.write(msg + "\n");
}

const responses = [];

rl.on("line", (line) => {
  try {
    const msg = JSON.parse(line);
    responses.push(msg);

    // After initialize response → list prompts
    if (msg.id === 1) {
      console.log("\n✅ Server initialized");
      console.log("   Capabilities:", JSON.stringify(msg.result?.capabilities ?? {}, null, 2));
      send("notifications/initialized");
      send("prompts/list", {});
    }

    // After prompts/list → get the list-people prompt
    if (msg.id === 3) {
      const prompts = msg.result?.prompts ?? [];
      console.log(`\n📋 Prompts disponibles (${prompts.length}):`);
      for (const p of prompts) {
        console.log(`   - ${p.name}: ${p.description}`);
        if (p.arguments?.length) {
          for (const a of p.arguments) {
            console.log(`     arg: ${a.name} (${a.required ? "required" : "optional"}) — ${a.description}`);
          }
        }
      }

      // Now test get prompt
      send("prompts/get", { name: "list-people", arguments: { name: "John" } });
    }

    // After prompts/get → show result and exit
    if (msg.id === 4) {
      console.log("\n🔍 Prompt 'list-people' avec name='John':");
      const messages = msg.result?.messages ?? [];
      for (const m of messages) {
        console.log(`   [${m.role}]: ${m.content?.text ?? JSON.stringify(m.content)}`);
      }
      console.log("\n✅ Test terminé avec succès!");
      server.kill();
      process.exit(0);
    }
  } catch {
    // ignore non-JSON lines
  }
});

// Start by initializing
send("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "test-client", version: "1.0.0" },
});

// Timeout safety
setTimeout(() => {
  console.error("\n❌ Timeout — le serveur n'a pas répondu à temps.");
  server.kill();
  process.exit(1);
}, 10000);
