#!/bin/bash

# Face Recognition + Emotion Detection Test Scripts
# Make sure both Next.js (port 3001) and FastAPI (port 8000) services are running

echo "🔬 Testing Face Recognition System..."
echo

# Test 1: Health Check
echo "1️⃣ Testing API Health Check..."
curl -s http://localhost:8000/ | jq '.'
echo

# Test 2: Emotion Analysis (you need to provide a test image)
echo "2️⃣ Testing Emotion Analysis..."
# Uncomment and modify the path to your test image:
# curl -X POST http://localhost:8000/analyze -F "image=@test_face.jpg" | jq '.'
echo "⚠️  Please provide a test image file and uncomment the curl command above"
echo

# Test 3: Face Enrollment (requires test images)
echo "3️⃣ Testing Face Enrollment..."
# curl -X POST http://localhost:8000/enroll \
#   -F "label=Test User" \
#   -F "images=@face1.jpg" \
#   -F "images=@face2.jpg" \
#   -F "images=@face3.jpg" | jq '.'
echo "⚠️  Please provide 3-5 face images and uncomment the curl command above"
echo

# Test 4: Face Recognition
echo "4️⃣ Testing Face Recognition..."
# curl -X POST http://localhost:8000/recognize -F "image=@test_face.jpg" | jq '.'
echo "⚠️  Please provide a test image and uncomment the curl command above"
echo

# Test 5: Next.js API Routes
echo "5️⃣ Testing Next.js API Routes..."
echo "Testing /api/face/analyze (mock mode):"
# You can test with a real image file:
# curl -X POST http://localhost:3001/api/face/analyze -F "image=@test_face.jpg" | jq '.'
echo "⚠️  Provide test image or service will return mock data"
echo

# Test 6: Database Queries
echo "6️⃣ Testing Database Queries..."
echo "Recent face events:"
# psql $DATABASE_URL -c "SELECT id, recognized_user_id, dominant_emotion, confidence, frame_ts FROM app.face_events ORDER BY frame_ts DESC LIMIT 5;"
echo "⚠️  Run the above psql command with your DATABASE_URL"
echo

# Test 7: Care Rules
echo "7️⃣ Testing Care Rules..."
echo "Active care rules:"
# psql $DATABASE_URL -c "SELECT name, target_emotions, window_sec, min_ratio, active FROM app.care_rules WHERE active = true;"
echo "⚠️  Run the above psql command with your DATABASE_URL"
echo

echo "🎯 Test URLs for Manual Testing:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "• Face Recognition Page: http://localhost:3001/face-recognition"
echo "• Demo Panels: http://localhost:3001/demo-panels"
echo "• FastAPI Docs: http://localhost:8000/docs"
echo "• FastAPI Health: http://localhost:8000/"
echo

echo "📋 Manual Testing Checklist:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "□ Camera permission granted"
echo "□ Face enrollment with 3-5 images"
echo "□ Real-time face recognition working"
echo "□ Emotion detection displaying correctly"
echo "□ Care rules can be created/modified"
echo "□ Mood trends showing data"
echo "□ Incidents can be marked as resolved"
echo "□ Database triggers firing correctly"
echo

echo "🚀 Production Deployment Commands:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "# Build Next.js app:"
echo "npm run build"
echo
echo "# Deploy to Vercel:"
echo "vercel --prod"
echo
echo "# Build and run Docker container:"
echo "cd face-api"
echo "docker build -t deepface-api ."
echo "docker run -p 8000:8000 --env-file .env deepface-api"
echo

echo "✅ Face Recognition System Test Script Complete!"
echo "Run individual curl commands with your test images to verify functionality."