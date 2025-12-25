# MCP CUPS Network Printers

An MCP server for network printing via CUPS. Deploy on a print server to give AI assistants remote access to network printers. Supports file uploads from clients, SSE transport for remote connections, and full CUPS printer management.

> **Fork Note:** This is a fork of [mcp-printer](https://github.com/steveclarke/mcp-printer) by Stephen Clarke, adapted for network/remote printing scenarios. The original project focuses on local printing; this fork adds SSE transport and file upload capabilities for centralized print servers.

## Architecture

```
┌─────────────────┐         ┌─────────────────────────────────────┐
│  Client Desktop │         │          Print Server               │
│                 │         │                                     │
│  ┌───────────┐  │  HTTP   │  ┌─────────────────┐                │
│  │ Claude    │  │  SSE    │  │ MCP CUPS        │                │
│  │ Desktop   │──┼────────►│  │ Network Printers│                │
│  │ or other  │  │         │  └────────┬────────┘                │
│  │ MCP client│  │         │           │                         │
│  └───────────┘  │         │           ▼                         │
│                 │         │  ┌─────────────────┐    ┌─────────┐ │
│  Files on your  │ upload  │  │      CUPS       │───►│ Network │ │
│  local machine ─┼────────►│  │                 │    │ Printer │ │
│                 │         │  └─────────────────┘    └─────────┘ │
└─────────────────┘         └─────────────────────────────────────┘
```

**Key Difference from Original mcp-printer:**

| Aspect | mcp-printer (original) | mcp-cups-network-printers (this fork) |
|--------|------------------------|---------------------------------------|
| Where MCP runs | Local machine | Remote print server |
| Transport | stdio only | stdio + SSE (HTTP) |
| File source | Local filesystem | Uploaded from client OR server paths |
| Use case | Personal local printing | Shared network print service |

## Features

- **Remote Printing** - Connect from any MCP client on the network via SSE
- **File Upload** - Send files from your local machine to the print server
- **Server-side Files** - Print files already on the server
- **Beautiful Rendering** - Markdown and code files rendered to PDF with syntax highlighting
- **Mermaid Diagrams** - Flowcharts and diagrams render as graphics
- **Printer Management** - List printers, check queues, cancel jobs
- **CUPS Integration** - Full access to CUPS options (duplex, landscape, etc.)

## Quick Start

### On the Print Server

```bash
# Start with SSE transport (for remote access)
MCP_PRINTER_TRANSPORT=sse MCP_PRINTER_PORT=3847 npx mcp-cups-network-printers
```

The server will start and display:
```
MCP CUPS Network Printers starting on linux...
Transport mode: sse
MCP CUPS Network Printer Server running on http://0.0.0.0:3847
SSE endpoint: http://0.0.0.0:3847/sse
```

### On Your Client

Configure your MCP client (Claude Desktop, Cursor, etc.) to connect to the server:

```json
{
  "mcpServers": {
    "NetworkPrinter": {
      "transport": "sse",
      "url": "http://print-server:3847/sse"
    }
  }
}
```

Or with MetaMCP, add the SSE endpoint URL directly.

## Installation

### npm (recommended for servers)

```bash
npm install -g mcp-cups-network-printers
```

Then run:
```bash
MCP_PRINTER_TRANSPORT=sse mcp-cups-network-printers
```

### npx (quick testing)

```bash
MCP_PRINTER_TRANSPORT=sse npx mcp-cups-network-printers
```

### From source

```bash
git clone https://github.com/danielrosehill/mcp-cups-network-printers.git
cd mcp-cups-network-printers
pnpm install
pnpm run build
MCP_PRINTER_TRANSPORT=sse node dist/index.js
```

## Configuration

All configuration is via environment variables:

### Network/Transport Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_PRINTER_TRANSPORT` | `stdio` | Transport mode: `stdio` or `sse` |
| `MCP_PRINTER_PORT` | `3847` | HTTP port for SSE transport |
| `MCP_PRINTER_HOST` | `0.0.0.0` | Bind address for HTTP server |

### Upload Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_PRINTER_MAX_UPLOAD_SIZE` | `52428800` (50MB) | Maximum upload size in bytes |
| `MCP_PRINTER_BLOCKED_EXTENSIONS` | `exe,sh,bat,cmd,ps1,vbs,js,msi,dll,so` | Blocked file extensions for uploads |

### Printing Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_PRINTER_DEFAULT_PRINTER` | _(none)_ | Default printer name |
| `MCP_PRINTER_AUTO_DUPLEX` | `false` | Enable duplex by default |
| `MCP_PRINTER_DEFAULT_OPTIONS` | _(none)_ | Default CUPS options |
| `MCP_PRINTER_MAX_COPIES` | `10` | Maximum copies per job |
| `MCP_PRINTER_CONFIRM_IF_OVER_PAGES` | `10` | Confirm if exceeds this many sheets |

### Rendering Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_PRINTER_CHROME_PATH` | _(auto)_ | Path to Chrome/Chromium |
| `MCP_PRINTER_AUTO_RENDER_MARKDOWN` | `true` | Render markdown to PDF |
| `MCP_PRINTER_AUTO_RENDER_CODE` | `true` | Render code with syntax highlighting |
| `MCP_PRINTER_CODE_COLOR_SCHEME` | `atom-one-light` | Code highlighting theme |
| `MCP_PRINTER_CODE_FONT_SIZE` | `10pt` | Code font size |

### Security Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_PRINTER_ALLOWED_PATHS` | `~/Documents:~/Downloads:~/Desktop` | Allowed paths for server-side files |
| `MCP_PRINTER_DENIED_PATHS` | _(system dirs)_ | Additional denied paths |
| `MCP_PRINTER_ENABLE_MANAGEMENT` | `false` | Enable set_default_printer, cancel jobs |

## Available Tools

### `upload_and_print`

Upload file content from your local machine and print it. This is the primary tool for remote clients.

**Parameters:**
- `filename` (required) - Original filename with extension
- `content` (required) - File content (base64 or UTF-8)
- `encoding` (optional) - `base64` (default) or `utf8`
- `printer` (optional) - Printer name
- `copies` (optional) - Number of copies
- `options` (optional) - CUPS options

**Example:**
```
User: Print this markdown file on the network printer
AI: [reads file, encodes as base64, calls upload_and_print]
✓ document.md
  Printed to HP_LaserJet (rendered: markdown → PDF)
  (uploaded from remote client)
```

### `print_file`

Print files already on the server. Supports batch operations.

**Parameters:**
- `files` (required) - Array of file specifications:
  - `file_path` - Server path to file
  - `printer`, `copies`, `options` - Print settings
  - Rendering options: `line_numbers`, `color_scheme`, etc.

### `list_printers`

List all available printers with status.

### `get_print_queue`

Check pending print jobs.

### `get_page_meta`

Get page count before printing (helps avoid surprises).

### `get_default_printer`

Get the system default printer.

### `cancel_print_job` (requires management enabled)

Cancel print jobs.

### `set_default_printer` (requires management enabled)

Set the default printer.

## Deployment

### Systemd Service

Create `/etc/systemd/system/mcp-cups-network.service`:

```ini
[Unit]
Description=MCP CUPS Network Printers
After=network.target cups.service

[Service]
Type=simple
User=printuser
Environment=MCP_PRINTER_TRANSPORT=sse
Environment=MCP_PRINTER_PORT=3847
Environment=MCP_PRINTER_DEFAULT_PRINTER=HP_LaserJet
ExecStart=/usr/bin/npx mcp-cups-network-printers
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mcp-cups-network
sudo systemctl start mcp-cups-network
```

### Docker

```dockerfile
FROM node:22-slim

# Install Chrome for PDF rendering
RUN apt-get update && apt-get install -y \
    chromium \
    cups-client \
    && rm -rf /var/lib/apt/lists/*

# Install the server
RUN npm install -g mcp-cups-network-printers

ENV MCP_PRINTER_TRANSPORT=sse
ENV MCP_PRINTER_PORT=3847
ENV MCP_PRINTER_CHROME_PATH=/usr/bin/chromium

EXPOSE 3847

CMD ["mcp-cups-network-printers"]
```

Run with:
```bash
docker build -t mcp-cups-network .
docker run -d -p 3847:3847 --name mcp-printer mcp-cups-network
```

**Note:** For Docker, you'll need to configure CUPS client to connect to your CUPS server, or mount the CUPS socket.

## Security Considerations

### Network Security

This server is designed for **trusted networks**. It does not include authentication. For production use:

1. **Firewall** - Only allow access from trusted IPs
2. **Reverse Proxy** - Use nginx/traefik with authentication
3. **VPN** - Run on a VPN network only

### Upload Security

- Maximum upload size is limited (default 50MB)
- Executable extensions are blocked
- Files are stored in secure temp directories and cleaned up after printing

### Server-side File Access

- Dotfiles and hidden directories are always blocked
- System directories are always blocked
- Configure `MCP_PRINTER_ALLOWED_PATHS` to restrict accessible directories

## CUPS Options

Common CUPS options for the `options` parameter:

- `landscape` - Landscape orientation
- `sides=two-sided-long-edge` - Duplex (long edge)
- `sides=two-sided-short-edge` - Duplex (short edge)
- `page-ranges=1-5` - Print specific pages
- `media=Letter` or `media=A4` - Paper size
- `fit-to-page` - Scale to fit
- `number-up=2` - Multiple pages per sheet

## Requirements

- **Linux** (or macOS) with CUPS
- **Node.js 22+**
- **Google Chrome or Chromium** - For PDF rendering
- Network printers configured in CUPS

## Troubleshooting

### "Connection refused"

1. Check the server is running: `systemctl status mcp-cups-network`
2. Verify the port is open: `curl http://server:3847/health`
3. Check firewall rules

### "Chrome not found"

Set `MCP_PRINTER_CHROME_PATH` to your Chrome/Chromium path:
```bash
MCP_PRINTER_CHROME_PATH=/usr/bin/chromium-browser
```

### "Printer not found"

Run `lpstat -p` on the server to see available printers.

### Upload fails

Check upload size limit with `MCP_PRINTER_MAX_UPLOAD_SIZE`.

## License

MIT

## Credits

- Original [mcp-printer](https://github.com/steveclarke/mcp-printer) by Stephen Clarke
- This fork by Daniel Rosehill
