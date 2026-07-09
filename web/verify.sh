#!/bin/bash
# Verification script - Check if ArborWallet backend is properly set up

set -e

echo "🔍 ArborWallet Backend Verification"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for issues
ISSUES=0

# 1. Check Node.js
echo "1️⃣  Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js found: $NODE_VERSION"
else
    echo -e "${RED}✗${NC} Node.js not found. Install from https://nodejs.org/"
    ISSUES=$((ISSUES + 1))
fi

echo ""

# 2. Check npm
echo "2️⃣  Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm found: $NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm not found"
    ISSUES=$((ISSUES + 1))
fi

echo ""

# 3. Check if dependencies are installed
echo "3️⃣  Checking dependencies..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules directory exists"
    
    # Check for key packages
    if grep -q "@prisma/client" package.json; then
        echo -e "${GREEN}✓${NC} Prisma dependency found in package.json"
    else
        echo -e "${YELLOW}⚠${NC} Prisma not in package.json (needs npm install)"
        ISSUES=$((ISSUES + 1))
    fi
    
    if grep -q "@magic-sdk" package.json; then
        echo -e "${GREEN}✓${NC} Magic SDK dependency found in package.json"
    else
        echo -e "${YELLOW}⚠${NC} Magic SDK not in package.json (needs npm install)"
        ISSUES=$((ISSUES + 1))
    fi
else
    echo -e "${RED}✗${NC} node_modules not found. Run: npm install"
    ISSUES=$((ISSUES + 1))
fi

echo ""

# 4. Check Prisma schema
echo "4️⃣  Checking Prisma schema..."
if [ -f "schema.prisma" ]; then
    echo -e "${GREEN}✓${NC} schema.prisma found"
else
    echo -e "${RED}✗${NC} schema.prisma not found"
    ISSUES=$((ISSUES + 1))
fi

echo ""

# 5. Check environment file
echo "5️⃣  Checking environment variables..."
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✓${NC} .env.local exists"
    
    if grep -q "DATABASE_URL" .env.local; then
        echo -e "${GREEN}✓${NC} DATABASE_URL configured"
    else
        echo -e "${RED}✗${NC} DATABASE_URL missing from .env.local"
        ISSUES=$((ISSUES + 1))
    fi
    
    if grep -q "MAGIC_SECRET_KEY" .env.local; then
        MAGIC_SECRET=$(grep "MAGIC_SECRET_KEY" .env.local | cut -d'=' -f2)
        if [ -z "$MAGIC_SECRET" ] || [ "$MAGIC_SECRET" = "sk_live_YOUR_KEY_HERE" ]; then
            echo -e "${YELLOW}⚠${NC} MAGIC_SECRET_KEY not configured"
            ISSUES=$((ISSUES + 1))
        else
            echo -e "${GREEN}✓${NC} MAGIC_SECRET_KEY configured"
        fi
    else
        echo -e "${RED}✗${NC} MAGIC_SECRET_KEY missing from .env.local"
        ISSUES=$((ISSUES + 1))
    fi
    
    if grep -q "NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY" .env.local; then
        MAGIC_PUBLIC=$(grep "NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY" .env.local | cut -d'=' -f2)
        if [ -z "$MAGIC_PUBLIC" ] || [ "$MAGIC_PUBLIC" = "pk_live_YOUR_KEY_HERE" ]; then
            echo -e "${YELLOW}⚠${NC} NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY not configured"
            ISSUES=$((ISSUES + 1))
        else
            echo -e "${GREEN}✓${NC} NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY configured"
        fi
    else
        echo -e "${RED}✗${NC} NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY missing from .env.local"
        ISSUES=$((ISSUES + 1))
    fi
else
    echo -e "${YELLOW}⚠${NC} .env.local not found"
    if [ -f ".env.local.example" ]; then
        echo -e "${YELLOW}   Run: cp .env.local.example .env.local${NC}"
    fi
    ISSUES=$((ISSUES + 1))
