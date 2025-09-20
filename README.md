# CarHunter - Step 1: MVP Search Engine

CarHunter is a cloud-hosted car search engine for Danish dealers and leasing companies. Users input search criteria and the system performs web searches via the Perplexity API against selected Danish car sites.

## Live Application

🚀 **Live URL**: https://carhunter-lars-projects-3dde7303.vercel.app

## API Endpoints

### GET /api/ping
Health check endpoint that returns server status and timestamp.

**Response:**
```json
{
  "ok": true,
  "ts": 1758385295640
}
```

### POST /api/search
Main search functionality using Perplexity API to search Danish car sites.

**Request Body:**
```json
{
  "make": "BMW",
  "model": "X3",
  "year_from": 2020,
  "year_to": 2024,
  "max_price": 500000,
  "equipment": "læder, panoramatag",
  "optimization": "laveste pris",
  "sites": ["bilbasen.dk","dba.dk","biltorvet.dk","autotorvet.dk"]
}
```

**Success Response:**
```json
{
  "ok": true,
  "query": {...},
  "results": [...]
}
```

**Fallback Response (if JSON parsing fails):**
```json
{
  "ok": true,
  "query": {...},
  "results": {
    "raw": "<response text>"
  }
}
```

## Environment Setup

### Required Environment Variables

Set these in **Vercel → Project → Environment Variables → Production**:

- `PERPLEXITY_API_KEY` - Your Perplexity API key (required)

### Getting a Perplexity API Key

1. Go to [Perplexity API](https://www.perplexity.ai/settings/api)
2. Sign up/login and generate an API key
3. Add it to Vercel environment variables

## Testing the API

### Ping Test
```bash
curl -s https://carhunter-lars-projects-3dde7303.vercel.app/api/ping
```

### Search Test
```bash
curl -s -X POST https://carhunter-lars-projects-3dde7303.vercel.app/api/search \
 -H 'Content-Type: application/json' \
 -d '{
  "make":"BMW",
  "model":"X3",
  "year_from":2020,
  "year_to":2024,
  "max_price":500000,
  "equipment":"læder, panoramatag",
  "optimization":"laveste pris",
  "sites":["bilbasen.dk","dba.dk","biltorvet.dk","autotorvet.dk"]
}'
```

## Technical Stack

- **Framework**: Next.js 14 with TypeScript and App Router
- **Deployment**: Vercel (connected to GitHub)
- **API Integration**: Perplexity API with `sonar` model
- **Repository**: https://github.com/graphicpoint/carhunter

## Features Implemented

✅ Live Vercel URL with health check endpoint
✅ POST /api/search returns structured results or fallback
✅ No hardcoded API keys in source code
✅ Basic UI for manual testing
✅ Proper error handling and HTTP status codes
✅ Danish language prompts for Perplexity API

## Development

This is a [Next.js](https://nextjs.org) project. To run locally:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

## Deployment

The app auto-deploys to Vercel when changes are pushed to the `main` branch.

## Next Steps (Future Phases)

- **Step 2**: Supabase integration (authentication, database, RLS)
- **Step 3**: Stripe integration (plans, quotas, billing)
