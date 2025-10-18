# Vercel Deployment Troubleshooting Guide

This guide documents common Vercel deployment issues and solutions to help you (and Claude Code) quickly resolve deployment problems.

---

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Common Issues and Solutions](#common-issues-and-solutions)
3. [Debugging Workflow](#debugging-workflow)
4. [Quick Reference Commands](#quick-reference-commands)

---

## Pre-Deployment Checklist

Before asking Claude Code to fix deployment issues, verify these items:

### 1. Repository Structure
- [ ] **All Next.js files are in the repository ROOT** (not in a subdirectory)
- [ ] Check: `package.json`, `next.config.ts`, `tsconfig.json` are at root level
- [ ] Check: `src/` or `app/` directory is at root level
- [ ] **No duplicate directories** (e.g., no old `ui-windows-supabase/` subdirectory)

```bash
# Verify root structure
ls -la
# Should see: package.json, next.config.ts, src/, etc.

# Check for duplicate directories
find . -type d -name "node_modules" -prune -o -name "*.tsx" -print | grep -E "^\.\/[^/]+\/src\/"
# Should return nothing if structure is correct
```

### 2. Vercel Project Settings
- [ ] **Root Directory**: Should be EMPTY (blank) in Vercel project settings
- [ ] **Framework Preset**: Should be "Next.js"
- [ ] **Build Command**: Default (`npm run build`)
- [ ] **Output Directory**: Default (`.next`)

**How to check:**
1. Go to Vercel Dashboard → Your Project → Settings → General
2. Scroll to "Root Directory"
3. If it shows a subdirectory path, **clear it** and save

### 3. Local Build Test
- [ ] Build succeeds locally: `npm run build`
- [ ] No TypeScript errors
- [ ] No missing dependencies

```bash
# Always test locally first
npm install
npm run build
# Should complete without errors
```

---

## Common Issues and Solutions

### Issue 1: 404 Errors on All Pages

**Symptoms:**
- All Vercel URLs return 404 NOT_FOUND
- Build shows success but pages don't load

**Root Causes & Solutions:**

#### A. Wrong Root Directory Setting
```
Problem: Vercel is looking in a subdirectory instead of repository root
Solution: Clear the "Root Directory" setting in Vercel project settings
```

**How to fix:**
1. Vercel Dashboard → Project → Settings → General
2. Find "Root Directory" section
3. Click "Edit" and **clear the field** (leave it blank)
4. Click "Save"
5. Trigger a new deployment

#### B. Files in Wrong Location
```
Problem: Next.js files are in a subdirectory (e.g., `ui-windows-supabase/`)
Solution: Move all files to repository root
```

**How to fix:**
```bash
# If files are in a subdirectory, move them to root
mv subdirectory/* .
mv subdirectory/.* . 2>/dev/null || true

# Remove the old subdirectory from git
git rm -rf subdirectory/
git commit -m "Move files to root directory"
git push
```

#### C. Old Subdirectory Still Exists
```
Problem: Vercel finds and builds from an old subdirectory instead of root
Solution: Completely remove old subdirectories from repository
```

**How to fix:**
```bash
# Remove old subdirectory completely
git rm -rf old-subdirectory/
rm -rf old-subdirectory/  # Remove from filesystem too

git commit -m "Remove old subdirectory"
git push
```

### Issue 2: Build Fails with Module Errors

**Symptoms:**
- `Module not found: Can't resolve 'package-name'`
- Build fails during compilation

**Root Causes & Solutions:**

#### A. Missing Dependencies
```
Problem: Package listed in package.json but not installed
Solution: Install dependencies
```

**How to fix:**
```bash
# Delete and reinstall
rm -rf node_modules package-lock.json
npm install

# Test build
npm run build
```

#### B. Incompatible Package Versions
```
Problem: Package (like recharts) incompatible with Next.js 15+
Solution: Test locally, consider alternatives or workarounds
```

**How to fix:**
```bash
# Check if package builds locally
npm run build

# If it fails, check package compatibility
# Option 1: Try a different version
npm install package-name@specific-version

# Option 2: Temporarily remove if not critical
# Remove from package.json, then:
npm install
npm run build
```

### Issue 3: Vercel Deploys Old Commits

**Symptoms:**
- Latest code is on GitHub but Vercel builds an old commit
- Vercel build log shows wrong commit hash

**Root Causes & Solutions:**

#### A. Webhook Not Triggering
```
Problem: GitHub webhook not sending updates to Vercel
Solution: Reconnect GitHub integration
```

**How to fix:**
1. Vercel Dashboard → Project → Settings → Git
2. Click "Disconnect" under GitHub connection
3. Click "Connect Git Repository" and reconnect
4. Trigger manual redeploy or push a new commit

#### B. Cached Deployment
```
Problem: Vercel using cached build from previous deployment
Solution: Delete and recreate project (last resort)
```

**How to fix:**
1. Vercel Dashboard → Project → Settings → General
2. Scroll to bottom → "Delete Project"
3. Create new project and connect to GitHub repository
4. Ensure "Root Directory" is blank
5. Deploy

### Issue 4: Build Configuration Issues

**Symptoms:**
- `outputFileTracingRoot` errors
- Build can't find files

**Root Causes & Solutions:**

#### A. Wrong next.config.ts Settings
```
Problem: Config points to wrong directory structure
Solution: Use minimal config for standard setup
```

**Correct next.config.ts for root-level project:**
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
```

**Remove these if present (only needed for monorepos):**
- `outputFileTracingRoot`
- Custom `distDir`
- Custom `basePath` (unless intentional)

#### B. Incorrect vercel.json
```
Problem: vercel.json overriding correct settings
Solution: Use minimal config or remove file
```

**Minimal vercel.json (optional):**
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs"
}
```

**Or remove vercel.json entirely** - Vercel auto-detects Next.js

---

## Debugging Workflow

When deployment fails, follow this systematic approach:

### Step 1: Verify Local Build (2 minutes)
```bash
npm install
npm run build
```
- If this fails, fix locally first before pushing
- Vercel will fail for the same reasons

### Step 2: Check Repository Structure (1 minute)
```bash
# Ensure files are at root
ls package.json next.config.ts src/
# Should show files, not "No such file"

# Check for duplicate directories
find . -name "src" -type d
# Should show only ONE: ./src
```

### Step 3: Review Vercel Build Log (2 minutes)
1. Vercel Dashboard → Project → Deployments → Click latest
2. Look for:
   - **Commit hash**: Is it the latest?
   - **Build command**: Is it correct? (`next build`)
   - **Error messages**: Note the exact error
   - **File paths in errors**: Are they looking in wrong directory?

### Step 4: Check Vercel Settings (1 minute)
1. Settings → General → Root Directory: Should be **blank**
2. Settings → General → Framework Preset: Should be **Next.js**
3. Settings → Git: Verify correct repository connected

### Step 5: Test Deployment (5 minutes)
```bash
# Simplify to minimal test (if needed)
# 1. Create simple test page
echo "export default function Test() { return <div>Test</div> }" > src/app/test/page.tsx

# 2. Build locally
npm run build

# 3. Commit and push
git add .
git commit -m "Add test page"
git push

# 4. Check Vercel deployment
```

---

## Quick Reference Commands

### Local Development
```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Check for type errors
npx tsc --noEmit
```

### Git Commands
```bash
# Check current status
git status

# See recent commits
git log --oneline -5

# Remove directory from git (but keep locally)
git rm -r --cached directory/

# Remove directory completely
git rm -rf directory/

# Commit and push
git add .
git commit -m "Description"
git push origin main
```

### Vercel CLI (Optional)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from command line
vercel

# Check deployment logs
vercel logs

# Link to project
vercel link
```

### Debugging Commands
```bash
# Find duplicate directories
find . -type d -name "src" | grep -v node_modules

# Check package installation
npm ls package-name

# Verify Next.js version
npm ls next

# Clear Next.js cache
rm -rf .next

# Clear node modules and reinstall
rm -rf node_modules package-lock.json && npm install
```

---

## Claude Code Instructions

When asking Claude Code to fix Vercel deployment issues, provide:

### Essential Information
1. **Error message** from Vercel build log (copy full error)
2. **Deployment URL** that's failing
3. **Expected behavior** (what should happen)
4. **Repository structure** (output of `ls -la`)
5. **Recent changes** (what was modified before it broke)

### Effective Prompt Template
```
I'm having a Vercel deployment issue:

ERROR: [paste exact error from Vercel build log]

DEPLOYMENT URL: https://your-project.vercel.app

EXPECTED: [What should work]

REPOSITORY STRUCTURE:
[paste output of: ls -la]

RECENT CHANGES:
- [what you changed recently]

Please help diagnose and fix this issue. Start by checking:
1. Repository structure (files at root?)
2. Vercel Root Directory setting
3. Local build success
```

### Things Claude Should Check First
1. ✅ Are Next.js files at repository root?
2. ✅ Does `npm run build` work locally?
3. ✅ Are there duplicate directories (old subdirectories)?
4. ✅ Is package.json at root level?
5. ✅ Is Vercel "Root Directory" setting blank?

### Things to Avoid
1. ❌ Don't create complex vercel.json configs - keep it minimal
2. ❌ Don't modify next.config.ts unless necessary
3. ❌ Don't push directly to GitHub without local testing
4. ❌ Don't add custom build commands unless needed
5. ❌ Don't use subdirectories for standard Next.js projects

---

## Success Checklist

Your deployment should work if:

- [x] `npm run build` succeeds locally
- [x] All Next.js files are at repository root
- [x] No old subdirectories exist in repository
- [x] Vercel "Root Directory" setting is blank
- [x] Vercel builds the latest commit hash
- [x] No TypeScript errors in build log
- [x] All dependencies are in package.json

If all boxes are checked and it still fails, check:
1. Vercel service status: https://www.vercel-status.com/
2. Next.js compatibility: https://nextjs.org/docs
3. Environment variables (if using Supabase, APIs, etc.)

---

## Common Patterns We Learned

### Pattern 1: "It worked before, now it doesn't"
**Usually means:** Repository structure changed or Vercel settings changed
**First check:** Repository root structure and Vercel Root Directory setting

### Pattern 2: "Local works, Vercel fails"
**Usually means:** Missing environment variables or dependency version mismatch
**First check:** Vercel environment variables and Node.js version

### Pattern 3: "Builds succeed but 404 errors"
**Usually means:** Wrong Root Directory setting or files in subdirectory
**First check:** Vercel Root Directory setting (should be blank)

### Pattern 4: "Module not found: package-name"
**Usually means:** Package not in package.json or install failed
**First check:** Is package listed in package.json? Run `npm install`

---

## Time-Saving Tips

1. **Always test `npm run build` locally first** (saves 5-10 min per deployment)
2. **Keep repository structure simple** (everything at root)
3. **Use minimal configs** (default settings work best)
4. **Check Vercel build logs immediately** (shows exact problem)
5. **One change at a time** (easier to identify what broke)

---

## Document Version
- **Created:** 2025-10-18
- **Based on:** Real deployment debugging session
- **Project:** 05_UI_Windows_Supabase
- **Next.js Version:** 15.5.2
- **Key Issue Resolved:** Old subdirectory causing 404 errors despite correct root files

---

## Quick Diagnostic Script

Save this as `check-deployment.sh`:

```bash
#!/bin/bash
echo "=== Vercel Deployment Diagnostic ==="
echo ""
echo "1. Repository Structure:"
ls -la | grep -E "(package.json|next.config|src|app)" || echo "❌ Missing key files at root"
echo ""
echo "2. Duplicate Directories:"
find . -name "src" -type d | grep -v node_modules
echo ""
echo "3. Build Test:"
npm run build && echo "✅ Build successful" || echo "❌ Build failed"
echo ""
echo "4. Git Status:"
git status --short
echo ""
echo "5. Recent Commits:"
git log --oneline -3
echo ""
echo "=== Instructions ==="
echo "- Verify ONE src directory only"
echo "- Ensure build succeeds"
echo "- Check Vercel Root Directory is BLANK"
```

Run with: `bash check-deployment.sh`

---

*Use this guide as a reference when deployment issues occur. Share it with Claude Code for faster troubleshooting.*
