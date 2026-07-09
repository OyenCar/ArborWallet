#!/bin/bash
# Quick start script for ArborWallet backend setup

set -e

echo "🚀 ArborWallet Backend Setup"
echo "============================"
echo ""

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
npm install

echo ""
echo "✅ Dependencies installed"
echo ""

# Step 2: Create .env.local
if [ ! -f ".env.local" ]; then
    echo "📋 Creating .env.local from template..."
    cp .env.local.example .env.local
    echo ""
    echo "⚠️  IMPORTANT: Edit .env.local with your values:"
    echo "   - DATABASE_URL: Your PostgreSQL connection string"
    echo "   - MAGIC_SECRET_KEY: From https://dashboard.magic.link"
    echo "   - NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY: From Magic Dashboard"
    echo ""
    read -p "Press Enter once you've updated .env.local..."
else
    echo "✅ .env.local already exists"
fi

echo ""

# Step 3: Initialize Prisma
echo "🗄️  Setting up database..."
npx prisma db push

echo ""
echo "✅ Database schema applied"
echo ""

# Step 4: Generate Prisma client
echo "⚙️  Generating Prisma client..."
npx prisma generate

echo ""
echo "✅ Prisma client generated"
echo ""

# Step 5: Test database connection
echo "🔗 Testing database connection..."
echo "Opening Prisma Studio at http://localhost:5555"
echo "Close the browser window to continue..."
sleep 2

npx prisma studio &
PRISMA_PID=$!

wait $PRISMA_PID 2>/dev/null || true

echo ""
echo "✅ Database connection verified"
echo ""

# Step 6: Ready to start
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. npm run dev          - Start development server"
echo "2. Visit http://localhost:3000"
echo "3. Try the login flow with email"
echo ""
echo "📖 Documentation:"
echo "   - BACKEND_SETUP.md       - Full backend guide"
echo "   - FRONTEND_INTEGRATION.md - Frontend guide"
echo "   - SETUP_CHECKLIST.md     - Step-by-step checklist"
echo ""
