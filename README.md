# Google Ads Transparency MCP Server

[![npm version](https://img.shields.io/npm/v/gads-transparency-mcp)](https://www.npmjs.com/package/gads-transparency-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that gives AI assistants like **Claude Desktop**, **Cursor**, **Windsurf**, and any MCP client access to the **Google Ads Transparency Center**. Research competitor ads, analyze advertiser profiles, and compare ad presence across 42 regions — all through natural language.

> **100% Free. No API keys.** Uses publicly available Google Ads Transparency data. No Google account or API key required.

## What Can You Do?

Ask Claude questions like:
- *"What ads is Nike running in the US right now?"*
- *"Search for advertisers in the fitness industry"*
- *"Compare Shopify's ad presence in the US vs UK vs India"*
- *"Show me the advertiser profile for amazon.com"*
- *"Get details on this specific ad creative"*

## Quick Start

```bash
npx gads-transparency-mcp
```

Or install globally:

```bash
npm install -g gads-transparency-mcp
```

**Requirements:** Node.js >= 18. Puppeteer downloads Chromium automatically on first install.

## Claude Desktop Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "gads-transparency": {
      "command": "npx",
      "args": ["-y", "gads-transparency-mcp"]
    }
  }
}
```

Restart Claude Desktop. Done — Google Ads Transparency data is now available in Claude.

### Use with Other MCP Clients

Works with any MCP-compatible client including **Cursor**, **Windsurf**, **VS Code + Cline**, and more:

```bash
npx gads-transparency-mcp
```

## Available Tools (5 Competitive Intelligence Tools)

| Tool | Description |
|------|-------------|
| `search_advertiser` | Search for advertisers by website domain or brand name |
| `get_advertiser_ads` | Get all ads currently running for a specific advertiser (filter by format: text, image, video) |
| `get_ad_details` | Get detailed information about a specific ad creative |
| `get_advertiser_profile` | Get an advertiser's profile, verification status, and ad activity summary |
| `compare_ad_presence` | Compare an advertiser's ad presence across multiple regions |

## Examples

### Example 1: Research competitor ads

**User prompt:** "Show me all ads currently running by Nike in the US"

**Expected behavior:**
- Calls `search_advertiser` with query "nike.com" and region "US" to find Nike's advertiser ID
- Then calls `get_advertiser_ads` with the advertiser ID and region "US"
- Returns a list of Nike's currently running ads with headlines, descriptions, ad format (text/image/video), and thumbnails

### Example 2: Get an advertiser's profile and verification status

**User prompt:** "Show me the advertiser profile for amazon.com"

**Expected behavior:**
- Calls `search_advertiser` with query "amazon.com" to find Amazon's advertiser ID
- Then calls `get_advertiser_profile` with the advertiser ID
- Returns Amazon's advertiser name, Google verification status, total ad count, ad format distribution (text/image/video), and platform presence

### Example 3: Compare ad presence across regions

**User prompt:** "Compare Shopify's ad presence in the US, UK, and India"

**Expected behavior:**
- Calls `search_advertiser` with query "shopify.com" to find Shopify's advertiser ID
- Then calls `compare_ad_presence` with the advertiser ID and regions ["US", "GB", "IN"]
- Returns ad counts and format distribution for each region, highlighting where Shopify is most and least active

## Use Cases

- **Competitor Ad Research** — See what ads your competitors are running right now
- **Ad Creative Inspiration** — Browse ad creatives by advertiser, format, and region
- **Market Intelligence** — Understand advertiser activity across different markets
- **Brand Safety** — Monitor who's advertising alongside your brand
- **Regional Strategy** — Compare ad presence across 42 countries to plan international campaigns
- **Advertiser Verification** — Check if an advertiser is verified by Google
- **PPC Research** — Research ad strategies without expensive competitive intelligence tools

## Supported Regions (42 Countries)

| Region | Code | Region | Code | Region | Code |
|--------|------|--------|------|--------|------|
| United States | US | United Kingdom | GB | India | IN |
| Canada | CA | Australia | AU | Germany | DE |
| France | FR | Japan | JP | Brazil | BR |
| Mexico | MX | Italy | IT | Spain | ES |
| Netherlands | NL | Sweden | SE | Norway | NO |
| Denmark | DK | Finland | FI | Poland | PL |
| Austria | AT | Switzerland | CH | Belgium | BE |
| Ireland | IE | Portugal | PT | New Zealand | NZ |
| Singapore | SG | Hong Kong | HK | Taiwan | TW |
| South Korea | KR | Philippines | PH | Malaysia | MY |
| Thailand | TH | Indonesia | ID | Vietnam | VN |
| South Africa | ZA | UAE | AE | Saudi Arabia | SA |
| Egypt | EG | Nigeria | NG | Kenya | KE |
| Argentina | AR | Chile | CL | Colombia | CO |
| Peru | PE |

## Features

- **Built-in Rate Limiting** — 2s between requests, max 30/min, with random delays
- **Response Caching** — 1hr TTL, up to 1000 entries, reduces redundant scraping
- **Anti-Detection** — Rotating user agents, viewport randomization, stealth plugin
- **Automatic Retries** — Exponential backoff (5s-30s) on failures, up to 3 attempts
- **Graceful Shutdown** — Proper cleanup of browser instances on exit

## Limitations

- **Rate Limited**: ~30 requests/minute to avoid blocking
- **No Historical Data**: Only currently running ads are visible
- **Regional**: Must specify region for each request
- **May Break**: Google can change the Transparency Center at any time
- **No Spend Data**: Ad spend info only available for political ads

## Requirements

- **Node.js** >= 18
- **Chrome/Chromium** — Puppeteer downloads it automatically on install
- No API keys, no authentication, no Google account needed

## Related

- [Google Ads Transparency Center](https://adstransparency.google.com) — The data source
- [Model Context Protocol](https://modelcontextprotocol.io) — The open standard for AI-tool integration
- [Claude Desktop](https://claude.ai/download) — Anthropic's desktop AI assistant
- [MCP Server Registry](https://github.com/punkpeye/awesome-mcp-servers) — Curated list of MCP servers

## Privacy Policy

See [PRIVACY.md](./PRIVACY.md) for our complete privacy policy.

**TL;DR:** This extension runs locally on your machine. It accesses only publicly available data from the Google Ads Transparency Center — the same data anyone can view in a browser. No data is collected, stored, or transmitted to any third party by this MCP server. No API keys or authentication required.

## License

MIT
