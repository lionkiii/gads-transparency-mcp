/**
 * MCP Tools Registry
 * Exports all tools for the Google Ads Transparency MCP Server
 */

import { searchAdvertiserTool } from './search-advertisers.js';
import { getAdvertiserAdsTool } from './get-advertiser-ads.js';
import { getAdDetailsTool } from './get-ad-details.js';
import { getAdvertiserProfileTool } from './get-advertiser-profile.js';
import { compareAdPresenceTool } from './regional-analysis.js';

// Tool type for MCP server
export interface McpTool {
  name: string;
  description: string;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (params: unknown) => Promise<string>;
}

// All available tools
export const tools: McpTool[] = [
  searchAdvertiserTool as McpTool,
  getAdvertiserAdsTool as McpTool,
  getAdDetailsTool as McpTool,
  getAdvertiserProfileTool as McpTool,
  compareAdPresenceTool as McpTool,
];

// Tool map for quick lookup
export const toolMap = new Map<string, McpTool>(
  tools.map((tool) => [tool.name, tool])
);

// Get tool by name
export function getTool(name: string): McpTool | undefined {
  return toolMap.get(name);
}

// Execute tool by name
export async function executeTool(
  name: string,
  params: unknown
): Promise<string> {
  const tool = getTool(name);
  if (!tool) {
    return JSON.stringify({
      success: false,
      error: `Unknown tool: ${name}`,
      availableTools: tools.map((t) => t.name),
    });
  }

  return tool.execute(params);
}

// Export individual tools
export { searchAdvertiserTool } from './search-advertisers.js';
export { getAdvertiserAdsTool } from './get-advertiser-ads.js';
export { getAdDetailsTool } from './get-ad-details.js';
export { getAdvertiserProfileTool } from './get-advertiser-profile.js';
export { compareAdPresenceTool } from './regional-analysis.js';
