# LAN MCP CUPS

![LAN MCP CUPS](images/1.png)

An MCP server for printing to CUPS network printers via **streamable HTTP**. Discover printers on a network print server, add them to your local system, and send print jobs directly from Claude Code or other MCP clients.

## Transport Modes

- **HTTP** (default): Runs as an HTTP server at `http://127.0.0.1:3000/mcp`
- **Stdio** (legacy): For clients that spawn the process directly

## Use Cases

**1. Printer Discovery & Setup**
> "I just set up my laptop on the network. There's a print server somewhere - help me find the printers and add them."

**2. Print from Context**
> "There's a PDF in this repo - print it on the laser printer."

## Installation

### Using npx (Recommended)

The easiest way to use LAN MCP CUPS is via `npx`, which runs the package directly without global installation:

```bash
npx lan-mcp-cups
```

With a CUPS server configured:

```bash
MCP_CUPS_SERVER=print-server.local npx lan-mcp-cups
```

### Using npm

For a permanent global installation:

```bash
npm install -g lan-mcp-cups
```

Then run:

```bash
lan-mcp-cups
```

Or with environment variable:

```bash
MCP_CUPS_SERVER=print-server.local lan-mcp-cups
```

## Claude Code Configuration

### Streamable HTTP (Recommended)

Start the server first:

```bash
MCP_CUPS_SERVER=print-server.local npx lan-mcp-cups
```

Then add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "cups": {
      "url": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

### Stdio Mode (Legacy)

For clients that don't support HTTP transport:

```json
{
  "mcpServers": {
    "cups": {
      "command": "npx",
      "args": ["lan-mcp-cups"],
      "env": {
        "MCP_CUPS_SERVER": "print-server.local",
        "MCP_CUPS_TRANSPORT": "stdio"
      }
    }
  }
}
```

Replace `print-server.local` with your CUPS server hostname or IP address.

## Environment Variables

### CUPS Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_CUPS_SERVER` | _(none)_ | CUPS server hostname or IP (required for network printing) |
| `MCP_CUPS_PORT` | `631` | CUPS server port |
| `MCP_CUPS_DEFAULT_PRINTER` | _(none)_ | Default printer name |
| `MCP_CUPS_MAX_COPIES` | `10` | Maximum copies per job (0 = unlimited) |

### Transport Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_CUPS_TRANSPORT` | `http` | Transport mode: `http` or `stdio` |
| `MCP_CUPS_HTTP_HOST` | `127.0.0.1` | HTTP server bind address |
| `MCP_CUPS_HTTP_PORT` | `3000` | HTTP server port |

## Tools

### `list_printers`

List all printers available on the CUPS server.

```
User: What printers are available?
AI: [calls list_printers]

Printers on print-server.local:

printer HP_LaserJet is idle.
printer Brother_Color is idle.
system default destination: HP_LaserJet
```

### `print_file`

Print a local file to a printer on the CUPS server.

**Parameters:**
- `file_path` (required) - Path to the file to print
- `printer` (optional) - Printer name
- `copies` (optional) - Number of copies
- `options` (optional) - CUPS options like `landscape`, `sides=two-sided-long-edge`

```
User: Print the README.pdf on the laser printer
AI: [calls print_file with file_path="README.pdf", printer="HP_LaserJet"]

✓ Sent to HP_LaserJet
  File: README.pdf
```

### `add_printer`

Add a network printer from the CUPS server to your local system. Makes it available for regular printing from any application.

**Parameters:**
- `printer_name` (required) - Name of the printer on the remote server
- `local_name` (optional) - Local name for the printer
- `set_default` (optional) - Set as system default

```
User: Add the Brother printer and make it my default
AI: [calls add_printer with printer_name="Brother_Color", set_default=true]

✓ Added printer "Brother_Color"
  URI: ipp://print-server.local/printers/Brother_Color
  Set as default printer
```

## Common CUPS Options

Pass these in the `options` parameter:

- `landscape` - Landscape orientation
- `sides=two-sided-long-edge` - Duplex (long edge binding)
- `sides=two-sided-short-edge` - Duplex (short edge binding)
- `media=A4` or `media=Letter` - Paper size
- `page-ranges=1-5` - Print specific pages
- `fit-to-page` - Scale to fit
- `number-up=2` - Multiple pages per sheet

## Requirements

- Linux or macOS with CUPS installed
- Network access to a CUPS print server
- Node.js 18+

## Troubleshooting

**"No printers found"**
- Check `MCP_CUPS_SERVER` is set correctly
- Verify the server is reachable: `lpstat -h print-server.local -p`

**"Permission denied" when adding printers**
- Add your user to the lpadmin group: `sudo usermod -aG lpadmin $USER`
- Log out and back in for group changes to take effect

**Printer not accepting jobs**
- Check printer status on the server
- The printer may be paused or have errors

## License

MIT

## Author

Daniel Rosehill
