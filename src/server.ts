/**
 * @fileoverview MCP Server for CUPS network printing.
 * Supports both streamable HTTP (default) and stdio transports.
 */

import { randomUUID } from "node:crypto"
import { createServer, IncomingMessage, ServerResponse } from "node:http"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { registerTools } from "./tools.js"
import { config } from "./config.js"
import packageJson from "../package.json" with { type: "json" }

/**
 * MCP Server instance for CUPS network printing.
 */
export const mcpServer = new McpServer({
  name: "lan-mcp-cups",
  version: packageJson.version,
})

// Register tools
registerTools(mcpServer)

/**
 * Active transport instance for the server.
 */
let transport: StreamableHTTPServerTransport | StdioServerTransport | null = null

/**
 * Starts the MCP server with streamable HTTP transport.
 */
async function startHttpServer(): Promise<void> {
  const httpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
  })

  transport = httpTransport

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, mcp-session-id",
      })
      res.end()
      return
    }

    // Set CORS headers for all responses
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id")
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id")

    // Route MCP requests to /mcp endpoint
    if (req.url === "/mcp" || req.url?.startsWith("/mcp?")) {
      // Parse request body for POST requests
      if (req.method === "POST") {
        let body = ""
        for await (const chunk of req) {
          body += chunk
        }
        try {
          const parsedBody = JSON.parse(body)
          await httpTransport.handleRequest(req, res, parsedBody)
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "Invalid JSON" }))
        }
      } else {
        await httpTransport.handleRequest(req, res)
      }
      return
    }

    // Health check endpoint
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        status: "ok",
        name: "lan-mcp-cups",
        version: packageJson.version,
        transport: "streamable-http",
      }))
      return
    }

    // 404 for unknown routes
    res.writeHead(404, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Not found" }))
  })

  await mcpServer.connect(httpTransport)

  server.listen(config.httpPort, config.httpHost, () => {
    console.error(`LAN MCP CUPS running at http://${config.httpHost}:${config.httpPort}/mcp`)
  })

  // Handle graceful shutdown
  const shutdown = () => {
    console.error("\nShutting down...")
    server.close()
    httpTransport.close()
    process.exit(0)
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

/**
 * Starts the MCP server with stdio transport (legacy mode).
 */
async function startStdioServer(): Promise<void> {
  const stdioTransport = new StdioServerTransport()
  transport = stdioTransport
  await mcpServer.connect(stdioTransport)
  console.error("LAN MCP CUPS running on stdio")
}

/**
 * Starts the MCP server with the configured transport.
 */
export async function startServer(): Promise<void> {
  // Check for unsupported OS
  if (process.platform === "win32") {
    throw new Error(
      "MCP CUPS requires a Unix-like system with CUPS. Windows is not supported."
    )
  }

  // Log startup info
  const serverInfo = config.cupsServer
    ? `CUPS server: ${config.cupsServer}:${config.cupsPort}`
    : "CUPS server: localhost (set MCP_CUPS_SERVER to connect to a remote server)"

  console.error(`LAN MCP CUPS starting...`)
  console.error(serverInfo)

  // Start the appropriate transport
  if (config.transport === "stdio") {
    await startStdioServer()
  } else {
    await startHttpServer()
  }
}
