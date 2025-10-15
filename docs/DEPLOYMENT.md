# Deployment Guide

## Overview

This guide covers deploying the Agentic Orchestration Builder to Vercel, including environment setup, configuration, and monitoring.

## Prerequisites

- Vercel account
- Upstash Redis account (for production)
- Groq API account
- Node.js 18+ (for local development)

## Environment Variables

### Required Variables

Create a `.env.local` file in your project root with the following variables:

```bash
# Groq API Configuration
GROQ_API_KEY=your_groq_api_key_here

# Upstash Redis Configuration (for production)
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token

# Application Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NODE_ENV=production
```

### Optional Variables

```bash
# Monitoring and Analytics
SENTRY_DSN=your_sentry_dsn
ANALYTICS_ID=your_analytics_id

# Webhook Configuration
WEBHOOK_SECRET=your_webhook_secret

# Rate Limiting
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=3600000
```

## Vercel Deployment

### 1. Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your Git repository
4. Select the repository containing your project

### 2. Configure Build Settings

Vercel will auto-detect Next.js, but ensure these settings:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

### 3. Set Environment Variables

In the Vercel dashboard:

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add all required environment variables
4. Set them for Production, Preview, and Development environments

### 4. Deploy

1. Click "Deploy" in the Vercel dashboard
2. Wait for the build to complete
3. Your app will be available at `https://your-project.vercel.app`

## Upstash Redis Setup

### 1. Create Upstash Account