fi

echo ""

# 6. Check API routes
echo "6️⃣  Checking API routes..."
API_ROUTES=(
    "src/app/api/auth/login/route.ts"
    "src/app/api/auth/link-social/route.ts"
    "src/app/api/users/me/route.ts"
    "src/app/api/partitions/route.ts"
    "src/app/api/transactions/route.ts"
    "src/app/api/fund-requests/route.ts"
)

FOUND_ROUTES=0
for route in "${API_ROUTES[@]}"; do
    if [ -f "$route" ]; then
        FOUND_ROUTES=$((FOUND_ROUTES + 1))
    else
        echo -e "${RED}✗${NC} Missing: $route"
        ISSUES=$((ISSUES + 1))
    fi
done

echo -e "${GREEN}✓${NC} Found $FOUND_ROUTES/6 API routes"

echo ""

# 7. Check library files
echo "7️⃣  Checking library files..."
LIB_FILES=(
    "src/lib/db.ts"
    "src/lib/auth.ts"
    "src/lib/AuthContext.tsx"
    "src/lib/useApi.ts"
)

FOUND_LIBS=0
for lib in "${LIB_FILES[@]}"; do
    if [ -f "$lib" ]; then
        FOUND_LIBS=$((FOUND_LIBS + 1))
    else
        echo -e "${RED}✗${NC} Missing: $lib"
        ISSUES=$((ISSUES + 1))
    fi
done

echo -e "${GREEN}✓${NC} Found $FOUND_LIBS/4 library files"

echo ""

# 8. Check component files
echo "8️⃣  Checking component files..."
if [ -f "src/components/MagicLoginComponent.tsx" ]; then
    echo -e "${GREEN}✓${NC} MagicLoginComponent found"
else
    echo -e "${RED}✗${NC} MagicLoginComponent not found"
    ISSUES=$((ISSUES + 1))
fi

echo ""

# 9. Check documentation
echo "9️⃣  Checking documentation..."
DOCS=(
    "BACKEND_SETUP.md"
    "FRONTEND_INTEGRATION.md"
    "SETUP_CHECKLIST.md"
    "ARCHITECTURE.md"
    "IMPLEMENTATION_SUMMARY.md"
    "README_IMPLEMENTATION.md"
)

FOUND_DOCS=0
for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        FOUND_DOCS=$((FOUND_DOCS + 1))
    else
        echo -e "${RED}✗${NC} Missing: $doc"
    fi
done

echo -e "${GREEN}✓${NC} Found $FOUND_DOCS/${#DOCS[@]} documentation files"

echo ""

# 10. Test database connection (if psql available)
echo "🔟 Testing database connection..."
if command -v psql &> /dev/null; then
    if grep -q "DATABASE_URL" .env.local; then
        DB_URL=$(grep "DATABASE_URL" .env.local | cut -d'=' -f2 | tr -d '"')
        
        # Extract connection details
        DB_HOST=$(echo "$DB_URL" | sed -n 's/.*@\([^:]*\).*/\1/p')
        DB_USER=$(echo "$DB_URL" | sed -n 's/postgresql:\/\/\([^:]*\).*/\1/p')
        DB_NAME=$(echo "$DB_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
        
        if psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &> /dev/null; then
            echo -e "${GREEN}✓${NC} PostgreSQL connection successful"
        else
            echo -e "${RED}✗${NC} PostgreSQL connection failed"
            echo -e "   Check DATABASE_URL in .env.local"
            ISSUES=$((ISSUES + 1))
        fi
    fi
else
    echo -e "${YELLOW}⚠${NC} psql not found (optional, can skip)"
fi

echo ""
echo "=================================="

# Summary
if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. npm run dev"
    echo "2. Visit http://localhost:3000"
    echo "3. Test the login flow"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Found $ISSUES issue(s)${NC}"
    echo ""
    echo "Please fix the above issues before running:"
    echo "  npm run dev"
    echo ""
    exit 1
fi
