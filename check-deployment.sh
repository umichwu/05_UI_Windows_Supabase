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
