"""Static files utility for serving bundled frontend assets."""

import mimetypes
from pathlib import Path
from typing import Optional
from importlib.resources import files

from fastapi import HTTPException, Response

def get_static_file_path(file_path: str) -> Optional[Path]:
    """Get the path to a static file using importlib.resources.
    
    Args:
        file_path: Relative path to the static file (e.g., "index.html", "assets/main.js")
        
    Returns:
        Path to the static file, or None if not found
    """
    try:
        # Use importlib.resources
        static_files = files("bedrock_agentcore_starter_toolkit.static")
        
        # Navigate to the requested file
        parts = file_path.split("/")
        current = static_files
        
        for part in parts:
            current = current / part
            
        # Check if the file exists
        if current.is_file():
            return Path(str(current))
        return None
    except Exception:
        return None


def get_static_file_content(file_path: str) -> Optional[bytes]:
    """Get the content of a static file.
    
    Args:
        file_path: Relative path to the static file
        
    Returns:
        File content as bytes, or None if not found
    """
    try:
        # Use importlib.resources
        static_files = files("bedrock_agentcore_starter_toolkit.static")
        
        # Navigate to the requested file
        parts = file_path.split("/")
        current = static_files
        
        for part in parts:
            current = current / part
            
        if current.is_file():
            return current.read_bytes()
            
        return None
    except Exception:
        return None


def serve_static_file(file_path: str) -> Response:
    """Serve a static file with proper content type.
    
    Args:
        file_path: Relative path to the static file
        
    Returns:
        FastAPI Response with the file content
        
    Raises:
        HTTPException: If file not found (404)
    """
    content = get_static_file_content(file_path)
    if content is None:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine content type
    content_type, _ = mimetypes.guess_type(file_path)
    if content_type is None:
        # Default content types for common files
        if file_path.endswith('.js'):
            content_type = 'application/javascript'
        elif file_path.endswith('.css'):
            content_type = 'text/css'
        elif file_path.endswith('.svg'):
            content_type = 'image/svg+xml'
        else:
            content_type = 'application/octet-stream'
    
    return Response(content=content, media_type=content_type)


def get_index_html_content() -> str:
    """Get the content of index.html as a string.
    
    Returns:
        HTML content of index.html
        
    Raises:
        HTTPException: If index.html not found
    """
    content = get_static_file_content("index.html")
    if content is None:
        raise HTTPException(status_code=404, detail="index.html not found")
    
    return content.decode('utf-8')


def list_static_files() -> list[str]:
    """List all available static files.
    
    Returns:
        List of relative paths to all static files
    """
    files_list = []
    def _scan_directory(directory, prefix=""):
        for item in directory.iterdir():
            if item.is_file():
                files_list.append(f"{prefix}{item.name}")
            elif item.is_dir():
                _scan_directory(item, f"{prefix}{item.name}/")
    
    try:
        if files is not None:
            # Use importlib.resources
            static_files = files("bedrock_agentcore_starter_toolkit.static")
            _scan_directory(static_files)
        else:
            # Fallback to direct file access for development
            current_dir = Path(__file__).parent.parent
            static_dir = current_dir / "static"
            
            if static_dir.exists():
                _scan_directory(static_dir)
        
    except Exception:
        pass
        
    return files_list
