"""Development server command for Bedrock AgentCore CLI."""

import logging
import subprocess
from pathlib import Path

import typer
from rich.panel import Panel

from ..utils.runtime.config import load_config_if_exists
from .common import _handle_error, console

logger = logging.getLogger(__name__)


def dev():
    """Start a local development server for your agent."""
    config_path = Path.cwd() / ".bedrock_agentcore.yaml"
    
    # Load configuration
    config = load_config_if_exists(config_path)
    if not config:
        console.print(
            Panel(
                "⚠️ [yellow]Configuration Not Found[/yellow]\n\n"
                "No agent configuration found in this directory.\n\n"
                "[bold]Get Started:[/bold]\n"
                "   [cyan]agentcore configure --entrypoint your_agent.py[/cyan]\n"
                "   [cyan]agentcore launch[/cyan]\n"
                '   [cyan]agentcore invoke \'{"prompt": "Hello"}\'[/cyan]',
                title="⚠️ Setup Required",
                border_style="bright_blue",
            )
        )
        raise typer.Exit(1)
    
    # Get the default agent
    default_agent_name = config.default_agent
    if not default_agent_name or default_agent_name not in config.agents:
        _handle_error("No default agent configured in .bedrock_agentcore.yaml")
        
    agent = config.agents[default_agent_name]
    entrypoint = agent.entrypoint
    
    if not entrypoint or entrypoint.strip() == "":
        _handle_error("No entrypoint configured for the default agent")
        
    # Extract module path from entrypoint file path
    entrypoint_path = Path(entrypoint)
    if not entrypoint_path.exists():
        _handle_error(f"Entrypoint file not found: {entrypoint}")
        
    # Convert file path to module path (remove .py extension)
    module_path = entrypoint_path.stem
    
    console.print(f"[green]Starting development server for agent: {default_agent_name}[/green]")
    console.print(f"[blue]Entrypoint: {entrypoint}[/blue]")
    console.print(f"[blue]Server will be available at: http://localhost:8080/invocations[/blue]")
    console.print("[yellow]Press Ctrl+C to stop the server[/yellow]\n")
    
    # Start uvicorn server
    cmd = ["uv", "run", "uvicorn", f"{module_path}:app", "--reload", "--host", "0.0.0.0", "--port", "8080"]
    
    process = None
    try:
        process = subprocess.Popen(cmd, cwd=entrypoint_path.parent)
        
        # Wait for process to complete or be interrupted
        process.wait()
        
    except KeyboardInterrupt:
        console.print("\n[yellow]Shutting down development server...[/yellow]")
        if process:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        console.print("[green]Development server stopped.[/green]")
        
    except Exception as e:
        _handle_error(f"Failed to start development server: {e}")
        if process:
            process.terminate()
