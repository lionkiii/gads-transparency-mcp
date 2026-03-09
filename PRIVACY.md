# Privacy Policy — Google Ads Transparency MCP Server

**Last updated:** March 2026

## Overview

The Google Ads Transparency MCP Server (`gads-transparency-mcp`) is a local MCP server that accesses publicly available data from the Google Ads Transparency Center. It runs entirely on your machine.

## Data Collection

This MCP server **does not collect, store, or transmit any user data** to third parties. Specifically:

- **No analytics or telemetry** is collected
- **No usage data** is sent to the developer or any third party
- **No personal information** is gathered
- **No API keys, authentication, or Google account** is required

## Data Processing

- All requests to the Google Ads Transparency Center are made **directly from your machine** using a local headless browser (Puppeteer)
- Only publicly available advertiser and ad data is accessed — the same data any person can view at [adstransparency.google.com](https://adstransparency.google.com)
- Results are returned to your MCP client (e.g., Claude Desktop) and are **never stored, cached externally, or forwarded** by this server
- In-memory caching (1-hour TTL) is used locally to reduce redundant requests

## Third-Party Services

This server communicates only with:

- **Google Ads Transparency Center** (`adstransparency.google.com`) — to retrieve publicly available ad and advertiser data

No other third-party services are contacted.

## Data Retention

- This server does not maintain any database or persistent storage
- In-memory cache (up to 1,000 entries) is cleared when the server stops
- No data persists between sessions

## Open Source

This server is fully open source under the MIT license. You can audit the complete source code at [github.com/lionkiii/gads-transparency-mcp](https://github.com/lionkiii/gads-transparency-mcp).

## Contact

If you have questions about this privacy policy, please open an issue on the [GitHub repository](https://github.com/lionkiii/gads-transparency-mcp/issues).
