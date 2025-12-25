#!/usr/bin/env node

/**
 * @fileoverview Entry point for the MCP CUPS Network Printers server.
 * Starts the Model Context Protocol server for remote printing operations via CUPS.
 */

import { startServer } from "./server.js"

// Start the MCP CUPS Network Printers server
startServer().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
