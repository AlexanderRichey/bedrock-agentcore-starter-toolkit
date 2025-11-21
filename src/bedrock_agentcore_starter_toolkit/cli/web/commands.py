"""Web commands for BedrockAgentCore CLI."""

import json
import logging
import webbrowser

from pydantic import PydanticUserError
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

    @app.post("/api/invoke")
    async def invoke(request: Request):
        """Handle agent invocation requests with streaming response."""
        try:
            body = await request.body()
            invoke_req = InvokeRequest(**json.loads(body.decode()))
        except PydanticUserError:
            raise HTTPException(status_code=400, detail="invalid request")

        logger.debug("Received invoke request for model: %s", invoke_req.modelId)
        logger.debug("Request tools: %s", invoke_req.tools)

        if len(invoke_req.messages) == 0:
            raise HTTPException(status_code=400, detail="messages cannot be empty")

        # Load tools
        tools = _load_tools(invoke_req.tools)

        # Convert messages to Strands format for conversation history
        messages = []
        for msg in invoke_req.messages[:-1]:  # All except last message for history
            if msg.content and len(msg.content) > 0 and msg.content[0].text:
                messages.append({"role": msg.role, "content": [{"text": msg.content[0].text}]})

        agent = Agent(
            model=invoke_req.modelId,
            tools=tools,
            messages=messages,
            system_prompt=invoke_req.system,
            agent_id=invoke_req.sessionId or "default",
            callback_handler=lambda *args, **kwargs: None,
        )

        # Get the user message from the last message
        user_message = ""
        if invoke_req.messages:
            last_msg = invoke_req.messages[-1]
            if last_msg.content and len(last_msg.content) > 0 and last_msg.content[0].text:
                user_message = last_msg.content[0].text
        if len(user_message) == 0:
            raise HTTPException(status_code=400, detail="message cannot be empty")

        async def generate_stream():
            # Stream agent response
            async for event in agent.stream_async(user_message):
                sse_data = _process_agent_event(event)
                if sse_data:
                    yield sse_data

        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Transfer-Encoding": "chunked",
            },
        )

    def _load_tools(tool_names: list[str]) -> list:
        """Load tools based on requested tool names."""
        tools = []
        logger.debug("Requested tools: %s", tool_names)

        for tool_name in tool_names:
            match tool_name:
                case "time":
                    tools.append(current_time)
                    logger.debug("Added time tool")
                case "calculator":
                    tools.append(calculator)
                    logger.debug("Added calculator tool")
                case "browser":
                    browser_tool = AgentCoreBrowser()
                    tools.append(browser_tool.browser)
                    logger.debug("Added browser tool")
                case "code_interpreter":
                    code_tool = AgentCoreCodeInterpreter()
                    tools.append(code_tool.code_interpreter)
                    logger.debug("Added code_interpreter tool")
                case _:
                    continue
        logger.debug("Total tools configured: %s", len(tools))
        return tools

    def _process_agent_event(event: dict) -> str | None:
        """Process agent events and return formatted SSE data or None."""

        # Handle text deltas
        if "data" in event:
            invoke_event = InvokeEvent(textDelta=event["data"])
            return f"data: {json.dumps(invoke_event.model_dump())}\n\n"

        # Handle tool use events
        elif "current_tool_use" in event:
            tool_info = event["current_tool_use"]
            tool_delta = ToolUseDelta(
                id=tool_info.get("toolUseId", ""),
                name=tool_info.get("name", ""),
                type="request",
                request={"input": tool_info.get("input", {})},
                response=None,
            )
            invoke_event = InvokeEvent(toolUseDelta=tool_delta)
            return f"data: {json.dumps(invoke_event.model_dump())}\n\n"

        # Handle complete messages (for tool results)
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
                            "content": tool_result.get("content", []),
                        },
                    )
                    invoke_event = InvokeEvent(toolUseDelta=tool_delta)
                    return f"data: {json.dumps(invoke_event.model_dump())}\n\n"

        # Ignore lifecycle events (init_event_loop, start_event_loop, start, result, event)
        # These are for internal tracking but UI doesn't need them
        return None

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
        if file_path.startswith("api/"):
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
