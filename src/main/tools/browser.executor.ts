import { chromium, type Browser, type Page } from 'playwright'
import axios from 'axios'
import * as cheerio from 'cheerio'

// Singleton browser instance
let browserInstance: Browser | null = null
let currentPage: Page | null = null

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({ headless: true })
  }
  return browserInstance
}

async function getPage(): Promise<Page> {
  const browser = await getBrowser()
  if (!currentPage || currentPage.isClosed()) {
    currentPage = await browser.newPage()
    await currentPage.setViewportSize({ width: 1280, height: 800 })
  }
  return currentPage
}

type BrowserResult = Record<string, unknown>

async function ok(data: BrowserResult): Promise<BrowserResult> {
  return data
}

async function err(message: string): Promise<BrowserResult> {
  return { error: message }
}

/**
 * Execute browser tool actions
 */
export async function executeBrowserAction(args: {
  action: string
  url?: string
  selector?: string
  text?: string
  extract?: string
  scroll_direction?: 'up' | 'down'
  scroll_amount?: number
  wait_for?: string
  timeout?: number
  javascript?: string
}): Promise<BrowserResult> {
  const { action } = args
  const timeout = args.timeout ?? 30000

  switch (action) {
    case 'browse': {
      if (!args.url) return err('URL required for browse action')
      const page = await getPage()
      await page.goto(args.url, { timeout, waitUntil: 'networkidle' })

      const title = await page.title()
      const url = page.url()

      const bodyText = await page.evaluate(() => {
        const el = document.body
        if (!el) return ''
        return el.innerText?.slice(0, 3000) ?? ''
      })

      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
          .slice(0, 30)
          .map(a => ({
            text: a.innerText?.trim().slice(0, 50) ?? '',
            href: a.href
          }))
          .filter(l => l.href && !l.href.startsWith('javascript:'))
      })

      const images = await page.evaluate(() => {
        return Array.from(document.querySelectorAll<HTMLImageElement>('img[src]'))
          .slice(0, 10)
          .map(img => img.src)
          .filter(Boolean)
      })

      return ok({
        url,
        title,
        text: bodyText,
        links,
        images,
        message: `Loaded: ${title}\n\n${bodyText.slice(0, 1500)}...`
      })
    }

    case 'click': {
      const page = await getPage()
      if (!args.selector) return err('Selector required for click action')

      try {
        await page.click(args.selector, { timeout: 5000 })
      } catch {
        await page.click(`text=${args.selector}`, { timeout: 5000 })
      }

      await page.waitForLoadState('networkidle', { timeout }).catch(() => {})

      const title = await page.title()
      const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 1000) ?? '')

      return ok({ success: true, title, text: bodyText, url: page.url() })
    }

    case 'type': {
      const page = await getPage()
      if (!args.selector || args.text === undefined) return err('Selector and text required for type action')

      await page.fill(args.selector, args.text)
      return ok({ success: true, message: `Typed "${args.text}" into ${args.selector}` })
    }

    case 'extract': {
      const page = await getPage()
      if (!args.extract) return err('Selector required for extract action')

      const results = await page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel)
        return Array.from(elements).map(el => ({
          tag: el.tagName.toLowerCase(),
          text: (el as HTMLElement).innerText?.trim() ?? '',
          href: el instanceof HTMLAnchorElement ? el.href : null,
          src: el instanceof HTMLImageElement ? el.src : null
        }))
      }, args.extract)

      return ok({ results, count: results.length })
    }

    case 'screenshot': {
      const page = await getPage()
      const buffer = await page.screenshot({ type: 'jpeg', quality: 80 })
      const base64 = buffer.toString('base64')
      return ok({
        type: 'image/jpeg',
        size_bytes: buffer.length,
        data_url: `data:image/jpeg;base64,${base64.slice(0, 100)}...`,
        message: `[Screenshot captured: ${buffer.length} bytes]`
      })
    }

    case 'scroll': {
      const page = await getPage()
      const amount = args.scroll_amount ?? 500
      if (args.scroll_direction === 'up') {
        await page.evaluate((px) => window.scrollBy(0, -px), amount)
      } else {
        await page.evaluate((px) => window.scrollBy(0, px), amount)
      }
      return ok({ success: true, direction: args.scroll_direction, amount })
    }

    case 'wait': {
      const page = await getPage()
      if (!args.wait_for) return err('wait_for selector required')

      try {
        await page.waitForSelector(args.wait_for, { timeout })
        const text = await page.evaluate((sel) => {
          const el = document.querySelector(sel) as HTMLElement | null
          return el?.innerText?.trim() ?? ''
        }, args.wait_for)
        return ok({ success: true, found: args.wait_for, text })
      } catch {
        return ok({ success: false, message: `Timeout waiting for ${args.wait_for}` })
      }
    }

    case 'evaluate': {
      const page = await getPage()
      if (!args.javascript) return err('javascript code required for evaluate action')

      const result = await page.evaluate(args.javascript)
      return ok({ result })
    }

    default:
      return err(`Unknown action: ${action}`)
  }
}

