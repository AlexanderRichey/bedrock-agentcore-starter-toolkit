# Makefile for Bedrock AgentCore StartApp development

.PHONY: help build-frontend sync-static startapp demo clean install-dev test

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

build-frontend: ## Build the frontend React app
	@echo "🔨 Building frontend..."
	cd startapp_ui && npm run build
	@echo "✅ Frontend build complete"

sync-static: ## Sync static files from frontend dist to package
	@echo "🔄 Syncing static files..."
	python scripts/sync_static_files.py
	@echo "✅ Static files synced"

build-and-sync: build-frontend sync-static ## Build frontend and sync static files
	@echo "✅ Build and sync complete"

startapp: sync-static ## Run agentcore startapp command
	@echo "🚀 Starting AgentCore StartApp..."
	agentcore startapp

demo: sync-static ## Run the demo server
	@echo "🎮 Starting demo server..."
	python demo_startapp.py

install-dev: ## Install package in development mode
	@echo "📦 Installing in development mode..."
	pip install -e .
	@echo "✅ Development installation complete"

test-static: ## Test static files functionality
	@echo "🧪 Testing static files..."
	python test_static_simple.py

clean: ## Clean build artifacts
	@echo "🧹 Cleaning up..."
	rm -rf build/
	rm -rf dist/
	rm -rf *.egg-info/
	rm -rf src/*.egg-info/
	find . -name "*.pyc" -delete
	find . -name "__pycache__" -delete
	@echo "✅ Cleanup complete"

package: clean build-frontend sync-static ## Build distributable package
	@echo "📦 Building package..."
	python -m build
	@echo "✅ Package built in dist/"

# Development workflow shortcuts
dev: build-and-sync startapp ## Full development workflow: build, sync, and start

quick-start: sync-static startapp ## Quick start (assumes frontend already built)

# Validation commands
validate: ## Validate the implementation
	@echo "✅ Checking frontend build..."
	@test -f startapp_ui/dist/index.html || (echo "❌ Frontend not built" && exit 1)
	@echo "✅ Checking static files sync..."
	@test -f src/bedrock_agentcore_starter_toolkit/static/index.html || (echo "❌ Static files not synced" && exit 1)
	@echo "✅ Implementation looks good!"

# CI/CD helpers
ci-build: build-frontend sync-static package ## CI build process
	@echo "✅ CI build complete"