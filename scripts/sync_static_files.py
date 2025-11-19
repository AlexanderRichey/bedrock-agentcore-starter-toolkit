#!/usr/bin/env python3
"""Script to sync static files from startapp_ui/dist to package structure."""

import shutil
import sys
from pathlib import Path


def sync_static_files():
    """Sync static files from frontend dist to package structure."""
    # Get the project root (parent of scripts directory)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    # Define source and destination paths
    source_dir = project_root / "startapp_ui" / "dist"
    dest_dir = project_root / "src" / "bedrock_agentcore_starter_toolkit" / "static"
    
    # Check if source directory exists
    if not source_dir.exists():
        print(f"❌ Source directory not found: {source_dir}")
        print("💡 Run 'npm run build' in startapp_ui/ first")
        return False
    
    # Create destination directory if it doesn't exist
    dest_dir.mkdir(parents=True, exist_ok=True)
    
    # Remove existing files in destination
    if dest_dir.exists():
        for item in dest_dir.iterdir():
            if item.is_file():
                item.unlink()
            elif item.is_dir():
                shutil.rmtree(item)
    
    # Copy all files from source to destination
    for item in source_dir.iterdir():
        if item.is_file():
            shutil.copy2(item, dest_dir / item.name)
            print(f"📄 Copied: {item.name}")
        elif item.is_dir():
            shutil.copytree(item, dest_dir / item.name, dirs_exist_ok=True)
            print(f"📁 Copied directory: {item.name}/")
    
    print(f"✅ Static files synced from {source_dir} to {dest_dir}")
    return True


if __name__ == "__main__":
    success = sync_static_files()
    sys.exit(0 if success else 1)