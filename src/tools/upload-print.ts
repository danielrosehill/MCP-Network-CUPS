/**
 * @fileoverview Upload and print tool registration.
 * Registers upload_and_print tool for remote clients to send files to the print server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from "fs"
import { join, extname } from "path"
import { tmpdir } from "os"
import { config } from "../config.js"
import {
  executePrintJob,
  getPdfPageCount,
  calculatePhysicalSheets,
  shouldTriggerConfirmation,
  isDuplexEnabled,
  cleanupRenderedPdf,
} from "../utils.js"
import { prepareUploadedFileForPrinting } from "../file-security.js"
import { ERROR_CODES } from "./batch-helpers.js"

/**
 * Result of an upload and print operation.
 */
interface UploadPrintResult {
  success: boolean
  filename: string
  message: string
  error?: string
  renderType?: string
}

/**
 * Validates that a file extension is not blocked for uploads.
 *
 * @param filename - Original filename to check
 * @throws {Error} If the extension is blocked
 */
function validateUploadExtension(filename: string): void {
  const ext = extname(filename).slice(1).toLowerCase()
  if (config.upload.blockedExtensions.includes(ext)) {
    throw new Error(
      `File extension '.${ext}' is blocked for security reasons. ` +
        `Blocked extensions: ${config.upload.blockedExtensions.join(", ")}`
    )
  }
}

/**
 * Validates that the content size doesn't exceed the maximum upload size.
 *
 * @param content - Base64 or UTF-8 content string
 * @param encoding - Content encoding
 * @throws {Error} If the content exceeds the maximum size
 */
function validateUploadSize(content: string, encoding: "base64" | "utf8"): void {
  // Calculate approximate byte size
  let byteSize: number
  if (encoding === "base64") {
    // Base64 encoding increases size by ~33%, so decoded size is ~75% of encoded
    byteSize = Math.ceil((content.length * 3) / 4)
  } else {
    // UTF-8 can be multi-byte, estimate conservatively
    byteSize = Buffer.byteLength(content, "utf-8")
  }

  if (byteSize > config.upload.maxSize) {
    const maxMB = Math.round(config.upload.maxSize / 1024 / 1024)
    const sizeMB = Math.round(byteSize / 1024 / 1024)
    throw new Error(
      `Upload size (${sizeMB}MB) exceeds maximum allowed (${maxMB}MB). ` +
        `Configure MCP_PRINTER_MAX_UPLOAD_SIZE to increase the limit.`
    )
  }
}

/**
 * Saves uploaded content to a temporary file.
 *
 * @param filename - Original filename (for extension)
 * @param content - File content
 * @param encoding - Content encoding
 * @returns Object with temp directory and file paths
 */
function saveUploadedFile(
  filename: string,
  content: string,
  encoding: "base64" | "utf8"
): { tmpDir: string; tmpFile: string } {
  const ext = extname(filename) || ".txt"
  const tmpDir = mkdtempSync(join(tmpdir(), "mcp-upload-"))
  const tmpFile = join(tmpDir, `upload${ext}`)

  if (encoding === "base64") {
    const buffer = Buffer.from(content, "base64")
    writeFileSync(tmpFile, buffer)
  } else {
    writeFileSync(tmpFile, content, "utf-8")
  }

  return { tmpDir, tmpFile }
}

/**
 * Cleans up temporary upload directory.
 *
 * @param tmpDir - Temporary directory path
 * @param tmpFile - Temporary file path
 */
function cleanupUpload(tmpDir: string, tmpFile: string): void {
  try {
    unlinkSync(tmpFile)
  } catch {
    // Ignore
  }
  try {
    rmdirSync(tmpDir)
  } catch {
    // Ignore
  }
}

/**
 * Registers the upload_and_print tool with the MCP server.
 * Allows remote clients to upload file content and print it.
 *
 * @param server - The McpServer instance to register the tool with
 */
