/**
 * @fileoverview MCP Server implementation for network printing operations.
 * Provides a Model Context Protocol server that exposes printing tools via CUPS.
 * Supports both stdio and SSE transports for local and remote access.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { registerAllTools } from "./tools/index.js"
import { config } from "./config.js"
import { startHttpServer } from "./http-transport.js"
import packageJson from "../package.json" with { type: "json" }

/**
 * MCP Server instance for network printing via CUPS.
 * Handles printer management, print jobs, document rendering, and file uploads.
 */
export const mcpServer = new McpServer({
  name: "mcp-cups-network-printers",
  version: packageJson.version,
})

// Register all tools with the server
registerAllTools(mcpServer)

/**
 * Starts the MCP Printer server with the configured transport.
 * Supports stdio (default) for local/SSH usage and SSE for remote HTTP access.
 *
 * @throws {Error} If server connection fails or unsupported OS detected
 */
export async function startServer() {
  // Check for unsupported operating systems
  if (process.platform === "win32") {
    throw new Error(
      "MCP CUPS Network Printers is not supported on Windows. " +
        "This server requires CUPS printing system, which is only available on macOS and Linux. " +
        "Windows uses a different printing architecture that is not currently supported."
    )
  }

  // Log platform and transport information
  console.error(`MCP CUPS Network Printers starting on ${process.platform}...`)
  console.error(`Transport mode: ${config.network.transport}`)

  if (config.network.transport === "sse") {
    // Start HTTP server with SSE transport for remote access
    await startHttpServer(mcpServer)
  } else {
    // Use stdio transport (default) for local/SSH usage
    const transport = new StdioServerTransport()
    await mcpServer.connect(transport)
    console.error("MCP CUPS Network Printers running on stdio")
  }
}
