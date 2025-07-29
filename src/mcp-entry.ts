#!/usr/bin/env node

// Point d'entrée spécifique pour le serveur MCP
import { FirebaseAppBuilderMCPServer } from './mcp-server.js';

async function main() {
  const server = new FirebaseAppBuilderMCPServer();
  await server.run();
}

main().catch((error) => {
  console.error('MCP Server failed to start:', error);
  process.exit(1);
});