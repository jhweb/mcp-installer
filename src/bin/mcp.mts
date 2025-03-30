#!/usr/bin/env node

import { mcpCommand } from '../mcp-command.mjs';

async function main() {
  try {
    await mcpCommand.execute(process.argv);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main(); 