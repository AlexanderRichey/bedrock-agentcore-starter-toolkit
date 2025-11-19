# Static Files Implementation for AgentCore StartApp

## Overview

This implementation enables the `agentcore startapp` command to serve static files from `startapp_ui/dist` by bundling them into the Python package and serving them via FastAPI.

## Architecture

### 1. File Structure
```
src/bedrock_agentcore_starter_toolkit/
├── cli/web/commands.py          # Updated web commands
├── utils/static_files.py        # Static file utilities (NEW)
└── static/                      # Bundled static files (NEW)
    ├── __init__.py
    ├── index.html
    ├── vite.svg
    └── assets/
        └── index-DlyE2QfR.js
```

### 2. Key Components

#### A. Static Files Utility (`utils/static_files.py`)
- **Purpose**: Provides functions to access bundled static files
- **Key Functions**:
  - `list_static_files()`: List all available static files
  - `get_static_file_content(path)`: Get file content as bytes
  - `get_index_html_content()`: Get index.html as string
  - `serve_static_file(path)`: Serve file with proper Content-Type
- **Fallback Support**: Works in development (direct file access) and production (importlib.resources)

#### B. Updated Web Commands (`cli/web/commands.py`)
- **Enhanced FastAPI App**: Now serves static files instead of simple HTML
- **SPA Support**: Fallback to index.html for client-side routing
- **API Endpoints**:
  - `/` - Serves the React app (index.html)
  - `/api/health` - Health check with static files status
  - `/api/hello` - Hello world API
  - `/api/static-files` - Lists available static files (debug)
  - `/{file_path:path}` - Serves static files or fallback to index.html

#### C. Build Configuration (`pyproject.toml`)
```toml
[tool.hatch.build.targets.wheel.sources]
"startapp_ui/dist" = "bedrock_agentcore_starter_toolkit/static"
```
This configuration ensures that when building the package, files from `startapp_ui/dist` are bundled into the wheel as `bedrock_agentcore_starter_toolkit/static`.

#### D. Sync Script (`scripts/sync_static_files.py`)
- **Purpose**: Keeps static files in sync during development
- **Usage**: `python scripts/sync_static_files.py`
- **Function**: Copies files from `startapp_ui/dist` to `src/.../static`

## Usage

### Development Workflow

1. **Build Frontend Assets**:
   ```bash
   cd startapp_ui
   npm run build
   ```

2. **Sync Static Files**:
   ```bash
   python scripts/sync_static_files.py
   ```

3. **Run StartApp**:
   ```bash
   agentcore startapp
   # or
   agentcore startapp --port 8081 --no-open
   ```

### Production Build

When building the package:
```bash
python -m build
```

The wheel will automatically include static files from `startapp_ui/dist` in the correct location.

### Testing

Use the demo script to test functionality:
```bash
python demo_startapp.py
```

## Technical Details

### Import Strategy
The static files utility uses a multi-tier import strategy:

1. **Production**: `importlib.resources.files()` (Python 3.9+)
2. **Legacy**: `importlib_resources.files()` (Python 3.8)

### Content Type Detection
Automatic content type detection for common file types:
- `.js` → `application/javascript`
- `.css` → `text/css`
- `.svg` → `image/svg+xml`
- `.html` → `text/html`
- Others → `application/octet-stream`

### SPA Support
For Single Page Applications:
- Unknown routes fall back to `index.html`
- API routes (`/api/*`, `/docs`, `/redoc`) are excluded from fallback
- Proper Content-Type headers for all static assets

## Commands Reference

### Available Commands
```bash
# Start web server (primary command)
agentcore startapp

# With options
agentcore startapp --port 8081 --host 0.0.0.0 --no-open

```

### API Endpoints
- `GET /` - Main React application

## Troubleshooting

### Static Files Not Found
1. Check if `startapp_ui/dist` exists and has files
2. Run `python scripts/sync_static_files.py`
3. Verify files exist in `src/.../static/`

### Import Errors in Development
The utility gracefully falls back to direct file access if importlib.resources is not available.

### Build Issues
Ensure `startapp_ui/dist` is built before running:
```bash
cd startapp_ui && npm run build
```

## Future Enhancements

1. **Hot Reload**: Watch `startapp_ui/dist` for changes during development
2. **Compression**: Add gzip compression for static files
3. **Caching**: Add appropriate cache headers for static assets
4. **CDN Support**: Option to serve static files from CDN in production
