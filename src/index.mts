#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { spawnPromise } from "spawn-rx";
import { ServerManager } from "./server-manager.mjs";

const serverManager = new ServerManager();

const server = new Server(
  {
    name: "mcp-installer",
    version: "0.5.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "install_repo_mcp_server",
        description: "Install an MCP server via npx or uvx",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The package name of the MCP server",
            },
            args: {
              type: "array",
              items: { type: "string" },
              description: "The arguments to pass along",
            },
            env: {
              type: "array",
              items: { type: "string" },
              description: "The environment variables to set, delimited by =",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "install_local_mcp_server",
        description:
          "Install an MCP server whose code is cloned locally on your computer",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "The path to the MCP server code cloned on your computer",
            },
            args: {
              type: "array",
              items: { type: "string" },
              description: "The arguments to pass along",
            },
            env: {
              type: "array",
              items: { type: "string" },
              description: "The environment variables to set, delimited by =",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "server_status",
        description: "Get detailed status of an MCP server",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The name of the server to check",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "server_start",
        description: "Start an MCP server",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The name of the server to start",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "server_stop",
        description: "Stop an MCP server",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The name of the server to stop",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "server_metrics",
        description: "Get detailed metrics for an MCP server",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The name of the server to get metrics for",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "server_health",
        description: "Check the health of an MCP server",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The name of the server to check health for",
            },
          },
          required: ["name"],
        },
      },
    ],
  };
});

async function hasNodeJs() {
  try {
    await spawnPromise("node", ["--version"]);
    return true;
  } catch (e) {
    return false;
  }
}

async function hasUvx() {
  try {
    await spawnPromise("uvx", ["--version"]);
    return true;
  } catch (e) {
    return false;
  }
}

async function isNpmPackage(name: string) {
  try {
    await spawnPromise("npm", ["view", name, "version"]);
    return true;
  } catch (e) {
    return false;
  }
}

function installToClaudeDesktop(
  name: string,
  cmd: string,
  args: string[],
  env?: string[]
) {
  const configPath =
    process.platform === "win32"
      ? path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Claude",
          "claude_desktop_config.json"
        )
      : path.join(
          os.homedir(),
          "Library",
          "Application Support",
          "Claude",
          "claude_desktop_config.json"
        );

  let config: any;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (e) {
    config = {};
  }

  const envObj = (env ?? []).reduce((acc, val) => {
    const [key, value] = val.split("=");
    acc[key] = value;

    return acc;
  }, {} as Record<string, string>);

  const newServer = {
    command: cmd,
    args: args,
    ...(env ? { env: envObj } : {}),
  };

  const mcpServers = config.mcpServers ?? {};
  mcpServers[name] = newServer;
  config.mcpServers = mcpServers;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function installRepoWithArgsToClaudeDesktop(
  name: string,
  npmIfTrueElseUvx: boolean,
  args?: string[],
  env?: string[]
) {
  // If the name is in a scoped package, we need to remove the scope
  const serverName = /^@.*\//i.test(name) ? name.split("/")[1] : name;

  installToClaudeDesktop(
    serverName,
    npmIfTrueElseUvx ? "npx" : "uvx",
    [name, ...(args ?? [])],
    env
  );
}

async function attemptNodeInstall(
  directory: string
): Promise<Record<string, string>> {
  await spawnPromise("npm", ["install"], { cwd: directory });

  // Run down package.json looking for bins
  const pkg = JSON.parse(
    fs.readFileSync(path.join(directory, "package.json"), "utf-8")
  );

  if (pkg.bin) {
    return Object.keys(pkg.bin).reduce((acc, key) => {
      acc[key] = path.resolve(directory, pkg.bin[key]);
      return acc;
    }, {} as Record<string, string>);
  }

  if (pkg.main) {
    return { [pkg.name]: path.resolve(directory, pkg.main) };
  }

  return {};
}

async function installLocalMcpServer(
  dirPath: string,
  args?: string[],
  env?: string[]
) {
  if (!fs.existsSync(dirPath)) {
    return {
      content: [
        {
          type: "text",
          text: `Path ${dirPath} does not exist locally!`,
        },
      ],
      isError: true,
    };
  }

  if (fs.existsSync(path.join(dirPath, "package.json"))) {
    const servers = await attemptNodeInstall(dirPath);

    Object.keys(servers).forEach((name) => {
      installToClaudeDesktop(
        name,
        "node",
        [servers[name], ...(args ?? [])],
        env
      );
    });

    return {
      content: [
        {
          type: "text",
          text: `Installed the following servers via npm successfully! ${Object.keys(
            servers
          ).join(";")} Tell the user to restart the app`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Can't figure out how to install ${dirPath}`,
      },
    ],
    isError: true,
  };
}

async function installRepoMcpServer(
  name: string,
  args?: string[],
  env?: string[]
) {
  if (!(await hasNodeJs())) {
    return {
      content: [
        {
          type: "text",
          text: `Node.js is not installed, please install it!`,
        },
      ],
      isError: true,
    };
  }

  if (await isNpmPackage(name)) {
    installRepoWithArgsToClaudeDesktop(name, true, args, env);

    return {
      content: [
        {
          type: "text",
          text: "Installed MCP server via npx successfully! Tell the user to restart the app",
        },
      ],
    };
  }

  if (!(await hasUvx())) {
    return {
      content: [
        {
          type: "text",
          text: `Python uv is not installed, please install it! Tell users to go to https://docs.astral.sh/uv`,
        },
      ],
      isError: true,
    };
  }

  installRepoWithArgsToClaudeDesktop(name, false, args, env);

  return {
    content: [
      {
        type: "text",
        text: "Installed MCP server via uvx successfully! Tell the user to restart the app",
      },
    ],
  };
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const toolInput = request.params.arguments || {};

  switch (toolName) {
    case "install_repo_mcp_server":
      const { name: repoName, args, env } = toolInput as {
        name: string;
        args?: string[];
        env?: string[];
      };

      return await installRepoMcpServer(repoName, args, env);

    case "install_local_mcp_server":
      const dirPath = toolInput.path as string;
      const { args: localArgs, env: localEnv } = toolInput as {
        args?: string[];
        env?: string[];
      };

      return await installLocalMcpServer(dirPath, localArgs, localEnv);

    case "server_status":
      const status = await serverManager.getServerStatus(toolInput.name as string);
      return {
        output: status || { error: "Server not found" },
      };

    case "server_start":
      const startResult = await serverManager.startServer(toolInput.name as string);
      return {
        output: startResult || { error: "Failed to start server" },
      };

    case "server_stop":
      const stopResult = await serverManager.stopServer(toolInput.name as string);
      return {
        output: { success: stopResult },
      };

    case "server_metrics":
      const metrics = await serverManager.getServerMetrics(toolInput.name as string);
      return {
        output: metrics || { error: "Failed to get metrics" },
      };

    case "server_health":
      const health = await serverManager.checkServerHealth(toolInput.name as string);
      return {
        output: health,
      };

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch(console.error);