/**
 * Execute web fetch - fast content extraction with axios + cheerio
 */
export async function executeWebFetch(args: {
  url: string
  extract?: string
  extract_all?: boolean
  timeout?: number
}): Promise<BrowserResult> {
  const { url, extract, extract_all, timeout = 15000 } = args

  try {
    const response = await axios.get(url, {
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BobbyBot/1.0; +https://github.com/Bobbywealth/memUBot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      maxRedirects: 5
    })

    const $ = cheerio.load(response.data)
    $('script, style, nav, footer, header, aside, .sidebar, .nav, .menu, .advertisement, .ad, .social').remove()

    const title = $('title').text().trim() || $('h1').first().text().trim() || url

    if (extract) {
      const selected = $(extract)
      if (extract_all) {
        const results = selected.map((_, el) => $(el).text().trim()).get().filter(Boolean)
        return ok({ url, title, results, count: results.length })
      } else {
        const text = selected.first().text().trim()
        return ok({ url, title, text, selector: extract })
      }
    }

    const mainContent = $('main, article, .content, .post, #content, body')
      .first()
      .text()
      .trim()
      .slice(0, 4000)

    const links = $('a[href]')
      .map((_, el) => {
        const href = $(el).attr('href') ?? ''
        const text = $(el).text().trim()
        return { text: text.slice(0, 50), href }
      })
      .get()
      .filter((l: { href: string }) => l.href && !l.href.startsWith('javascript:'))
      .slice(0, 30)

    return ok({ url, title, text: mainContent, links, status: response.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return err(message)
  }
}

/**
 * Execute site crawl - recursively explore a website
 */
export async function executeSiteCrawl(args: {
  url: string
  match?: string
  extract_content?: boolean
  max_pages?: number
}): Promise<BrowserResult> {
  const { url: startUrl, match, extract_content, max_pages = 20 } = args

  const visited = new Set<string>()
  const results: Array<{ url: string; title: string; text?: string }> = []
  const toVisit = [startUrl]
  const baseUrl = new URL(startUrl).origin

  while (toVisit.length > 0 && results.length < max_pages) {
    const currentUrl = toVisit.pop()!
    if (visited.has(currentUrl)) continue
    visited.add(currentUrl)

    try {
      const response = await axios.get(currentUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BobbyBot/1.0; +https://github.com/Bobbywealth/memUBot)'
        },
        maxRedirects: 3
      })

      const $ = cheerio.load(response.data)
      const title = $('title').text().trim() || $('h1').first().text().trim() || currentUrl

      const pageResult: typeof results[0] = { url: currentUrl, title }
      if (extract_content) {
        $('script, style, nav, footer, header').remove()
        pageResult.text = $('main, article, .content, #content, body')
          .first()
          .text()
          .trim()
          .slice(0, 500)
      }
      results.push(pageResult)

      if (results.length < max_pages) {
        const newLinks = $('a[href]')
          .map((_, el) => $(el).attr('href') ?? '')
          .get()
          .filter((href: string) => {
            if (!href || href.startsWith('javascript:') || href.startsWith('#')) return false
            if (href.startsWith('http')) {
              return match ? href.includes(match) : href.startsWith(baseUrl)
            }
            return match ? href.includes(match) : true
          })
          .slice(0, 10)

        for (const link of newLinks) {
          let fullUrl: string
          if (link.startsWith('http')) {
            fullUrl = link
          } else {
            try {
              fullUrl = new URL(link, baseUrl).href
            } catch {
              continue
            }
          }
          if (!visited.has(fullUrl) && !toVisit.includes(fullUrl)) {
            toVisit.push(fullUrl)
          }
        }
      }
    } catch {
      // Skip inaccessible pages
    }
  }

  return ok({ start_url: startUrl, pages_crawled: results.length, pages: results })
}
