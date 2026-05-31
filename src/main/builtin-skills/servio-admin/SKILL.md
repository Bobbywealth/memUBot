---
name: Servio Admin
description: Control Servio restaurant platform — orders, menu, inventory, staff, and push notifications via API
category: business
platform: all
---

# Servio Admin Skill

## When to Use

Use this skill when Bobby asks to:
- Check or manage Servio orders (active, pending, completed)
- Add, edit, or remove menu items
- Update inventory or stock levels
- View staff schedules or manage shifts
- Send push notifications to customers or staff
- Check Servio dashboard or order alerts
- Control the AI phone receptionist (pause, resume, config)
- Access the Servio staff portal
- Manage menu items for Sashey's Kitchen or other restaurants

## Contract

- Always use the Servio API base URL: `https://servio-backend-zexb.onrender.com`
- Authenticate with JWT token: `business@wolfpaqmarketing.com` / `sashey123`
- All menu/item operations go through `/api/menu/items`
- Orders through `/api/orders` (or equivalent endpoint)
- Push notifications through the notification endpoint
- Return actual data, not fabricated responses
- If an API call fails, report the error and suggest a fix

## Helper

### Base URL
```
https://servio-backend-zexb.onrender.com
```

### Auth Headers
```json
{
  "Authorization": "Bearer <jwt_token>",
  "Content-Type": "application/json"
}
```

### Key Endpoints

| Action | Endpoint | Method |
|--------|----------|--------|
| Get menu items | `/api/menu/items` | GET |
| Add menu item | `/api/menu/items` | POST |
| Update menu item | `/api/menu/items/:id` | PUT/PATCH |
| Delete menu item | `/api/menu/items/:id` | DELETE |
| Get orders | `/api/orders` | GET |
| Update order status | `/api/orders/:id` | PATCH |
| Send push | `/api/notifications/push` | POST |
| Get staff | `/api/staff` | GET |

### Login Credentials (Bobby's accounts)
- **Servio Admin**: `business@wolfpaqmarketing.com` / `sashey123`
- **Render Dashboard**: `business@wolfpaqmarketing.com` / `ApexTax2025!`

## Pitfalls

- **Don't guess endpoints** — always verify the correct path before making API calls
- **Don't use wrong port** — Servio backend is on Render at `servio-backend-zexb.onrender.com`, not localhost
- **JWT expires** — if auth fails, the token may need to be refreshed via login endpoint
- **Menu has 192 items** — be specific when searching to avoid returning all items
- **Restaurant ID required** — some endpoints need the restaurant context, check the API docs first

## Trigger Keywords

- "servio", "order", "menu item", "push notification", "staff", "inventory"
- "sashey's kitchen", "restaurant", "doorDash", "ubereats", "grubhub"
- "ai receptionist", "phone", "call", "voice"
- "render", "deploy", "backend", "api"
