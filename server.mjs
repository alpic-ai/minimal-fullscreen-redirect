import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const require = createRequire(import.meta.url);
// Self-contained ESM build of the ext-apps client, inlined into the view so no
// bundler and no cross-origin script load is needed.
const rawBundle = readFileSync(require.resolve("@modelcontextprotocol/ext-apps/app-with-deps"), "utf8");
// The bundle is minified; turn its export list into a plain `App` binding so
// the inline script below can use it.
const appLocal = rawBundle.match(/(\w+) as App[,}]/)?.[1];
if (!appLocal) throw new Error("App export not found in ext-apps bundle");
const extAppsBundle = rawBundle.replace(/export\s*\{[^}]*\};?/, `const App = ${appLocal};`);
const html = readFileSync(new URL("./view.html", import.meta.url), "utf8").replace("__EXT_APPS_BUNDLE__", () => extAppsBundle);

const RESOURCE_URI = "ui://bug-fullscreen-redirect/card.html";
const REDIRECT_DOMAINS = ["https://www.google.com"];

function buildServer() {
  const server = new McpServer({ name: "bug-fullscreen-redirect", version: "0.0.1" });

  server.registerResource("card", RESOURCE_URI, { mimeType: "text/html;profile=mcp-app" }, async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "text/html;profile=mcp-app",
      text: html,
      _meta: {
        ui: { csp: { resourceDomains: [], connectDomains: [] } },
        "openai/widgetCSP": { resource_domains: [], connect_domains: [], redirect_domains: REDIRECT_DOMAINS },
      },
    }],
  }));

  server.registerTool(
    "show_card",
    {
      title: "Show card",
      description: "Shows a test card. Call it when the user asks to show the card.",
      inputSchema: { title: z.string().optional() },
      _meta: {
        ui: { resourceUri: RESOURCE_URI },
        "ui/resourceUri": RESOURCE_URI,
        "openai/outputTemplate": RESOURCE_URI,
        "openai/toolInvocation/invoking": "Showing card…",
        "openai/toolInvocation/invoked": "Card shown.",
      },
    },
    async ({ title }) => ({
      content: [{ type: "text", text: "Card displayed." }],
      structuredContent: { title: title ?? "Fullscreen redirect repro" },
    }),
  );
  return server;
}

const app = express();
app.use(express.json());
app.post("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
app.get("/mcp", (_req, res) => res.status(405).end());

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`MCP server on http://localhost:${port}/mcp`));
