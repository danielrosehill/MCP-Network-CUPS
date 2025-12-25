/**
 * @fileoverview MCP tools for CUPS network printing.
 * Provides tools to discover, add, and print to network printers.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { execa } from "execa"
import { execCommand, fileExists, getCupsServerArgs, getCupsServerDisplay } from "./utils.js"
import { config } from "./config.js"

/**
 * Registers all MCP tools with the server.
 */
export function registerTools(server: McpServer) {
  // list_printers - List printers on the remote CUPS server
  server.registerTool(
    "list_printers",
    {
      title: "List Printers",
      description:
        "List all available printers on the CUPS server. Shows printer names, status, and whether they're accepting jobs.",
      inputSchema: {},
    },
    async () => {
      const serverArgs = getCupsServerArgs()
      const serverDisplay = getCupsServerDisplay()

      try {
        // Get printer list and status
        const output = await execCommand("lpstat", [...serverArgs, "-p", "-d"])

        return {
          content: [
            {
              type: "text",
              text: `Printers on ${serverDisplay}:\n\n${output || "No printers found"}`,
            },
          ],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [
            {
              type: "text",
              text: `Failed to list printers on ${serverDisplay}: ${message}`,
            },
          ],
        }
      }
    }
  )

  // print_file - Print a local file to a printer on the CUPS server
  server.registerTool(
    "print_file",
    {
      title: "Print File",
      description:
        "Print a local file to a printer on the CUPS server. Supports PDF, text, images, and other formats that CUPS can handle.",
      inputSchema: {
        file_path: z.string().describe("Path to the file to print"),
        printer: z
          .string()
          .optional()
          .describe("Printer name (use list_printers to see available). Uses default if not specified."),
        copies: z
          .number()
          .min(1)
          .optional()
          .default(1)
          .describe("Number of copies (default: 1)"),
        options: z
          .string()
          .optional()
          .describe("CUPS options (e.g., 'landscape', 'sides=two-sided-long-edge', 'media=A4')"),
      },
    },
    async ({ file_path, printer, copies = 1, options }) => {
      // Check file exists
      if (!(await fileExists(file_path))) {
        return {
          content: [
            {
              type: "text",
              text: `File not found: ${file_path}`,
            },
          ],
        }
      }

      // Validate copies
      if (config.maxCopies > 0 && copies > config.maxCopies) {
        return {
          content: [
            {
              type: "text",
              text: `Copy count (${copies}) exceeds maximum (${config.maxCopies}). Set MCP_CUPS_MAX_COPIES to increase.`,
            },
          ],
        }
      }

      const serverArgs = getCupsServerArgs()
      const args: string[] = [...serverArgs]

      // Printer selection
      const targetPrinter = printer || config.defaultPrinter
      if (targetPrinter) {
        args.push("-P", targetPrinter)
      }

      // Copies
      if (copies > 1) {
        args.push("-#", String(copies))
      }

      // Options
      if (options) {
        for (const opt of options.split(/\s+/)) {
          args.push("-o", opt)
        }
      }

      // File path
      args.push(file_path)

      try {
        await execa("lpr", args)

        const printerDisplay = targetPrinter || "default printer"
        const copiesInfo = copies > 1 ? ` (${copies} copies)` : ""
        const optionsInfo = options ? `\n  Options: ${options}` : ""

        return {
          content: [
            {
              type: "text",
              text: `✓ Sent to ${printerDisplay}${copiesInfo}\n  File: ${file_path}${optionsInfo}`,
            },
          ],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [
            {
              type: "text",
              text: `Failed to print: ${message}`,
            },
          ],
        }
      }
    }
  )

  // add_printer - Add a network printer to the local system
  server.registerTool(
    "add_printer",
    {
      title: "Add Printer",
      description:
        "Add a network printer from the CUPS server to the local system. This makes the printer available for regular printing from any application.",
      inputSchema: {
        printer_name: z.string().describe("Name of the printer on the remote CUPS server"),
        local_name: z
          .string()
          .optional()
          .describe("Local name for the printer (defaults to remote name)"),
        set_default: z
          .boolean()
          .optional()
          .default(false)
          .describe("Set this printer as the system default"),
      },
    },
    async ({ printer_name, local_name, set_default = false }) => {
      if (!config.cupsServer) {
        return {
          content: [
            {
              type: "text",
              text: "Cannot add printer: MCP_CUPS_SERVER is not configured. Set the environment variable to your CUPS server address.",
            },
          ],
        }
      }

      const localPrinterName = local_name || printer_name
      const serverAddr =
        config.cupsPort !== 631
          ? `${config.cupsServer}:${config.cupsPort}`
          : config.cupsServer

      // Build the IPP URI for the remote printer
      const printerUri = `ipp://${serverAddr}/printers/${printer_name}`

      try {
        // Add the printer using lpadmin
        // -p: printer name
        // -E: enable and accept jobs
        // -v: device URI
        // -m: use everywhere driver (driverless printing)
        await execa("lpadmin", [
          "-p", localPrinterName,
          "-E",
          "-v", printerUri,
          "-m", "everywhere",
        ])

        let message = `✓ Added printer "${localPrinterName}"\n  URI: ${printerUri}`

        // Set as default if requested
        if (set_default) {
          try {
            await execa("lpoptions", ["-d", localPrinterName])
            message += `\n  Set as default printer`
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error)
            message += `\n  Warning: Could not set as default: ${errMsg}`
          }
        }

        return {
          content: [
            {
              type: "text",
              text: message,
            },
          ],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        // Check for common errors
        if (message.includes("Permission denied") || message.includes("not authorized")) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to add printer: Permission denied.\n\nTo add printers, you may need to:\n1. Run with sudo, or\n2. Add your user to the 'lpadmin' group: sudo usermod -aG lpadmin $USER`,
              },
            ],
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `Failed to add printer: ${message}`,
            },
          ],
        }
      }
    }
  )
}
