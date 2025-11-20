"""Web commands for BedrockAgentCore CLI."""

import json
import logging
import webbrowser

import typer
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from rich.panel import Panel
from strands import Agent
from strands_tools import calculator, current_time
from strands_tools.browser import AgentCoreBrowser
from strands_tools.code_interpreter import AgentCoreCodeInterpreter

from ...utils.static_files import get_index_html_content, serve_static_file
from ..common import console
from .models import InvokeEvent, InvokeRequest, ToolUseDelta

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
    
    
    # TODO: Add memory? wire up local history from input payload
    # Pass in messages when init agent - will come in in the input payload (InvokeRequest same as in go)
    @app.post("/api/invoke")
    async def invoke(request: Request):
        """Handle agent invocation requests with streaming response."""
        # Log raw payload for debugging
        body = await request.body()
        payload = json.loads(body.decode())
        invoke_req = InvokeRequest(**payload)

        async def generate_stream():
            try:
                logger.info(f"Received invoke request for model: {invoke_req.modelId}")
                logger.debug(f"Request tools: {invoke_req.tools}")
                
                # Initialize tools based on request
                tools = []
                logger.info("Requested tools: %s", invoke_req.tools)
                
                for tool_name in invoke_req.tools:
                    try:
                        match tool_name:
                            # TODO[P2]: Add diagram tool if possible
                            case "time":
                                tools.append(current_time)
                            case "calculator":
                                tools.append(calculator)
                            case "browser":
                                browser_tool = AgentCoreBrowser()
                                tools.append(browser_tool.browser)
                            case "code_interpreter":
                                code_tool = AgentCoreCodeInterpreter()
                                tools.append(code_tool.code_interpreter)
                            case _:
                                continue
                        logger.info(f"Added {tool_name} tool")
                    except Exception as e:
                        logger.error("Failed to load tool %s: %s", tool_name, e)

                logger.info(f"Total tools configured: {len(tools)}")

                # Create agent with tools
                agent = Agent(model=invoke_req.modelId, tools=tools)

                # Get the user message from the last message
                user_message = ""
                if invoke_req.messages:
                    last_msg = invoke_req.messages[-1]
                    if last_msg.content and len(last_msg.content) > 0 and last_msg.content[0].text:
                        user_message = last_msg.content[0].text

                logger.info(f"Processing message: {user_message} with {len(tools)} tools")

                # Stream agent response
                # TODO[P1]: Debug why server logs are truncated when using stream 
                async for event in agent.stream_async(user_message):
                    # Handle text deltas
                    if "data" in event:
                        invoke_event = InvokeEvent(textDelta=event["data"])
                        yield f"data: {json.dumps(invoke_event.model_dump())}\n\n"
                    
                    # Handle tool use events
                    elif "current_tool_use" in event:
                        tool_info = event["current_tool_use"]
                        tool_delta = ToolUseDelta(
                            id=tool_info.get("toolUseId", ""),
                            name=tool_info.get("name", ""),
                            type="request",
                            request={"input": tool_info.get("input", {})},
                            response=None
                        )
                        invoke_event = InvokeEvent(toolUseDelta=tool_delta)
                        yield f"data: {json.dumps(invoke_event.model_dump())}\n\n"
                    
                    # Handle tool results
                    elif "message" in event:
                        message = event["message"]
                        for content_item in message.get("content", []):
                            if "toolResult" in content_item:
                                tool_result = content_item["toolResult"]
                                tool_delta = ToolUseDelta(
                                    id=tool_result.get("toolUseId", ""),
                                    name="",
                                    type="response",
                                    request=None,
                                    response={
                                        "status": tool_result.get("status", "success"),
                                        "content": tool_result.get("content", [])
                                    }
                                )
                                invoke_event = InvokeEvent(toolUseDelta=tool_delta)
                                yield f"data: {json.dumps(invoke_event.model_dump())}\n\n"
                
                # Send empty completion event to signal end
                completion_event = InvokeEvent(textDelta="")
                yield f"data: {json.dumps(completion_event.model_dump())}\n\n"
                
                # Send SSE end signal
                yield "data: [DONE]\n\n"

            except Exception as e:
                logger.error(f"Stream error: {e}")
                error_event = InvokeEvent(textDelta=f"Error: {str(e)}")
                yield f"data: {json.dumps(error_event.model_dump())}\n\n"

        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Transfer-Encoding": "chunked",
            },
        )

    @app.post("/api/deploy")
    async def deploy():
        # TODO: Take input payload, and render some code directly
        # TODO: Can write templates and will have to render the template
        # TODO: Input payload of deploy will be different from input payload of invoke when deploy tools
        # are now set in stone, input payload is just an object of messages (for the generated code)

        # TODO: Deploy request should also take in model type right??
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
                raise HTTPException(status_code=404, detail="File not found") from None

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
        config = uvicorn.Config(app=app, host=host, port=port, log_level="info")

        server = uvicorn.Server(config)
        server.run()

    except KeyboardInterrupt:
        console.print("\n👋 Shutting down web server...")
    except Exception as e:
        console.print(f"❌ Error starting web server: {e}")
        logger.exception("Error starting web server")
        raise typer.Exit(1) from None


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
