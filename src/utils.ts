/**
 * @fileoverview Utility functions for CUPS operations.
 */

import { execa } from "execa"
import { access } from "fs/promises"
import { constants } from "fs"
import { config } from "./config.js"

/**
 * Executes a command and returns stdout.
 *
 * @param command - The command to execute
 * @param args - Command arguments
 * @returns Trimmed stdout
 */
export async function execCommand(command: string, args: string[] = []): Promise<string> {
  try {
    const { stdout } = await execa(command, args)
    return stdout.trim()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Command failed: ${message}`)
  }
}

/**
 * Checks if a file exists.
 *
 * @param filePath - Path to check
 * @returns True if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Gets the CUPS server argument for lpstat/lp commands.
 * Returns ["-h", "server:port"] if configured, empty array otherwise.
 */
export function getCupsServerArgs(): string[] {
  if (!config.cupsServer) {
    return []
  }
  const serverAddr =
    config.cupsPort !== 631
      ? `${config.cupsServer}:${config.cupsPort}`
      : config.cupsServer
  return ["-h", serverAddr]
}

/**
 * Gets the configured CUPS server address for display.
 */
export function getCupsServerDisplay(): string {
  if (!config.cupsServer) {
    return "localhost (no MCP_CUPS_SERVER configured)"
  }
  return config.cupsPort !== 631
    ? `${config.cupsServer}:${config.cupsPort}`
    : config.cupsServer
}
