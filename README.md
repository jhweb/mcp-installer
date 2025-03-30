# mcp-installer - A MCP Server to install MCP Servers

This server is a server that installs other MCP servers for you. Install it, and you can ask Claude to install MCP servers hosted in npm or PyPi for you. Requires `npx` and `uv` to be installed for node and Python servers respectively.

![image](https://github.com/user-attachments/assets/d082e614-b4bc-485c-a7c5-f80680348793)

## Installation

### 1. Configuration Setup

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

### 2. Install the Command Line Tool

```bash
npm install -g @mcp/installer
```

## Command Line Usage

The `mcpctl` command provides a comprehensive set of tools for managing MCP servers.

### Basic Commands

```bash
# List all installed servers
mcpctl list

# Check server status
mcpctl status [server-name]    # Show status of specific server or all servers

# Server Control
mcpctl start <server-name>     # Start a server
mcpctl stop <server-name>      # Stop a server
mcpctl restart <server-name>   # Restart a server

# Monitoring
mcpctl logs <server-name>      # View server logs and process information
```

### Command Details

#### List Command
```bash
mcpctl list
```
Shows all installed MCP servers with their current status and PID (if running).

Output example:
```
Installed MCP Servers:
- browserbase (STOPPED)
- wordpress (RUNNING) [PID: 12345]
- filesystem (STOPPED)
```

#### Status Command
```bash
mcpctl status [server-name]
```
Displays detailed information about a server or all servers, including:
- Running status
- Health status
- Process ID (PID)
- Command configuration
- Resource usage (CPU and memory)

Output example:
```
Server: wordpress
Status: RUNNING
Health: OK (CPU: 2.1%, MEM: 1.4%)
PID: 12345
Command: node server.js
```

#### Start Command
```bash
mcpctl start <server-name>
```
Starts the specified server and displays its PID. The command will:
- Check if the server is already running
- Start the server in detached mode
- Store process information
- Perform initial health check

#### Stop Command
```bash
mcpctl stop <server-name>
```
Gracefully stops the specified server and cleans up process information.

#### Restart Command
```bash
mcpctl restart <server-name>
```
Performs a full server restart by:
1. Stopping the server
2. Waiting for cleanup
3. Starting the server again

#### Logs Command
```bash
mcpctl logs <server-name>
```
Shows process information and logs for the specified server.

### Example Usage

```bash
# Start the WordPress MCP server
mcpctl start wordpress

# Check its status
mcpctl status wordpress

# View its logs
mcpctl logs wordpress

# Restart if needed
mcpctl restart wordpress

# Stop when done
mcpctl stop wordpress
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

For development and contribution guidelines, please see our [Contributing Guide](CONTRIBUTING.md).

## License

MIT - see [COPYING](COPYING) for details.
