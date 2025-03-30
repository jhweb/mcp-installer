# mcp-installer - A MCP Server to install MCP Servers

This server is a server that installs other MCP servers for you. Install it, and you can ask Claude to install MCP servers hosted in npm or PyPi for you. Requires `npx` and `uv` to be installed for node and Python servers respectively.

![image](https://github.com/user-attachments/assets/d082e614-b4bc-485c-a7c5-f80680348793)

## Installation

### 1. Configuration Setup

#### Claude Desktop Configuration
Put this into your `claude_desktop_config.json` (either at `~/Library/Application Support/Claude` on macOS or `C:\Users\NAME\AppData\Roaming\Claude` on Windows):

```json
{
  "mcpServers": {
    "mcp-installer": {
      "command": "npx",
      "args": [
        "@anaisbetts/mcp-installer"
      ]
    }
  }
}
```

#### Cursor Configuration
Put this into your `~/.cursor/mcp.json` (this file will be created automatically when you use `mcpctl update-cursor-config`, but you can also create it manually):

```json
{
  "mcpServers": {
    "mcp-installer": {
      "command": "npx",
      "args": [
        "@anaisbetts/mcp-installer"
      ]
    }
  }
}
```

### 2. Install the Command Line Tool

```bash
npm install -g @mcp/installer

# After installation, update Cursor configuration:
mcpctl update-cursor-config mcp-installer
```

## Command Line Usage

The `mcpctl` command provides a comprehensive set of tools for managing MCP servers.

### Basic Commands

```bash
# List all installed servers
mcpctl list

# Check server status
mcpctl status [server-name]    # Show status of specific server or all servers
mcpctl status-all             # Show detailed status of all servers

# Server Control
mcpctl start <server-name>     # Start a server
mcpctl stop <server-name>      # Stop a server
mcpctl restart <server-name>   # Restart a server
mcpctl start-all              # Start all installed servers
mcpctl stop-all               # Stop all running servers

# Server Management
mcpctl clean-stopped-servers  # Remove stopped servers and their files
mcpctl update-cursor-config <server1,server2,...>  # Update Cursor config with specified servers
mcpctl update-cursor-config all-servers  # Update Cursor config with all installed servers
mcpctl update-claude-config <server1,server2,...>  # Update Claude Desktop config with specified servers
mcpctl update-claude-config all-servers  # Update Claude Desktop config with all installed servers

# Monitoring
mcpctl logs <server-name>      # View server logs and process information
```

### First Run Setup

On first run, the installer will ask for your preferences:

1. Installation Directory: Where to install all MCP servers
2. Port Configuration: Whether to ask for custom ports when installing new servers

These preferences are saved and remembered for future installations. You can update them anytime by editing:
- macOS: `~/Library/Application Support/Claude/mcp_preferences.json`
- Windows: `%APPDATA%\Claude\mcp_preferences.json`

### Server Installation

When installing a new server, the installer will:
1. Check if a server with the same name exists
2. If it exists and is stopped, ask if you want to overwrite it
3. If custom ports are enabled, ask for a port number
4. Install the server in your preferred installation directory
5. Automatically update both Claude Desktop and Cursor configurations

> Note: After installing new servers, you can sync them to your IDE configurations using:
> ```bash
> # For Cursor:
> mcpctl update-cursor-config server1,server2,...
> 
> # For Claude Desktop:
> mcpctl update-claude-config server1,server2,...
> ```
> This will update the respective configuration files with the server configurations.

### Example Usage

```bash
# Start all servers
mcpctl start-all

# Check status of all servers
mcpctl status-all

# Clean up stopped servers
mcpctl clean-stopped-servers

# Update IDE configurations with specific servers
mcpctl update-cursor-config browserbase,filesystem,hyperbrowser
mcpctl update-claude-config browserbase,filesystem,hyperbrowser

# Update IDE configurations with all installed servers
mcpctl update-cursor-config all-servers
mcpctl update-claude-config all-servers
```

### Example prompts for Claude

> Hey Claude, install the MCP server named mcp-server-fetch

> Hey Claude, install the @modelcontextprotocol/server-filesystem package as an MCP server. Use ['/Users/anibetts/Desktop'] for the arguments

> Hi Claude, please install the MCP server at /Users/anibetts/code/mcp-youtube, I'm too lazy to do it myself.

> Install the server @modelcontextprotocol/server-github. Set the environment variable GITHUB_PERSONAL_ACCESS_TOKEN to '1234567890'

## Troubleshooting

### Common Issues

1. **Server Won't Start**
   - Check if another instance is running (`mcpctl status`)
   - Verify the configuration in claude_desktop_config.json
   - Check system logs for errors

2. **Command Not Found**
   - Ensure the package is installed globally (`npm install -g @mcp/installer`)
   - Verify the installation path is in your system PATH

3. **Process Management**
   - If a server shows as running but isn't responding, use `mcpctl restart`
   - For stuck processes, use `mcpctl stop` followed by `mcpctl start`

## Contributing

For development and contribution guidelines, please see our [Contributing Guide](CONTRIBUTING.md) and [Development Documentation](DEVDOC.md).

## License

MIT - see [COPYING](COPYING) for details.
