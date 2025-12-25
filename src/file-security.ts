/**
 * @fileoverview File path security validation and access control.
 * Enforces allowlist/denylist rules and blocks access to dotfiles and sensitive directories.
 * Also provides utilities for handling uploaded files (which skip path validation).
 */

import { realpathSync } from "fs"
import { resolve, sep, extname } from "path"
import { config, MARKDOWN_EXTENSIONS, type MarkdownExtension } from "./config.js"
import { renderMarkdownToPdf } from "./renderers/markdown.js"
import { renderCodeToPdf, shouldRenderCode } from "./renderers/code.js"

/**
 * Check if a path contains any dotfile or dotdir component.
 * Returns true if any path component starts with a dot (except "." and "..").
 * This is a security measure to prevent access to hidden files and credential stores.
 *
 * @param filePath - The path to check
 * @returns True if path contains dotfile/dotdir
 */
function pathContainsDotfile(filePath: string): boolean {
  const components = filePath.split(sep)
  return components.some(
    (component) => component.startsWith(".") && component !== "." && component !== ".."
  )
}

/**
 * Validates that a file path is allowed to be accessed based on security configuration.
 * Resolves symlinks and checks against allowlist and denylist.
 *
 * @param filePath - The file path to validate
 * @throws {Error} If the file path is not allowed with a descriptive message
 */
export function validateFilePath(filePath: string): void {
  // Resolve to absolute path and follow symlinks
  const originalAbsolutePath = resolve(filePath)
  let absolutePath: string
  try {
    absolutePath = realpathSync(originalAbsolutePath)
  } catch {
    // If file doesn't exist yet or can't be resolved, use resolved path without following symlinks
    absolutePath = originalAbsolutePath
  }

  // Check for dotfiles/dotdirs in BOTH original and resolved paths (security layer - no override)
  if (pathContainsDotfile(originalAbsolutePath)) {
    throw new Error(
      `Access denied: Dotfiles and hidden directories cannot be printed for security reasons. ` +
        `Path "${filePath}" contains hidden components.`
    )
  }

  if (pathContainsDotfile(absolutePath) && absolutePath !== originalAbsolutePath) {
    throw new Error(
      `Access denied: Dotfiles and hidden directories cannot be printed for security reasons. ` +
        `Path "${filePath}" resolves to a hidden file or directory.`
    )
  }

  // Check if file or any of its parent directories match denied paths
  for (const deniedPath of config.deniedPaths) {
    const resolvedDeniedPath = resolve(deniedPath)
    if (absolutePath.startsWith(resolvedDeniedPath + sep) || absolutePath === resolvedDeniedPath) {
      throw new Error(
        `Access denied: File path "${filePath}" is in a restricted directory (${deniedPath}). ` +
          `This path is blocked for security reasons.`
      )
    }
  }

  // Check if file is under at least one allowed path
  let isAllowed = false
  for (const allowedPath of config.allowedPaths) {
    const resolvedAllowedPath = resolve(allowedPath)
    if (
      absolutePath.startsWith(resolvedAllowedPath + sep) ||
      absolutePath === resolvedAllowedPath
    ) {
      isAllowed = true
      break
    }
  }

  if (!isAllowed) {
    throw new Error(
      `Access denied: File is outside allowed directories. ` +
        `Configure MCP_PRINTER_ALLOWED_PATHS to grant access to additional paths. ` +
        `Default allowed: ~/Documents, ~/Downloads, ~/Desktop.`
    )
  }
}

/**
 * Result of file rendering operation for uploaded files.
 */
export interface UploadRenderResult {
  /** Path to the file to use (either original or rendered PDF) */
  actualFilePath: string
  /** Path to rendered PDF temp file (null if no rendering occurred) */
  renderedPdf: string | null
  /** Description of rendering performed (empty string if no rendering) */
  renderType: string
}

/**
 * Options for uploaded file rendering.
 */
export interface UploadRenderOptions {
  /** Path to the uploaded temp file */
  filePath: string
  /** Show line numbers when rendering code files */
  lineNumbers?: boolean
  /** Syntax highlighting color scheme for code files */
  colorScheme?: string
  /** Font size for code files */
  fontSize?: string
  /** Line spacing for code files */
  lineSpacing?: string
  /** Force markdown rendering to PDF */
  forceMarkdownRender?: boolean
  /** Force code rendering to PDF with syntax highlighting */
  forceCodeRender?: boolean
}

/**
 * Check if a file should be rendered as markdown based on its extension.
 *
 * @param filePath - Path to the file
 * @returns True if the file should be rendered as markdown
 */
function shouldRenderMarkdown(filePath: string): boolean {
  if (!config.autoRenderMarkdown) {
    return false
  }
  const ext = extname(filePath).slice(1).toLowerCase()
  return MARKDOWN_EXTENSIONS.includes(ext as MarkdownExtension)
}

/**
 * Prepares an uploaded file for printing by conditionally rendering it to PDF.
 *
 * This function is similar to prepareFileForPrinting in utils.ts but:
 * - SKIPS path security validation (uploaded files come from trusted temp directory)
 * - Handles rendering in the same way as regular files
 *
 * Use this function for files uploaded via the upload_and_print tool.
 *
 * @param options - File preparation options including path and rendering preferences
 * @returns Promise resolving to an UploadRenderResult object
 * @throws {Error} If rendering fails and fallback is disabled
 */
export async function prepareUploadedFileForPrinting(
  options: UploadRenderOptions
): Promise<UploadRenderResult> {
  // NOTE: No validateFilePath() call here - uploaded files are in trusted temp directory

  let actualFilePath = options.filePath
  let renderedPdf: string | null = null
  let renderType = ""

  // Check if file should be auto-rendered to PDF (markdown)
  const shouldRenderAsMarkdown =
    options.forceMarkdownRender !== undefined
      ? options.forceMarkdownRender &&
        MARKDOWN_EXTENSIONS.some((ext) => options.filePath.toLowerCase().endsWith(`.${ext}`))
      : shouldRenderMarkdown(options.filePath)

  if (shouldRenderAsMarkdown) {
    try {
      renderedPdf = await renderMarkdownToPdf(options.filePath)
      actualFilePath = renderedPdf
      renderType = "markdown → PDF"
    } catch (error) {
      // If fallback is enabled, use original file; otherwise throw error
      if (config.fallbackOnRenderError) {
        console.error(`Warning: Failed to render ${options.filePath}, using as-is:`, error)
      } else {
        throw error
      }
    }
  }
  // Check if file should be rendered as code with syntax highlighting
  else if (
    options.forceCodeRender !== undefined
      ? options.forceCodeRender
      : await shouldRenderCode(options.filePath)
  ) {
    try {
      renderedPdf = await renderCodeToPdf(options.filePath, {
        lineNumbers: options.lineNumbers,
        colorScheme: options.colorScheme,
        fontSize: options.fontSize,
        lineSpacing: options.lineSpacing,
      })
      actualFilePath = renderedPdf
      renderType = "code → PDF (syntax highlighted)"
    } catch (error) {
      // If fallback is enabled, use original file; otherwise throw error
      if (config.fallbackOnRenderError) {
        console.error(`Warning: Failed to render code ${options.filePath}, using as-is:`, error)
      } else {
        throw error
      }
    }
  }

  return { actualFilePath, renderedPdf, renderType }
}