1. Go to [Upstash Console](https://console.upstash.com/)
2. Sign up or log in
3. Create a new Redis database

### 2. Get Connection Details

1. Select your Redis database
2. Go to "Details" tab
3. Copy the REST URL and REST Token
4. Add these to your Vercel environment variables

### 3. Test Connection

```typescript
// Test Redis connection
import { redisClient } from '@/lib/redis';

async function testRedis() {
  try {
    await redisClient.set('test', 'value');
    const value = await redisClient.get('test');
    console.log('Redis connection successful:', value);
  } catch (error) {
    console.error('Redis connection failed:', error);
  }
}
```

## Groq API Setup

### 1. Create Groq Account

1. Go to [Groq Console](https://console.groq.com/)
2. Sign up for an account
3. Navigate to API Keys section

### 2. Generate API Key

1. Click "Create API Key"
2. Give it a descriptive name
3. Copy the generated key
4. Add to your Vercel environment variables

### 3. Test API Connection

```typescript
// Test Groq API
import { groqClient } from '@/lib/groq-client';

async function testGroq() {
  try {
    const response = await groqClient.callAgent(
      'Hello, this is a test message',
      {},
      { model: 'llama-3.1-70b-versatile' }
    );
    console.log('Groq API connection successful:', response);
  } catch (error) {
    console.error('Groq API connection failed:', error);
  }
}
```

## Domain Configuration

### 1. Custom Domain (Optional)

1. In Vercel dashboard, go to your project
2. Navigate to "Domains" tab
3. Add your custom domain
4. Follow DNS configuration instructions

### 2. SSL Certificate

Vercel automatically provides SSL certificates for all domains.

## Monitoring and Observability

### 1. Vercel Analytics

Enable Vercel Analytics in your project:

1. Go to project settings
2. Navigate to "Analytics" tab
3. Enable Web Analytics
4. Add to your `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
}

module.exports = nextConfig
```

### 2. Error Monitoring

Add Sentry for error monitoring:

```bash
npm install @sentry/nextjs
```

```javascript
// sentry.client.config.js
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
```

### 3. Performance Monitoring

Add performance monitoring:

```typescript
// lib/monitoring.ts
export function trackPerformance(name: string, duration: number) {
  if (typeof window !== 'undefined' && 'performance' in window) {
    window.performance.mark(`${name}-end`);
    window.performance.measure(name, `${name}-start`, `${name}-end`);
  }
}
```

## Database Considerations

### For Demo/Development

The current implementation uses in-memory storage with Redis for temporary data. This is suitable for demos but not for production.

### For Production

Consider these options:

1. **Vercel Postgres** - Fully managed PostgreSQL
2. **PlanetScale** - MySQL-compatible database
3. **Supabase** - PostgreSQL with real-time features
4. **MongoDB Atlas** - Document database

Example with Vercel Postgres:

```typescript
// lib/database.ts
import { sql } from '@vercel/postgres';

export async function createWorkflow(workflow: Workflow) {
  const { rows } = await sql`
    INSERT INTO workflows (id, name, description, nodes, edges, metadata)
    VALUES (${workflow.id}, ${workflow.name}, ${workflow.description}, 
            ${JSON.stringify(workflow.nodes)}, ${JSON.stringify(workflow.edges)}, 
            ${JSON.stringify(workflow.metadata)})
    RETURNING *
  `;
  return rows[0];
}
```

## Security Considerations

### 1. API Rate Limiting

Implement rate limiting:

```typescript
// lib/rate-limit.ts
import { NextRequest } from 'next/server';

const rateLimit = new Map();

export function rateLimitMiddleware(request: NextRequest) {
  const ip = request.ip || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100;

  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  const userLimit = rateLimit.get(ip);
  
  if (now > userLimit.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (userLimit.count >= maxRequests) {
    return false;
  }

  userLimit.count++;
  return true;
}
```

### 2. Input Validation

Always validate inputs:

```typescript
// lib/validation.ts
import { z } from 'zod';

export const WorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  nodes: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(['trigger', 'action', 'agent', 'human-approval', 'condition', 'loop', 'spawn-agent']),
    data: z.object({
      label: z.string().min(1).max(100),
      config: z.record(z.any())
    }),
    position: z.object({
      x: z.number(),
      y: z.number()
    })
  })),
  edges: z.array(z.object({
    id: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
    condition: z.string().optional()
  }))
});
```

### 3. CORS Configuration

Configure CORS properly:

```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.ALLOWED_ORIGINS || '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

## Scaling Considerations

### 1. Serverless Functions

Vercel automatically scales serverless functions, but consider:

- Function timeout limits (10 seconds for Hobby, 60 seconds for Pro)
- Memory limits (1024 MB for Hobby, 3008 MB for Pro)
- Cold start times

### 2. Redis Scaling

Upstash Redis scales automatically, but monitor:

- Memory usage
- Connection limits
- Request limits

### 3. Database Scaling

For production, consider:

- Read replicas for read-heavy workloads
- Connection pooling
- Query optimization
- Caching strategies

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check environment variables
   - Verify TypeScript compilation
   - Check for missing dependencies

2. **Runtime Errors**
   - Check Vercel function logs
   - Verify API keys and credentials
   - Check Redis connection

3. **Performance Issues**
   - Monitor function execution times
   - Check Redis latency
   - Optimize database queries

### Debugging

1. **Local Development**
   ```bash
   npm run dev
   # Check browser console and terminal logs
   ```

2. **Production Debugging**
   - Use Vercel dashboard logs
   - Add structured logging
   - Use error monitoring tools

### Support

- Vercel Documentation: https://vercel.com/docs
- Upstash Documentation: https://docs.upstash.com/
- Groq Documentation: https://console.groq.com/docs

## Maintenance

### 1. Regular Updates

- Keep dependencies updated
- Monitor security advisories
- Update API keys regularly

### 2. Monitoring

- Set up alerts for errors
- Monitor performance metrics
- Track usage patterns

### 3. Backup

- Backup workflow definitions
- Export execution logs
- Document custom configurations

## Cost Optimization

### 1. Vercel Pricing

- Hobby: Free tier available
- Pro: $20/month per member
- Enterprise: Custom pricing

### 2. Upstash Pricing

- Free tier: 10,000 requests/day
- Pay-as-you-go: $0.2 per 100K requests

### 3. Groq Pricing

- Free tier: 14,400 requests/day
- Pay-as-you-go: $0.59 per 1M tokens

### 4. Optimization Tips

- Use caching effectively
- Optimize function execution time
- Monitor and limit API calls
- Use appropriate database tiers
