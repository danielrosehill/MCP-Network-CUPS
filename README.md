# MCP CUPS

![MCP CUPS](images/1.png)

An MCP server for printing to CUPS network printers. Discover printers on a network print server, add them to your local system, and send print jobs directly from Claude Code or other MCP clients.

## Use Cases

**1. Printer Discovery & Setup**
> "I just set up my laptop on the network. There's a print server somewhere - help me find the printers and add them."

**2. Print from Context**
> "There's a PDF in this repo - print it on the laser printer."

## Installation

```bash
npm install -g mcp-cups
```

Or run directly:
```bash
npx mcp-cups
```

## Configuration

Add to your Claude Code MCP settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "cups": {
      "command": "npx",
      "args": ["mcp-cups"],
      "env": {
        "MCP_CUPS_SERVER": "print-server.local"
      }
    }
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_CUPS_SERVER` | _(none)_ | CUPS server hostname or IP |
| `MCP_CUPS_PORT` | `631` | CUPS server port |
| `MCP_CUPS_DEFAULT_PRINTER` | _(none)_ | Default printer name |
| `MCP_CUPS_MAX_COPIES` | `10` | Max copies per job (0=unlimited) |

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
- Or run the MCP with appropriate permissions

**Printer not accepting jobs**
- Check printer status on the server
- The printer may be paused or have errors

## License

MIT
