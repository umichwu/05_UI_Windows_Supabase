# 🚀 Production Deployment Guide

## Quick Deployment with Vercel (Recommended)

### Prerequisites
- Git repository with your code
- Production Supabase project
- Vercel account (free tier available)

### 1. Prepare Production Supabase

**Create Production Database:**
```bash
# 1. Create new Supabase project for production
# 2. Run these SQL scripts in order:
# - supabase_chat_pro.sql
# - automatic-summary-system.sql
# - add-indexes-fixed.sql
# - add-rls-policies.sql

# 3. Configure Authentication:
# - Enable Email provider
# - Add your domain to allowed origins
# - Set up Google OAuth (if needed)

# 4. Configure Storage:
# - Bucket 'chat-attachments' should be public
# - Verify RLS policies on storage.objects
```

### 2. Deploy to Vercel

**Option A: GitHub Integration (Recommended)**
1. Push code to GitHub repository
2. Go to [vercel.com](https://vercel.com) → "New Project"
3. Import your GitHub repository
4. Vercel auto-detects Next.js settings
5. Click "Deploy"

**Option B: Vercel CLI**
```bash
# Install Vercel CLI globally
npm i -g vercel

# Deploy from project directory
vercel

# Follow interactive prompts:
# ? Set up and deploy "~/your-project"? [Y/n] y
# ? Which scope do you want to deploy to? [Your Account]
# ? Link to existing project? [y/N] n
# ? What's your project's name? chat-ui-beta
# ? In which directory is your code located? ./
```

### 3. Configure Environment Variables

In Vercel Dashboard → Project → Settings → Environment Variables:

```env
# Required - Production Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key

# Set to outbox mode for production
NEXT_PUBLIC_DEV_MODE=outbox

# Optional - For dev mode LLM calls
OPENAI_API_KEY=sk-your-production-key
ANTHROPIC_API_KEY=sk-ant-your-production-key
```

**Important:** After adding environment variables, redeploy the project.

### 4. Custom Domain Setup (Optional)

**Add Custom Domain:**
1. Vercel Dashboard → Project → Domains
2. Add domain (e.g., `beta-chat.yourdomain.com`)
3. Update DNS records as instructed by Vercel
4. SSL certificate is automatically provisioned

### 5. Test Production Deployment

**Verify Core Functions:**
- [ ] User registration/login works
- [ ] Can create conversations
- [ ] Messages send successfully (outbox mode)
- [ ] File uploads work
- [ ] Summaries can be requested
- [ ] Admin tools accessible

**Check Performance:**
- [ ] Page load times are reasonable
- [ ] Real-time updates work
- [ ] File uploads/downloads work
- [ ] Mobile responsiveness

### 6. Monitor and Maintain

**Vercel Analytics:**
- Enable Vercel Analytics for usage insights
- Monitor Core Web Vitals
- Track error rates

**Supabase Monitoring:**
- Check database performance
- Monitor API usage
- Watch for RLS policy violations

## Alternative Deployment Options

### Netlify Deployment

```bash
# Build the application
npm run build

# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=.next

# Set environment variables in Netlify dashboard
```

### Docker Deployment

**Create Dockerfile:**
```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Build the app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
```

**Deploy with Docker:**
```bash
# Build image
docker build -t chat-ui-beta .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=your_url \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
  -e NEXT_PUBLIC_DEV_MODE=outbox \
  -d chat-ui-beta
```

## Environment-Specific Configuration

### Development vs Production

**Development (.env.local):**
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=dev_key
NEXT_PUBLIC_DEV_MODE=dev
```

**Production (Vercel Environment Variables):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=prod_key
NEXT_PUBLIC_DEV_MODE=outbox
```

## Security Considerations

### Authentication Setup
- Set correct redirect URLs in Supabase Auth
- Configure site URL to your production domain
- Enable appropriate OAuth providers

### Database Security
- Verify all RLS policies are active in production
- Test that users can't access each other's data
- Ensure storage bucket permissions are correct

### API Keys
- Use different API keys for production
- Store sensitive keys in environment variables only
- Never commit API keys to version control

## Troubleshooting

### Common Issues

**1. Build Failures**
```bash
# Test build locally first
npm run build

# Check for TypeScript errors
npx tsc --noEmit

# Check for linting issues
npm run lint
```

**2. Environment Variable Issues**
- Remember to redeploy after adding environment variables
- Check spelling and format of variable names
- Verify Supabase URL and keys are correct

**3. Database Connection Issues**
- Verify production Supabase project is set up correctly
- Check that all SQL scripts have been run
- Ensure RLS policies allow proper access

**4. Authentication Issues**
- Add production domain to Supabase Auth allowed origins
- Verify redirect URLs are correctly configured
- Check that email templates work in production

### Performance Optimization

**Next.js Optimizations:**
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // For Docker deployments
  compress: true,
  images: {
    domains: ['your-supabase-project.supabase.co'],
  },
  experimental: {
    serverActions: true,
  },
}

module.exports = nextConfig
```

## Customer Testing Setup

### Beta User Management

**Create Test Accounts:**
1. Set up email accounts for beta testers
2. Or enable Google OAuth for easy signup
3. Create test conversations and data

**Feature Flags:**
```typescript
// lib/feature-flags.ts
export const BETA_FEATURES = {
  autoSummaries: true,
  memoryPanel: true,
  devTools: false, // Hide from customers
}
```

### Feedback Collection

**Add Feedback System:**
- Implement feedback collection UI
- Store feedback in database
- Set up email notifications for new feedback

### Monitoring Beta Usage

**Analytics Setup:**
- Enable Vercel Analytics
- Set up Supabase Analytics
- Monitor error rates and performance
- Track feature usage patterns

## Success Checklist

Before sharing with customers:

- [ ] ✅ Production deployment successful
- [ ] ✅ Custom domain configured (optional)
- [ ] ✅ All environment variables set correctly
- [ ] ✅ Database and auth working properly
- [ ] ✅ File uploads/downloads functional
- [ ] ✅ Real-time updates working
- [ ] ✅ Mobile-responsive design tested
- [ ] ✅ Error handling and user feedback working
- [ ] ✅ Performance acceptable (< 3s load time)
- [ ] ✅ Security verified (RLS policies active)

Your production chat UI is now ready for customer beta testing! 🎉