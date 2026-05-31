---
name: Food Delivery Merchant
description: Manage DoorDash, Uber Eats, and GrubHub merchant portals — orders, menu, earnings, and reviews
category: business
platform: all
---

# Food Delivery Merchant Skill

## When to Use

Use this skill when Bobby asks to:
- Check new orders on DoorDash, Uber Eats, or GrubHub
- Update menu items or item availability
- Check earnings, payouts, or revenue reports
- Respond to customer reviews or complaints
- Manage store hours or pickup settings
- Handle refunds or order issues
- Check Dasher/Driver status or delivery times
- Access the merchant dashboard for any delivery platform
- Compare pricing across platforms

## Contract

- Use cua-driver or browser automation for merchant portals (residential IP avoids bot detection)
- DoorDash and Uber Eats merchant portals work reliably via automation
- GrubHub merchant portal has DNS/bot detection issues — may need manual approach
- Never make up order numbers, customer names, or transaction data
- Always verify portal is loaded before attempting interactions
- Log out when done (security)

## Platform Credentials

| Platform | URL | Email | Password |
|----------|-----|-------|----------|
| DoorDash | https://merchant.doordash.com | tbd | tbd |
| Uber Eats | https://restaurant.uber.com | tbd | tbd |
| GrubHub | https://restaurant.grubhub.com | Business@wolfpaqmarketing.com | 100Drums |

## DoorDash Merchant Portal Workflow

1. Navigate to `https://merchant.doordash.com`
2. Sign in with Bobby's credentials
3. Dashboard shows: Today's orders, Revenue, Active orders
4. Order management: Click order → Update status (Accepted, Preparing, Ready for Pickup)
5. Menu management: Settings → Menu → Edit items
6. Check payouts: Earnings → Payout history

## Uber Eats Merchant Portal Workflow

1. Navigate to `https://restaurant.uber.com`
2. Sign in with Uber account linked to restaurant
3. Home shows: Active orders, Today's summary
4. Menu: Business → Menu Editor
5. Orders auto-sync — respond within timeframe to avoid penalties

## GrubHub Merchant Portal Workflow

1. Navigate to `https://restaurant.grubhub.com`
2. Sign in with `Business@wolfpaqmarketing.com` / `100Drums`
3. **NOTE**: Portal has aggressive bot detection — if automation fails, report to Bobby and suggest manual login
4. Orders → Manage incoming orders
5. Menu: Account → Menu items

## Pitfalls

- **GrubHub bot detection**: If cua-driver gets blocked on GrubHub, try a different approach or flag for Bobby
- **Order timeout penalties**: DoorDash and UberEats penalize restaurants that don't acknowledge orders quickly — flag this immediately
- **Menu sync conflicts**: If item is updated on one platform but not others, flag for Bobby
- **Never accept a refund** without Bobby's approval — escalate to him
- **Residential IP matters**: Don't use datacenter IPs for automation — they get blocked

## Trigger Keywords

- "doordash", "door dash", "ubereats", "uber eats", "grubhub"
- "merchant portal", "restaurant dashboard", "order", "earnings", "payout"
- "menu update", "item availability", "out of stock"
- "review", "customer complaint", "refund"
- "dasher", "driver", "delivery", "pickup"
