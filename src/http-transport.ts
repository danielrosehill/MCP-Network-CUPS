/**
 * @fileoverview HTTP/SSE transport wrapper for MCP Server.
 * Provides Server-Sent Events transport for remote MCP client connections.
 */

import express, { Request, Response } from "express"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { config } from "./config.js"

/**
 * Active SSE transport connections.
 * Maps session IDs to their SSE transports for message routing.
 */
const activeTransports = new Map<string, SSEServerTransport>()

/**
 * Creates and starts an HTTP server with SSE transport for MCP.
 *
 * @param mcpServer - The MCP server instance to connect
 * @returns Promise that resolves when server is listening
 */
export async function startHttpServer(mcpServer: McpServer): Promise<void> {
  const app = express()

  // Parse JSON bodies for POST requests
  app.use(express.json({ limit: `${Math.ceil(config.upload.maxSize / 1024 / 1024)}mb` }))

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "healthy",
      server: "mcp-cups-network-printers",
      transport: "sse",
    })
  })

  // SSE endpoint for MCP connections
  app.get("/sse", async (req: Request, res: Response) => {
    console.error(`New SSE connection from ${req.ip}`)

    // Create SSE transport for this connection
    const transport = new SSEServerTransport("/message", res)
    const sessionId = generateSessionId()
    activeTransports.set(sessionId, transport)

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.setHeader("X-Session-Id", sessionId)

    // Handle connection close
    res.on("close", () => {
      console.error(`SSE connection closed: ${sessionId}`)
      activeTransports.delete(sessionId)
    })

    // Connect MCP server to this transport
    try {
      await mcpServer.connect(transport)
      console.error(`MCP connected via SSE: ${sessionId}`)
    } catch (error) {
      console.error(`Failed to connect MCP via SSE: ${error}`)
      activeTransports.delete(sessionId)
      res.end()
    }
  })

  // Message endpoint for client-to-server communication
  app.post("/message", async (req: Request, res: Response) => {
    const sessionId = req.headers["x-session-id"] as string

    if (!sessionId) {
      res.status(400).json({ error: "Missing X-Session-Id header" })
      return
    }

    const transport = activeTransports.get(sessionId)
    if (!transport) {
      res.status(404).json({ error: "Session not found" })
      return
    }

    try {
      // Handle the incoming message through the transport
      await transport.handlePostMessage(req, res)
    } catch (error) {
      console.error(`Error handling message: ${error}`)
      res.status(500).json({ error: "Internal server error" })
    }
  })

  // Start the HTTP server
  return new Promise((resolve) => {
    app.listen(config.network.port, config.network.host, () => {
      console.error(
        `MCP CUPS Network Printer Server running on http://${config.network.host}:${config.network.port}`
      )
      console.error(`SSE endpoint: http://${config.network.host}:${config.network.port}/sse`)
      console.error(`Message endpoint: http://${config.network.host}:${config.network.port}/message`)
      resolve()
    })
  })
}

/**
 * Generates a unique session ID for tracking SSE connections.
 *
 * @returns Unique session identifier
 */
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}
