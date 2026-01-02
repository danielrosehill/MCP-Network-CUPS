/**
 * @fileoverview Configuration for MCP CUPS client.
 * Connects to a remote CUPS server and sends print jobs.
 */

/**
 * Configuration interface for MCP CUPS client.
 */
export interface Config {
  /** CUPS server hostname or IP address (required) */
  cupsServer: string
  /** CUPS server port (default: 631) */
  cupsPort: number
  /** Default printer name for print operations */
  defaultPrinter: string
  /** Maximum number of copies allowed per print job (0 = unlimited) */
  maxCopies: number
  /** HTTP server host (default: 127.0.0.1) */
  httpHost: string
  /** HTTP server port (default: 3000) */
  httpPort: number
  /** Transport mode: "http" or "stdio" (default: http) */
  transport: "http" | "stdio"
}

const DEFAULT_CUPS_PORT = 631
const DEFAULT_MAX_COPIES = 10
const DEFAULT_HTTP_HOST = "127.0.0.1"
const DEFAULT_HTTP_PORT = 3000

/**
 * Global configuration loaded from environment variables.
 */
export const config: Config = {
  cupsServer: process.env.MCP_CUPS_SERVER || "",
  cupsPort: parseInt(process.env.MCP_CUPS_PORT || String(DEFAULT_CUPS_PORT), 10),
  defaultPrinter: process.env.MCP_CUPS_DEFAULT_PRINTER || "",
  maxCopies: parseInt(process.env.MCP_CUPS_MAX_COPIES || String(DEFAULT_MAX_COPIES), 10),
  httpHost: process.env.MCP_CUPS_HTTP_HOST || DEFAULT_HTTP_HOST,
  httpPort: parseInt(process.env.MCP_CUPS_HTTP_PORT || String(DEFAULT_HTTP_PORT), 10),
  transport: (process.env.MCP_CUPS_TRANSPORT || "http") as "http" | "stdio",
}
