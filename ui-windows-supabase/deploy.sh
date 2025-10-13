#!/bin/bash

# 🚀 Quick Deployment Script for Chat UI Beta
# This script helps deploy your Next.js app to production

set -e  # Exit on any error

echo "🚀 Chat UI Beta - Deployment Script"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from your project root."
    exit 1
fi

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Error: This is not a git repository. Initialize git first:"
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m 'Initial commit'"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm is not installed. Please install npm and try again."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run build test
echo "🔧 Testing production build..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix the errors and try again."
    exit 1
fi

echo "✅ Build test successful"

# Deployment options menu
echo ""
echo "🌐 Choose deployment option:"
echo "1) Vercel (Recommended)"
echo "2) Netlify"
echo "3) Docker Build"
echo "4) Exit"

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo "🚀 Deploying to Vercel..."

        if ! command_exists vercel; then
            echo "📦 Installing Vercel CLI..."
            npm install -g vercel
        fi

        echo "🔧 Starting Vercel deployment..."
        echo "ℹ️  You'll need to configure these environment variables in Vercel Dashboard:"
        echo "   - NEXT_PUBLIC_SUPABASE_URL"
        echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
        echo "   - NEXT_PUBLIC_DEV_MODE=outbox"
        echo "   - OPENAI_API_KEY (optional)"
        echo ""

        vercel --prod

        echo "✅ Vercel deployment completed!"
        echo "📝 Don't forget to set environment variables in Vercel Dashboard"
        ;;

    2)
        echo "🚀 Deploying to Netlify..."

        if ! command_exists netlify; then
            echo "📦 Installing Netlify CLI..."
            npm install -g netlify-cli
        fi

        echo "🔧 Building for Netlify..."
        npm run build

        echo "🔧 Starting Netlify deployment..."
        netlify deploy --prod --dir=.next

        echo "✅ Netlify deployment completed!"
        echo "📝 Don't forget to set environment variables in Netlify Dashboard"
        ;;

    3)
        echo "🐳 Building Docker image..."

        if ! command_exists docker; then
            echo "❌ Docker is not installed. Please install Docker and try again."
            exit 1
        fi

        # Create Dockerfile if it doesn't exist
        if [ ! -f "Dockerfile" ]; then
            echo "📝 Creating Dockerfile..."
            cat > Dockerfile << 'EOF'
FROM node:18-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

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
EOF
        fi

        # Create .dockerignore if it doesn't exist
        if [ ! -f ".dockerignore" ]; then
            echo "📝 Creating .dockerignore..."
            cat > .dockerignore << 'EOF'
Dockerfile
.dockerignore
node_modules
npm-debug.log
README.md
.env
.env.local
.env.production.local
.env.staging.local
.next
.git
EOF
        fi

        echo "🔧 Building Docker image..."
        docker build -t chat-ui-beta .

        echo "✅ Docker image built successfully!"
        echo "🐳 To run the container:"
        echo "   docker run -p 3000:3000 \\"
        echo "     -e NEXT_PUBLIC_SUPABASE_URL=your_url \\"
        echo "     -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \\"
        echo "     -e NEXT_PUBLIC_DEV_MODE=outbox \\"
        echo "     -d chat-ui-beta"
        ;;

    4)
        echo "👋 Deployment cancelled."
        exit 0
        ;;

    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment process completed!"
echo "📚 For more details, check DEPLOYMENT_GUIDE.md"
echo ""
echo "⚠️  Important reminders:"
echo "   1. Set up production Supabase project"
echo "   2. Configure environment variables"
echo "   3. Test the deployed application"
echo "   4. Set up custom domain (optional)"
echo ""
echo "🔗 Useful links:"
echo "   - Vercel Dashboard: https://vercel.com/dashboard"
echo "   - Netlify Dashboard: https://app.netlify.com/"
echo "   - Supabase Dashboard: https://app.supabase.com/"