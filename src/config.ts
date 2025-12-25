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
}

const DEFAULT_CUPS_PORT = 631
const DEFAULT_MAX_COPIES = 10

/**
 * Global configuration loaded from environment variables.
 */
export const config: Config = {
  cupsServer: process.env.MCP_CUPS_SERVER || "",
  cupsPort: parseInt(process.env.MCP_CUPS_PORT || String(DEFAULT_CUPS_PORT), 10),
  defaultPrinter: process.env.MCP_CUPS_DEFAULT_PRINTER || "",
  maxCopies: parseInt(process.env.MCP_CUPS_MAX_COPIES || String(DEFAULT_MAX_COPIES), 10),
}
