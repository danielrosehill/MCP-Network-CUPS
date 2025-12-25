/**
 * @fileoverview MCP Server for CUPS network printing.
 * Runs as a stdio MCP server for local clients (Claude Code, etc.)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { registerTools } from "./tools.js"
import { config } from "./config.js"
import packageJson from "../package.json" with { type: "json" }

/**
 * MCP Server instance for CUPS network printing.
 */
export const mcpServer = new McpServer({
  name: "mcp-cups",
  version: packageJson.version,
})

// Register tools
registerTools(mcpServer)

/**
 * Starts the MCP server with stdio transport.
 */
export async function startServer() {
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

  console.error(`MCP CUPS starting...`)
  console.error(serverInfo)

  // Start stdio transport
  const transport = new StdioServerTransport()
  await mcpServer.connect(transport)

  console.error("MCP CUPS running on stdio")
}
