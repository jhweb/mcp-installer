import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { spawnPromise } from 'spawn-rx';
import { ChildProcess } from 'child_process';

interface ServerProcess {
  pid: number;
  name: string;
  port: number;
  status: 'running' | 'stopped' | 'error';
  memory: number;
  cpu: number;
  startTime: Date;
}

interface ServerNotification {
  type: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
  serverName?: string;
}

interface ServerPreferences {
  installationDir: string;
  askForCustomPort: boolean;
  lastUpdated: string;
  notifications: {
    enabled: boolean;
    maxHistory: number;
    types: ('info' | 'warning' | 'error')[];
  };
}

interface ServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  port?: number;
  healthCheck?: string;
  autoRestart?: boolean;
  lastRun?: string;
}

export class ServerManager {
  private configPath: string;
  private servers: Map<string, ServerProcess>;
  private configCache: Record<string, ServerConfig>;
  private preferencesPath: string;
  private preferences: ServerPreferences;
  private notificationsPath: string;
  private notifications: ServerNotification[];

  constructor() {
    this.configPath = process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json')
      : path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    
    // Create conf directory if it doesn't exist
    const confDir = path.join(__dirname, '..', 'conf');
    if (!fs.existsSync(confDir)) {
      fs.mkdirSync(confDir, { recursive: true });
    }
    this.preferencesPath = path.join(confDir, 'mcp_preferences.json');
    
    this.notificationsPath = process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'mcp_notifications.json')
      : path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'mcp_notifications.json');
    
    this.servers = new Map();
    this.configCache = this.loadConfig();
    this.preferences = this.loadPreferences();
    this.notifications = this.loadNotifications();
  }

  private loadConfig(): Record<string, ServerConfig> {
    try {
      const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      return config.mcpServers || {};
    } catch (e) {
      return {};
    }
  }

  private saveConfig(config: Record<string, ServerConfig>): void {
    const fullConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    fullConfig.mcpServers = config;
    fs.writeFileSync(this.configPath, JSON.stringify(fullConfig, null, 2));
    this.configCache = config;
  }

  private loadNotifications(): ServerNotification[] {
    try {
      if (fs.existsSync(this.notificationsPath)) {
        return JSON.parse(fs.readFileSync(this.notificationsPath, 'utf8'));
      }
    } catch (e) {
      console.warn('Failed to load notifications:', e);
    }
    return [];
  }

  private saveNotifications() {
    try {
      fs.writeFileSync(this.notificationsPath, JSON.stringify(this.notifications, null, 2));
    } catch (e) {
      console.error('Failed to save notifications:', e);
    }
  }

  private addNotification(type: 'info' | 'warning' | 'error', message: string, serverName?: string) {
    if (!this.preferences.notifications.enabled) return;
    if (!this.preferences.notifications.types.includes(type)) return;

    const notification: ServerNotification = {
      type,
      message,
      timestamp: new Date().toISOString(),
      serverName
    };

    this.notifications.unshift(notification);
    
    // Trim history if needed
    if (this.notifications.length > this.preferences.notifications.maxHistory) {
      this.notifications = this.notifications.slice(0, this.preferences.notifications.maxHistory);
    }

    this.saveNotifications();
  }

  getNotifications(limit?: number): ServerNotification[] {
    return limit ? this.notifications.slice(0, limit) : this.notifications;
  }

  clearNotifications() {
    this.notifications = [];
    this.saveNotifications();
  }

  private loadPreferences(): ServerPreferences {
    try {
      if (fs.existsSync(this.preferencesPath)) {
        return JSON.parse(fs.readFileSync(this.preferencesPath, 'utf8'));
      }
    } catch (e) {
      console.warn('Failed to load preferences:', e);
    }
    
    // Default preferences
    return {
      installationDir: path.join(os.homedir(), 'mcp-servers'),
      askForCustomPort: true,
      lastUpdated: new Date().toISOString(),
      notifications: {
        enabled: true,
        maxHistory: 100,
        types: ['warning', 'error']
      }
    };
  }

  private savePreferences() {
    try {
      fs.writeFileSync(this.preferencesPath, JSON.stringify(this.preferences, null, 2));
    } catch (e) {
      console.error('Failed to save preferences:', e);
    }
  }

  async updatePreferences(newPrefs: Partial<ServerPreferences>) {
    this.preferences = {
      ...this.preferences,
      ...newPrefs,
      lastUpdated: new Date().toISOString()
    };
    this.savePreferences();
  }

  getPreferences(): ServerPreferences {
    return { ...this.preferences };
  }

  async updateServerConfig(serverName: string, config: Partial<ServerConfig>): Promise<void> {
    const currentConfig = this.configCache[serverName] || {};
    this.configCache[serverName] = { ...currentConfig, ...config };
    this.saveConfig(this.configCache);
  }

  async removeServer(serverName: string): Promise<boolean> {
    await this.stopServer(serverName);
    delete this.configCache[serverName];
    this.saveConfig(this.configCache);
    return true;
  }

  async getServerStatus(serverName: string): Promise<ServerProcess | null> {
    const server = this.servers.get(serverName);
    if (!server) return null;

    try {
      // Check if process is still running
      process.kill(server.pid, 0);
      
      // Update resource usage
      const usage = await this.getResourceUsage(server.pid);
      server.memory = usage.memory;
      server.cpu = usage.cpu;
      
      return server;
    } catch (e) {
      // Process no longer exists
      this.servers.delete(serverName);
      return null;
    }
  }

  private async getResourceUsage(pid: number): Promise<{ memory: number; cpu: number }> {
    try {
      const psOutput = await spawnPromise('ps', ['-p', pid.toString(), '-o', '%cpu,%mem']);
      const [cpu, mem] = psOutput.toString().trim().split('\n')[1].trim().split(/\s+/);
      return {
        memory: parseFloat(mem),
        cpu: parseFloat(cpu)
      };
    } catch (e) {
      return { memory: 0, cpu: 0 };
    }
  }

  async startServer(serverName: string): Promise<ServerProcess | null> {
    const config = this.configCache[serverName];
    if (!config) {
      this.addNotification('error', `Server ${serverName} not found in configuration`, serverName);
      throw new Error(`Server ${serverName} not found in configuration`);
    }

    // Check if server is already running
    const existing = await this.getServerStatus(serverName);
    if (existing) {
      this.addNotification('warning', `Server ${serverName} is already running`, serverName);
      return existing;
    }

    try {
      const child = await spawnPromise(config.command, config.args, {
        env: { ...process.env, ...config.env },
        detached: true,
        stdio: 'ignore'
      }) as unknown as ChildProcess;

      if (!child.pid) {
        this.addNotification('error', `Failed to get process ID for ${serverName}`, serverName);
        throw new Error('Failed to get process ID');
      }

      const serverProcess: ServerProcess = {
        pid: child.pid,
        name: serverName,
        port: config.port || 0,
        status: 'running',
        memory: 0,
        cpu: 0,
        startTime: new Date()
      };

      this.servers.set(serverName, serverProcess);
      this.addNotification('info', `Server ${serverName} started successfully`, serverName);

      // Update last run time in config
      await this.updateServerConfig(serverName, {
        ...config,
        lastRun: new Date().toISOString()
      });

      return serverProcess;
    } catch (e) {
      this.addNotification('error', `Failed to start server ${serverName}: ${e.message}`, serverName);
      console.error(`Failed to start server ${serverName}:`, e);
      return null;
    }
  }

  async stopServer(serverName: string): Promise<boolean> {
    const server = this.servers.get(serverName);
    if (!server) return false;

    try {
      process.kill(server.pid, 'SIGTERM');
      
      // Wait for process to exit
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verify process has stopped
      try {
        process.kill(server.pid, 0);
        // If we get here, process is still running
        process.kill(server.pid, 'SIGKILL');
      } catch (e) {
        // Process has stopped
      }

      this.servers.delete(serverName);
      return true;
    } catch (e) {
      console.error(`Failed to stop server ${serverName}:`, e);
      return false;
    }
  }

  async getServerMetrics(serverName: string): Promise<{
    uptime: number;
    memory: number;
    cpu: number;
    status: string;
  } | null> {
    const server = await this.getServerStatus(serverName);
    if (!server) return null;

    return {
      uptime: Date.now() - server.startTime.getTime(),
      memory: server.memory,
      cpu: server.cpu,
      status: server.status
    };
  }

  async checkServerHealth(serverName: string): Promise<{
    healthy: boolean;
    details: string;
  }> {
    const server = await this.getServerStatus(serverName);
    if (!server) {
      return { healthy: false, details: 'Server not running' };
    }

    const config = this.configCache[serverName];
    if (!config.healthCheck) {
      return { healthy: true, details: 'No health check configured' };
    }

    try {
      // Implement health check logic here
      // For now, just check if process is running and using reasonable resources
      const healthy = server.cpu < 90 && server.memory < 90;
      return {
        healthy,
        details: healthy ? 'Server running normally' : 'Server resource usage high'
      };
    } catch (e) {
      return {
        healthy: false,
        details: `Health check failed: ${e}`
      };
    }
  }
} 