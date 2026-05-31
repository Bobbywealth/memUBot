import type Anthropic from '@anthropic-ai/sdk'

/**
 * Browser Use tool definitions for web automation
 * Uses Playwright for headless browser control with full DOM access
 */

export const browserTool: Anthropic.Tool = {
  name: 'browser',
  description: `Control a headless browser to interact with web pages.

USE CASES:
- Research: scrape product pages, news articles, competitor info
- Automation: fill forms, click through multi-step flows, extract data
- Monitoring: check prices, availability, status pages
- Testing: verify page content, UI behavior

AVAILABLE ACTIONS:
- browse: Navigate to a URL and get page content (text + links + images)
- click: Click an element by CSS selector or text
- type: Type text into an input field
- extract: Extract structured data using CSS selectors
- screenshot: Take a screenshot of the current page
- scroll: Scroll up or down
- wait: Wait for an element or condition
- evaluate: Run JavaScript in the page context

SECURITY: Only navigates to URLs. Never executes untrusted JavaScript.`,
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['browse', 'click', 'type', 'extract', 'screenshot', 'scroll', 'wait', 'evaluate'],
        description: 'The browser action to perform'
      },
      url: {
        type: 'string',
        description: 'URL to navigate to (for browse action)'
      },
      selector: {
        type: 'string',
        description: 'CSS selector or text content to target'
      },
      text: {
        type: 'string',
        description: 'Text to type (for type action)'
      },
      extract: {
        type: 'string',
        description: 'CSS selector to extract content from'
      },
      scroll_direction: {
        type: 'string',
        enum: ['up', 'down'],
        description: 'Scroll direction'
      },
      scroll_amount: {
        type: 'number',
        description: 'Pixels to scroll (default: 500)'
      },
      wait_for: {
        type: 'string',
        description: 'CSS selector or text to wait for'
      },
      timeout: {
        type: 'number',
        description: 'Timeout in ms (default: 30000)'
      },
      javascript: {
        type: 'string',
        description: 'JavaScript code to execute in page context (for evaluate action)'
      }
    },
    required: ['action']
  }
}

/**
 * Web Fetch tool - fast content extraction without browser
 * Uses axios + cheerio for JavaScript-light pages
 */
export const webFetchTool: Anthropic.Tool = {
  name: 'web_fetch',
  description: `Fetch a URL and extract readable content without launching a full browser.

USE CASES:
- Fast page content retrieval (news, articles, docs)
- Extract specific data from pages (prices, titles, links)
- Check if a page is accessible
- Extract all links or images from a page

LIMITATIONS:
- No JavaScript execution (content loaded via JS won't appear)
- No interactive features (forms, buttons won't work)

For JavaScript-heavy pages (React, Vue, Angular SPAs), use browser tool instead.`,
  input_schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to fetch'
      },
      extract: {
        type: 'string',
        description: 'CSS selector to extract specific content'
      },
      extract_all: {
        type: 'boolean',
        description: 'If true, extract all matches for the selector (returns array)'
      },
      timeout: {
        type: 'number',
        description: 'Request timeout in ms (default: 15000)'
      }
    },
    required: ['url']
  }
}

/**
 * Site Crawler tool - recursively explore a website
 */
export const siteCrawlerTool: Anthropic.Tool = {
  name: 'site_crawl',
  description: `Recursively crawl a website to discover and map pages.

USE CASES:
- Build a sitemap or knowledge graph of a site
- Find all pages matching a pattern (products, articles, docs)
- Research competitor site structure
- Discover all links within a domain

OUTPUT:
- List of discovered URLs with titles and metadata
- Optionally extracts content from each page
- Respects robots.txt (if found)

LIMIT: Max 50 pages per crawl to avoid excessive scraping.`,
  input_schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Starting URL to crawl'
      },
      match: {
        type: 'string',
        description: 'Only follow links matching this pattern (e.g., "/products/", "example.com")'
      },
      extract_content: {
        type: 'boolean',
        description: 'If true, extract text content from each page (slower but richer)'
      },
      max_pages: {
        type: 'number',
        description: 'Maximum pages to crawl (default: 20, max: 50)'
      }
    },
    required: ['url']
  }
}
