---
name: Site Crawler
description: Recursively explore websites — discover pages, build sitemaps, extract structured data across a site
category: utility
platform: all
---

# Site Crawler Skill

## When to Use

Use when you need to explore an entire website or discover pages matching a pattern:
- Build a sitemap or page inventory
- Find all pages in a section (e.g., all `/blog/` posts, all `/products/`)
- Research competitor site structure
- Discover documentation pages
- Aggregate content across multiple pages

## Contract

- Uses `site_crawl` tool with breadth-first crawl
- Respects page boundaries — won't crawl external sites unless explicitly allowed via `match`
- Returns structured data with URLs, titles, and optional content
- Max 50 pages per crawl to avoid excessive scraping

## Tools

### site_crawl
```
{
  "url": "https://example.com",
  "match": "/blog/",              // optional: only follow links containing this string
  "extract_content": true,         // optional: include text excerpt from each page
  "max_pages": 20                  // default 20, max 50
}
```

**Returns:**
```json
{
  "start_url": "https://example.com",
  "pages_crawled": 20,
  "pages": [
    {"url": "https://example.com", "title": "Home", "text": "Welcome to..."},
    {"url": "https://example.com/about", "title": "About Us", "text": "We are..."},
    {"url": "https://example.com/blog/intro", "title": "Getting Started", "text": "This guide..."}
  ]
}
```

## Workflows

### Build a sitemap
1. `site_crawl` → root URL
2. `extract_content: false` (faster — just URLs and titles)
3. Parse the `pages` array for all discovered URLs

### Find all blog posts
1. `site_crawl` with `match: "/blog/"`
2. Results filtered to only blog-related pages
3. Returns array of blog post URLs and titles

### Research competitor product catalog
1. `site_crawl` → competitor homepage
2. `match: "/product/"` or `match: "/item/"`
3. `extract_content: true` for product descriptions
4. Returns all product pages with content

### Documentation research
1. `site_crawl` → docs URL (e.g., `https://api.example.com/docs`)
2. `match: "/docs/"` to stay in docs section
3. `extract_content: true` to get text of each doc page
4. Returns all doc pages with content for analysis

### Aggregate pricing data
1. `site_crawl` → pricing page
2. `match: "/pricing/"` or `match: "/price/"`
3. `extract_content: true`
4. Parse text excerpts for price values

## Pitfalls

- **Crawl depth**: Starts from one URL, follows links outward — may not reach all pages in one pass
- **JavaScript links**: Links that require JS to discover won't be found
- **Pagination**: If pagination uses JS (Load More buttons), use `web-browser` instead
- **Rate limiting**: Add delays if site is slow; aggressive crawling may get blocked
- **Site size**: Large sites may hit `max_pages` limit — try specific `match` patterns to narrow scope
- ** robots.txt**: Not automatically respected — crawl responsibly
