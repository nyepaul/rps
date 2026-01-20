#!/bin/bash
echo "=== Testing Authentication Endpoints ==="
echo ""

echo "1. Testing Registration (should fail - admin exists)..."
curl -s -X POST http://localhost:5137/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"test@example.com","password":"Test123456"}'
echo -e "\n"

echo "2. Testing Registration (new user)..."
curl -s -X POST http://localhost:5137/api/auth/register \
  -H "Content-Type: application/json" \
  -c /tmp/cookies.txt \
  -d '{"username":"testuser","email":"test@example.com","password":"Test123456"}'
echo -e "\n"

echo "3. Testing Session Check (should be authenticated)..."
curl -s http://localhost:5137/api/auth/session -b /tmp/cookies.txt
echo -e "\n"

echo "4. Testing Logout..."
curl -s -X POST http://localhost:5137/api/auth/logout -b /tmp/cookies.txt
echo -e "\n"

echo "5. Testing Session Check (should NOT be authenticated)..."
curl -s http://localhost:5137/api/auth/session -b /tmp/cookies.txt
echo -e "\n"

echo "6. Testing Login with admin..."
curl -s -X POST http://localhost:5137/api/auth/login \
  -H "Content-Type: application/json" \
  -c /tmp/cookies.txt \
  -d '{"username":"admin","password":"Admin123"}'
echo -e "\n"

echo "7. Testing Session Check (should be authenticated as admin)..."
curl -s http://localhost:5137/api/auth/session -b /tmp/cookies.txt
echo -e "\n"

echo "8. Testing invalid login..."
curl -s -X POST http://localhost:5137/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"WrongPassword"}'
echo -e "\n"
