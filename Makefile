# Makefile for Bedrock AgentCore StartApp development

.PHONY: help build-frontend sync-static clean

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

clean:
	rm -rf src/bedrock_agentcore_starter_toolkit/static/*
