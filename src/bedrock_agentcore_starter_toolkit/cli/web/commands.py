"""Web commands for BedrockAgentCore CLI."""

import logging
import webbrowser

import typer
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from rich.panel import Panel

from ..common import console
from ...utils.static_files import serve_static_file, get_index_html_content

DEFAULT_PORT = 8081

# Create a module-specific logger
logger = logging.getLogger(__name__)

# Create a Typer app for web commands
web_app = typer.Typer(help="Web interface for Bedrock AgentCore")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Bedrock AgentCore Web Interface",
        description="A web interface for managing and interacting with Bedrock AgentCore",
        version="0.1.0",
    )

    @app.get("/", response_class=HTMLResponse)
    async def root():
        """Serve the main React app from bundled static files."""
        return get_index_html_content()

    @app.post("/api/invoke")
    async def invoke():
        raise NotImplementedError()

    @app.post("/api/deploy")
    async def deploy():
        raise NotImplementedError()

    # Serve static files - catch-all route for any remaining paths
    @app.get("/{file_path:path}")
    async def serve_static(file_path: str):
        """Serve static files from the bundled assets."""
        # Don't serve API routes as static files
        if file_path.startswith("api/") or file_path.startswith("docs") or file_path.startswith("redoc"):
            raise HTTPException(status_code=404, detail="Not found")
        
        # If empty path, redirect to index
        if not file_path or file_path == "/":
            return get_index_html_content()
        
        try:
            return serve_static_file(file_path)
        except HTTPException:
            # For SPA routing, fallback to index.html for unknown routes
            try:
                return get_index_html_content()
            except HTTPException:
                raise HTTPException(status_code=404, detail="File not found")

    return app


@web_app.command()
def serve(
    host: str = typer.Option("127.0.0.1", "--host", "-h", help="Host to bind to"),
    port: int = typer.Option(DEFAULT_PORT, "--port", "-p", help="Port to bind to"),
    open_browser: bool = typer.Option(True, "--open/--no-open", help="Automatically open web browser"),
) -> None:
    """Start the web interface server.
    
    This command starts a FastAPI web server that provides a web interface
    and API for creating an agent and deploying Bedrock AgentCore.
    
    Args:
        host: Host address to bind the server to (default: 127.0.0.1)
        port: Port number to bind the server to (default: DEFAULT_PORT)
        open_browser: Automatically open the web browser (default: True)
    """
    try:
        # Show startup message
        console.print(
            Panel(
                f"🚀 [bold green]Starting Bedrock AgentCore Web Interface[/bold green]\n\n"
                f"[bold]Server:[/bold] http://{host}:{port}\n"
                f"[dim]Press Ctrl+C to stop the server[/dim]",
                title="AgentCore StartApp",
                border_style="bright_green",
            )
        )

        # Open browser if requested
        if open_browser:
            server_url = f"http://{host}:{port}"
            try:
                webbrowser.open(server_url)
                console.print(f"🌐 Opening {server_url} in your default browser...")
            except Exception as e:
                console.print(f"⚠️ Could not open browser automatically: {e}")
                console.print(f"💡 Please manually open: {server_url}")

        # Create and run the FastAPI app
        app = create_app()
        
        # Configure uvicorn
        config = uvicorn.Config(
            app=app,
            host=host,
            port=port,
            log_level="info"
        )
        
        server = uvicorn.Server(config)
        server.run()

    except KeyboardInterrupt:
        console.print("\n👋 Shutting down web server...")
    except Exception as e:
        console.print(f"❌ Error starting web server: {e}")
        logger.exception("Error starting web server")
        raise typer.Exit(1)


# Alias the main command
@web_app.callback(invoke_without_command=True)
def web_main(
    ctx: typer.Context,
    host: str = typer.Option("127.0.0.1", "--host", "-h", help="Host to bind to"),
    port: int = typer.Option(DEFAULT_PORT, "--port", "-p", help="Port to bind to"),
    open_browser: bool = typer.Option(True, "--open/--no-open", help="Automatically open web browser"),
) -> None:
    """Start the Bedrock AgentCore web interface.
    
    This is the main entry point for the web command. When called without
    subcommands, it starts the web server.
    """
    if ctx.invoked_subcommand is None:
        serve(host=host, port=port, open_browser=open_browser)
