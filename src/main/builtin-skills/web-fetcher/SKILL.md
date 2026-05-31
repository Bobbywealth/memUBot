---
name: Web Fetcher
description: Fast content extraction from web pages using HTTP + HTML parsing — no JavaScript required
category: utility
platform: all
---

# Web Fetcher Skill

## When to Use

Use for fast, lightweight page fetching when you don't need full browser interaction:
- News articles, blog posts, documentation
- Product descriptions and specs
- Link extraction from pages
- Quick page availability checks
- Extracting specific elements via CSS selectors

**Use web-browser skill instead when**: page requires JavaScript to render, you need to interact with the page, or screenshots are needed.

## Contract

- Uses axios + cheerio (server-side HTML parsing)
- No JavaScript execution — content must be in raw HTML
- Much faster than browser tool (no browser launch overhead)
- Returns structured JSON with page content and links

## Tools

### web_fetch
```
{
  "url": "https://example.com",
  "extract": "article",        // optional: CSS selector for specific content
  "extract_all": true,          // optional: return all matches as array
  "timeout": 15000
}
```

**Returns:**
- `url`: The actual URL (after redirects)
- `title`: Page title or first h1
- `text`: Main content (first 4000 chars of body text)
- `links`: Array of `{text, href}` (first 30 links)
- `status`: HTTP status code
- `results`: (when `extract_all: true`) array of all matching texts

### site_crawl
Recursively explore a website.
```
{
  "url": "https://example.com",
  "match": "/products/",        // optional: only follow matching links
  "extract_content": false,      // optional: extract text from each page
  "max_pages": 20
}
```

**Returns:**
- `start_url`: The URL where crawl started
- `pages_crawled`: Number of pages found
- `pages`: Array of `{url, title, text?}` objects

## Workflows

### Quick article summary
1. `web_fetch` → article URL
2. Extract key text and links
3. Done in ~1 second

### Extract all links from a page
```
{"url": "https://example.com", "extract_all": false}
```
Returns all links in the `links` array.

### Find all products on a category page
1. `web_fetch` → category URL
2. `site_crawl` → same URL with `match: "/product/"`
3. Returns all product URLs

### Research competitor pricing
1. `site_crawl` → competitor site with `match: "/price"`
2. Extract text from each page
3. Parse prices from text

## Pitfalls

- **JavaScript-rendered content**: If content is empty, use `web-browser` instead
- **Large pages**: Response truncated at 4000 chars of body text
- **Rate limiting**: Add delays between requests; sites may block aggressive crawling
- **Relative links**: `site_crawl` resolves relative URLs automatically
- **Max crawl**: 50 pages max — use `max_pages` to control scope
