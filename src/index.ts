#!/usr/bin/env node
/**
 * Google Ads Transparency MCP Server
 *
 * Provides FREE programmatic access to Google Ads Transparency Center data
 * for competitive intelligence, ad creative research, and market analysis.
 *
 * No API keys required - data is scraped directly from public sources.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { tools, executeTool } from './tools/index.js';
import { browserManager } from './scraper/browser.js';
import { cache } from './services/cache.js';
import { rateLimiter } from './services/rate-limiter.js';

// Server metadata
const SERVER_NAME = 'gads-transparency';
const SERVER_VERSION = '1.0.0';

/**
 * Create and configure the MCP server
 */
function createServer(): Server {
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool listing handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        annotations: tool.annotations,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Register tool execution handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await executeTool(name, args);
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: errorMessage,
            }),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Graceful shutdown handler
 */
async function shutdown(): Promise<void> {
  console.error('Shutting down Google Ads Transparency MCP Server...');

  try {
    // Clear rate limiter queue
    rateLimiter.clear();

    // Stop cache cleanup
    cache.stop();

    // Close browser
    await browserManager.close();

    console.error('Shutdown complete');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }

  process.exit(0);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.error('Starting Google Ads Transparency MCP Server...');
  console.error(`Version: ${SERVER_VERSION}`);
  console.error('');
  console.error('Available tools:');
  tools.forEach((tool) => {
    console.error(`  - ${tool.name}`);
  });
  console.error('');

  // Register shutdown handlers
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Create and start server
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error('MCP Server running on stdio');
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