export function registerUploadPrintTools(server: McpServer) {
  server.registerTool(
    "upload_and_print",
    {
      title: "Upload and Print",
      description:
        "Upload file content from your local machine and print it. " +
        "Use this when the file is on your local machine and needs to be sent to the print server. " +
        "Supports text files, markdown, code files, and PDFs.",
      inputSchema: {
        filename: z
          .string()
          .describe("Original filename with extension (e.g., 'document.md', 'report.pdf')"),
        content: z.string().describe("File content, either base64-encoded or plain text (UTF-8)"),
        encoding: z
          .enum(["base64", "utf8"])
          .default("base64")
          .describe("Content encoding: 'base64' for binary files, 'utf8' for text files"),
        printer: z
          .string()
          .optional()
          .describe(
            "Printer name (use list_printers to see available printers). Optional if default printer is set."
          ),
        copies: z
          .number()
          .min(1)
          .optional()
          .default(1)
          .describe("Number of copies to print (default: 1)"),
        options: z
          .string()
          .optional()
          .describe(
            "Additional CUPS options (e.g., 'landscape', 'sides=two-sided-long-edge')"
          ),
        skip_confirmation: z
          .boolean()
          .optional()
          .describe(
            "Skip page count confirmation check (bypasses MCP_PRINTER_CONFIRM_IF_OVER_PAGES threshold)"
          ),
        line_numbers: z
          .boolean()
          .optional()
          .describe("Show line numbers when rendering code files (overrides global setting)"),
        color_scheme: z
          .string()
          .optional()
          .describe(
            "Syntax highlighting color scheme for code files (e.g., 'github', 'monokai', 'atom-one-light')"
          ),
        font_size: z
          .string()
          .optional()
          .describe("Font size for code files (e.g., '8pt', '10pt', '12pt')"),
        line_spacing: z
          .string()
          .optional()
          .describe("Line spacing for code files (e.g., '1', '1.5', '2')"),
        force_markdown_render: z
          .boolean()
          .optional()
          .describe(
            "Force markdown rendering to PDF (true=always render, false=never render, undefined=use config)"
          ),
        force_code_render: z
          .boolean()
          .optional()
          .describe(
            "Force code rendering to PDF with syntax highlighting (true=always render, false=never render, undefined=use config)"
          ),
      },
    },
    async ({
      filename,
      content,
      encoding,
      printer,
      copies = 1,
      options,
      skip_confirmation,
      line_numbers,
      color_scheme,
      font_size,
      line_spacing,
      force_markdown_render,
      force_code_render,
    }) => {
      let tmpDir: string | null = null
      let tmpFile: string | null = null
      let renderedPdf: string | null = null

      try {
        // Validate upload
        validateUploadExtension(filename)
        validateUploadSize(content, encoding)

        // Save to temp file
        const saved = saveUploadedFile(filename, content, encoding)
        tmpDir = saved.tmpDir
        tmpFile = saved.tmpFile

        // Prepare file for printing (handles rendering)
        const { actualFilePath, renderedPdf: rendered, renderType } =
          await prepareUploadedFileForPrinting({
            filePath: tmpFile,
            lineNumbers: line_numbers,
            colorScheme: color_scheme,
            fontSize: font_size,
            lineSpacing: line_spacing,
            forceMarkdownRender: force_markdown_render,
            forceCodeRender: force_code_render,
          })
        renderedPdf = rendered

        // Check page count confirmation threshold
        if (!skip_confirmation && config.confirmIfOverPages > 0) {
          try {
            const pdfPages = await getPdfPageCount(actualFilePath)
            const isDuplex = isDuplexEnabled(options)
            const physicalSheets = calculatePhysicalSheets(pdfPages, isDuplex)

            if (shouldTriggerConfirmation(physicalSheets)) {
              // Clean up temp files before returning
              cleanupRenderedPdf(renderedPdf)
              cleanupUpload(tmpDir, tmpFile)

              return {
                content: [
                  {
                    type: "text",
                    text:
                      `⚠️ Confirmation required for: ${filename}\n\n` +
                      `This document has ${pdfPages} pages (${physicalSheets} sheets${isDuplex ? ", duplex" : ""}).\n` +
                      `This exceeds the configured threshold of ${config.confirmIfOverPages} sheets.\n\n` +
                      `To proceed, call upload_and_print again with skip_confirmation: true`,
                  },
                ],
              }
            }
          } catch {
            // Not a PDF or failed to parse - continue with print
          }
        }

        // Execute print job
        const { printerName } = await executePrintJob(actualFilePath, printer, copies, options)

        const copiesInfo = copies > 1 ? ` × ${copies} copies` : ""
        const renderInfo = renderType ? ` (rendered: ${renderType})` : ""

        // Clean up
        cleanupRenderedPdf(renderedPdf)
        cleanupUpload(tmpDir, tmpFile)

        return {
          content: [
            {
              type: "text",
              text:
                `✓ ${filename}\n` +
                `  Printed to ${printerName}${copiesInfo}${renderInfo}\n` +
                `  (uploaded from remote client)`,
            },
          ],
        }
      } catch (error) {
        // Clean up on error
        if (renderedPdf) cleanupRenderedPdf(renderedPdf)
        if (tmpDir && tmpFile) cleanupUpload(tmpDir, tmpFile)

        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [
            {
              type: "text",
              text: `✗ ${filename}\n  Failed to upload and print: ${message}`,
            },
          ],
        }
      }
    }
  )
}
