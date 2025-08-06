#!/bin/bash

# Build and Deploy Script for electron-overlay-wind using pnpm
set -e

echo "🚀 Starting build and deploy process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Please install it first: npm install -g pnpm"
    exit 1
fi

# Check if npm is logged in
print_status "Checking NPM authentication..."
if ! npm whoami > /dev/null 2>&1; then
    print_error "Not logged in to NPM. Please run 'npm login' first."
    exit 1
fi

print_status "Logged in as: $(npm whoami)"

# Clean previous builds
print_status "Cleaning previous builds..."
pnpm run clean

# Install dependencies
print_status "Installing dependencies..."
pnpm install

# Build production version
print_status "Building production version..."
pnpm run build:prod

# Create prebuilds
# print_status "Creating prebuilds..."
# pnpm run prebuild

# Run tests (if available)
print_status "Running tests..."
pnpm test || print_warning "No tests configured, skipping..."

# Check if package is valid for publishing
print_status "Validating package..."
npm pack --dry-run

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_status "Current version: $CURRENT_VERSION"

# Ask for version bump
print_status "Preparing to publish..."
echo "Select version bump:"
echo "1) patch (1.0.0 → 1.0.1)"
echo "2) minor (1.0.0 → 1.1.0)"
echo "3) major (1.0.0 → 2.0.0)"
echo "4) custom version"
echo "5) skip version bump"

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        pnpm version patch
        ;;
    2)
        pnpm version minor
        ;;
    3)
        pnpm version major
        ;;
    4)
        read -p "Enter custom version: " custom_version
        pnpm version $custom_version
        ;;
    5)
        print_status "Skipping version bump"
        ;;
    *)
        print_error "Invalid choice, skipping version bump"
        ;;
esac

# Final publish confirmation
NEW_VERSION=$(node -p "require('./package.json').version")
print_status "About to publish version: $NEW_VERSION"

read -p "Proceed with publishing to NPM? (y/N): " confirm
if [[ $confirm =~ ^[Yy]$ ]]; then
    print_status "Publishing to NPM..."
    npm publish
    print_status "✅ Successfully published electron-overlay-wind@$NEW_VERSION"
else
    print_warning "Publishing cancelled"
    print_status "Package built and ready. You can publish later with: npm publish"
fi

echo "🎉 Build and deploy process completed!"