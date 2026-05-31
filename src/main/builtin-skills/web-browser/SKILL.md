---
name: Web Browser
description: Browse web pages interactively using a headless browser — navigate, click, type, extract data, screenshot
category: utility
platform: all
---

# Web Browser Skill

## When to Use

Use when you need to interact with web pages like a real user:
- JavaScript-heavy pages (React, Vue, Angular SPAs)
- Multi-step forms or flows
- Click-through interactions
- Screenshot capture
- Price monitoring, availability checks
- Page state verification

## Contract

- Uses Playwright headless browser — runs locally, full DOM access
- Each `browse` action loads the page fresh; `click` and `type` maintain page state
- Screenshots are returned as base64 JPEG
- Always check the page loaded correctly before interacting

## Tools

### browser (action: browse)
Navigate to URL and get page content.
```
{"action": "browse", "url": "https://example.com", "timeout": 30000}
```
Returns: `{url, title, text, links[], images[], message}`

### browser (action: click)
Click element by CSS selector or text.
```
{"action": "click", "selector": ".submit-button", "timeout": 10000}
```
Returns: `{success, title, text, url}`

### browser (action: type)
Type text into an input field.
```
{"action": "type", "selector": "#search-input", "text": "pizza near me"}
```
Returns: `{success, message}`

### browser (action: extract)
Extract structured data using CSS selector.
```
{"action": "extract", "selector": ".product-item"}
```
Returns: `{results: [{tag, text, href, src}], count}`

### browser (action: screenshot)
Capture current page screenshot.
```
{"action": "screenshot"}
```
Returns: `{type, size_bytes, data_url, message}`

### browser (action: scroll)
Scroll the page.
```
{"action": "scroll", "scroll_direction": "down", "scroll_amount": 500}
```

### browser (action: wait)
Wait for element to appear.
```
{"action": "wait", "wait_for": ".loading-spinner", "timeout": 15000}
```

### browser (action: evaluate)
Run JavaScript in page context.
```
{"action": "evaluate", "javascript": "document.title"}
```

## Workflows

### Research a topic
1. `browse` → search engine
2. `click` → first result
3. `extract` → article content
4. `screenshot` → save visual

### Price monitoring
1. `browse` → product page
2. `extract` → `.price` selector
3. Repeat periodically

### Form automation
1. `browse` → form URL
2. `type` → fill fields
3. `click` → submit button
4. `wait` → confirmation element

## Pitfalls

- **Timeout**: Pages that take >30s to load — increase timeout
- **Selector not found**: Page structure changed — try text match `click` with page content
- **Headless limitations**: Some sites block headless browsers — fall back to web_fetch
- **Session**: Each conversation starts fresh — state is not maintained between browse calls
