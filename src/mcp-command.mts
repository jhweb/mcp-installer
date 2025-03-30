import { spawn } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export interface IMCPCommand {
  execute(args: string[]): Promise<void>;
}

interface ServerProcess {
  pid: number;
  serverName: string;
  startTime: number;
}

export class MCPCommand implements IMCPCommand {
  private configPath: string;
  private processStorePath: string;

  constructor() {
    const basePath = process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Roaming', 'Claude')
      : path.join(os.homedir(), 'Library', 'Application Support', 'Claude');

    this.configPath = path.join(basePath, 'claude_desktop_config.json');
    this.processStorePath = path.join(basePath, 'mcp_processes.json');
  }

  private async loadConfig(): Promise<any> {
    try {
      return JSON.parse(await fs.promises.readFile(this.configPath, 'utf8'));
    } catch (e) {
      return { mcpServers: {} };
    }
  }

  private async loadProcessStore(): Promise<ServerProcess[]> {
    try {
      return JSON.parse(await fs.promises.readFile(this.processStorePath, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  private async saveProcessStore(processes: ServerProcess[]): Promise<void> {
    await fs.promises.writeFile(this.processStorePath, JSON.stringify(processes, null, 2));
  }

  private async getServerConfig(serverName: string): Promise<any> {
    const config = await this.loadConfig();
    return config.mcpServers?.[serverName];
  }

  private async executeCommand(command: string, args: string[] = []): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args);
      let output = '';
      let error = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data) => {
        error += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}: ${error}`));
        }
      });
    });
  }

  public async execute(args: string[]): Promise<void> {
    // Get the command and server name from args
    const command = args[2];
    const serverName = args[3];

    if (!command) {
      this.printUsage();
      return;
    }

    switch (command) {
      case 'status':
        await this.status(serverName);
        break;
      case 'status-all':
        await this.statusAll(serverName);
        break;
      case 'start':
        if (!serverName) {
          console.error('Server name is required for start command');
          this.printUsage();
          return;
        }
        await this.start(serverName);
        break;
      case 'stop':
        if (!serverName) {
          console.error('Server name is required for stop command');
          this.printUsage();
          return;
        }
        await this.stop(serverName);
        break;
      case 'restart':
        if (!serverName) {
          console.error('Server name is required for restart command');
          this.printUsage();
          return;
        }
        await this.restart(serverName);
        break;
      case 'logs':
        if (!serverName) {
          console.error('Server name is required for logs command');
          this.printUsage();
          return;
        }
        await this.logs(serverName);
        break;
      case 'list':
        await this.list();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        this.printUsage();
    }
  }

  private printUsage(): void {
    console.log(`
MCP Command - Server Management Tool

Usage:
  mcpctl <command> [server-name]

Commands:
  status [server]   Show concise status of all servers or specific server
  status-all [server] Show detailed status of all servers or specific server
  start <server>    Start a server
  stop <server>     Stop a server
  restart <server>  Restart a server
  logs <server>     Show server logs
  list             List all installed servers
    `);
  }

  private async status(serverName?: string): Promise<void> {
    const config = await this.loadConfig();
    const servers = serverName ? [serverName] : Object.keys(config.mcpServers || {});

    // Print header
    console.log('\nServer Status:');
    console.log('NAME'.padEnd(20) + 'STATUS'.padEnd(10) + 'PID'.padEnd(8) + 'HEALTH');
    console.log('-'.repeat(50));

    for (const server of servers) {
      const serverConfig = config.mcpServers[server];
      if (!serverConfig) {
        console.error(`Server '${server}' not found`);
        continue;
      }

      try {
        const isRunning = await this.isServerRunning(server);
        const status = isRunning ? 'RUNNING' : 'STOPPED';
        const healthStatus = isRunning ? await this.checkServerHealth(server) : 'N/A';
        const pid = await this.getServerPid(server);

        console.log(
          server.padEnd(20) +
          status.padEnd(10) +
          (pid ? pid.toString() : 'N/A').padEnd(8) +
          healthStatus
        );
      } catch (error) {
        console.error(`Error checking status for ${server}:`, error);
      }
    }
    console.log(''); // Empty line at end
  }

  private async statusAll(serverName?: string): Promise<void> {
    const config = await this.loadConfig();
    const servers = serverName ? [serverName] : Object.keys(config.mcpServers || {});

    for (const server of servers) {
      const serverConfig = config.mcpServers[server];
      if (!serverConfig) {
        console.error(`Server '${server}' not found`);
        continue;
      }

      try {
        const isRunning = await this.isServerRunning(server);
        const status = isRunning ? 'RUNNING' : 'STOPPED';
        const healthStatus = isRunning ? await this.checkServerHealth(server) : 'N/A';
        const pid = await this.getServerPid(server);

        console.log(`
Server: ${server}
Status: ${status}
Health: ${healthStatus}
PID: ${pid || 'N/A'}
Command: ${serverConfig.command} ${serverConfig.args.join(' ')}
Port: ${serverConfig.port || 'N/A'}
Environment: ${Object.keys(serverConfig.env || {}).length} variables
Last Run: ${serverConfig.lastRun || 'Never'}
        `);
      } catch (error) {
        console.error(`Error checking status for ${server}:`, error);
      }
    }
  }

  private async start(serverName: string): Promise<void> {
    const serverConfig = await this.getServerConfig(serverName);
    if (!serverConfig) {
      throw new Error(`Server '${serverName}' not found`);
    }

    if (await this.isServerRunning(serverName)) {
      console.log(`Server '${serverName}' is already running`);
      return;
    }

    try {
      const proc = spawn(serverConfig.command, serverConfig.args, {
        env: { ...process.env, ...serverConfig.env },
        detached: true,
        stdio: 'ignore'
      });

      // Store process information
      const processes = await this.loadProcessStore();
      processes.push({
        pid: proc.pid!,
        serverName,
        startTime: Date.now()
      });
      await this.saveProcessStore(processes);

      proc.unref();
      console.log(`Started server '${serverName}' (PID: ${proc.pid})`);

      // Check server health after starting
      await this.checkServerHealth(serverName);
    } catch (error) {
      console.error(`Failed to start server '${serverName}':`, error);
    }
  }

  private async stop(serverName: string): Promise<void> {
    const pid = await this.getServerPid(serverName);
    if (!pid) {
      console.log(`Server '${serverName}' is not running`);
      return;
    }

    try {
      process.kill(pid);
      
      // Remove process from store
      const processes = await this.loadProcessStore();
      const updatedProcesses = processes.filter(p => p.pid !== pid);
      await this.saveProcessStore(updatedProcesses);
      
      console.log(`Stopped server '${serverName}'`);
    } catch (error) {
      console.error(`Failed to stop server '${serverName}':`, error);
    }
  }

  private async restart(serverName: string): Promise<void> {
    await this.stop(serverName);
    // Wait a bit for the server to fully stop
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.start(serverName);
  }

  private async logs(serverName: string): Promise<void> {
    const pid = await this.getServerPid(serverName);
    if (!pid) {
      console.log(`Server '${serverName}' is not running`);
      return;
    }

    try {
      // Use ps command to get process info and logs
      const output = await this.executeCommand('ps', ['-p', pid.toString(), '-o', 'pid,ppid,cmd']);
      console.log(`Process information for ${serverName}:\n${output}`);
    } catch (error) {
      console.error(`Failed to get logs for server '${serverName}':`, error);
    }
  }

  private async list(): Promise<void> {
    const config = await this.loadConfig();
    const servers = Object.keys(config.mcpServers || {});

    if (servers.length === 0) {
      console.log('No MCP servers installed');
      return;
    }

    console.log('\nInstalled MCP Servers:');
    for (const server of servers) {
      const status = await this.isServerRunning(server) ? 'RUNNING' : 'STOPPED';
      const pid = await this.getServerPid(server);
      console.log(`- ${server} (${status})${pid ? ` [PID: ${pid}]` : ''}`);
    }
  }

  private async isServerRunning(serverName: string): Promise<boolean> {
    const pid = await this.getServerPid(serverName);
    if (!pid) return false;

    try {
      process.kill(pid, 0);
      return true;
    } catch {
      // Process doesn't exist, clean up the store
      const processes = await this.loadProcessStore();
      const updatedProcesses = processes.filter(p => p.pid !== pid);
      await this.saveProcessStore(updatedProcesses);
      return false;
    }
  }

  private async getServerPid(serverName: string): Promise<number | null> {
    const processes = await this.loadProcessStore();
    const process = processes.find(p => p.serverName === serverName);
    return process?.pid || null;
  }

  private async checkServerHealth(serverName: string): Promise<string> {
    const pid = await this.getServerPid(serverName);
    if (!pid) return 'NOT_RUNNING';

    try {
      // Check if process is responding
      process.kill(pid, 0);
      
      // Get process stats using ps
      const output = await this.executeCommand('ps', ['-p', pid.toString(), '-o', '%cpu,%mem']);
      const [, stats] = output.split('\n');
      if (stats) {
        const [cpu, mem] = stats.trim().split(/\s+/);
        return `OK (CPU: ${cpu}%, MEM: ${mem}%)`;
      }
      
      return 'RUNNING';
    } catch {
      return 'NOT_RESPONDING';
    }
  }
}

// Export singleton instance
export const mcpCommand = new MCPCommand(); 