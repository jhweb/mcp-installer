# MCP Installer Development Documentation

## Development Environment Setup

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)
- TypeScript knowledge
- Understanding of the Model Context Protocol (MCP)

### Initial Setup
1. Clone the repository:
```bash
git clone https://github.com/yourusername/mcp-installer.git
cd mcp-installer
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Install globally (for testing):
```bash
npm install -g .
```

## Project Structure

```
mcp-installer/
├── src/                    # Source code
│   ├── index.mts          # Main entry point
│   ├── bin/               # Command-line tools
│   │   └── mcp.mts       # mcpctl implementation
│   ├── server-manager.mts # Server management logic
│   └── types.mts         # TypeScript type definitions
├── lib/                   # Compiled JavaScript
├── conf/                  # Configuration files
├── tests/                # Test files
└── scripts/              # Build and utility scripts
```

## Configuration Files

### Server Configuration
- Location: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
- Location: `%APPDATA%\Claude\claude_desktop_config.json` (Windows)
- Format:
```json
{
  "mcpServers": {
    "server-name": {
      "command": "command-to-run",
      "args": ["array", "of", "arguments"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  }
}
```

### Preferences
- Location: `<installer-dir>/conf/mcp_preferences.json`
- Format:
```json
{
  "installationDir": "~/mcp-servers",
  "askForCustomPort": true,
  "lastUpdated": "ISO-date-string",
  "notifications": {
    "enabled": true,
    "maxHistory": 100,
    "types": ["install", "start", "stop", "error"]
  }
}
```

## Development Workflow

### Making Changes
1. Create a feature branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes in the `src` directory
3. Add tests in the `tests` directory
4. Build and test locally:
```bash
npm run build
npm test
```

### Testing Your Changes

#### Local Installation Testing
1. Uninstall the current global installation:
```bash
npm uninstall -g @mcp/installer
```

> Note: Uninstalling the MCP Installer package will NOT affect your running MCP servers or their data. The servers, their configurations, and process information are stored separately in:
> - Server files: `~/mcp-servers/` (or your custom installation directory)
> - Configurations: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)
> - Process information: Same directory as configurations

2. Build and reinstall:
```bash
npm run build && npm install -g .
```

3. Verify installation:
```bash
which mcpctl
mcpctl list
```

#### Testing Server Management
1. Test server installation:
```bash
mcpctl install @test/mcp-server
```

2. Test server operations:
```bash
mcpctl start test-server
mcpctl status test-server
mcpctl stop test-server
```

### Common Development Tasks

#### Adding a New Command
1. Add command handler in `src/bin/mcp.mts`
2. Add command to help text
3. Add any necessary methods to `ServerManager` class
4. Add tests for the new command
5. Update documentation

#### Modifying Server Management
1. Update `ServerManager` class in `src/server-manager.mts`
2. Add or modify tests in `tests/server-manager.test.ts`
3. Test with real servers
4. Update documentation

## Building for Production

1. Update version in `package.json`
2. Build the project:
```bash
npm run build
```

3. Run tests:
```bash
npm test
```

4. Create a git tag:
```bash
git tag -a v1.x.x -m "Version 1.x.x"
```

5. Push changes and tag:
```bash
git push origin main --tags
```

## Troubleshooting Development Issues

### Build Issues
- Clear the `lib` directory before rebuilding
- Check TypeScript version compatibility
- Verify all dependencies are installed

### Testing Issues
- Check test environment setup
- Verify mock data is correct
- Ensure test servers are properly configured

### Runtime Issues
- Enable debug logging
- Check process permissions
- Verify configuration file locations

## Contributing Guidelines

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Create detailed pull requests
5. Follow semantic versioning

For more details on contributing, see [CONTRIBUTING.md](CONTRIBUTING.md). 