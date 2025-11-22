"""Web commands for BedrockAgentCore CLI."""

import asyncio
import json
import logging
import os
import uuid
import webbrowser
from pathlib import Path

import typer
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from jinja2 import Environment, FileSystemLoader
from pydantic import PydanticUserError
from rich.panel import Panel
from strands import Agent
from strands.agent.conversation_manager import SlidingWindowConversationManager
from strands_tools import calculator, current_time
from strands_tools.browser import AgentCoreBrowser
from strands_tools.code_interpreter import AgentCoreCodeInterpreter

from ...utils.aws import get_account_id, get_region
from ...utils.network import find_available_port
from ...utils.static_files import get_index_html_content, serve_static_file
from ..common import console
from .models import DeployRequest, InvokeEvent, InvokeRequest, ToolUseDelta

DEFAULT_PORT = 8081

# Create a module-specific logger
logger = logging.getLogger(__name__)

# Create a Typer app for web commands
web_app = typer.Typer(help="Web interface for Bedrock AgentCore")


def _to_sse(data) -> str:
    return f"data: {json.dumps(data)}\n\n"


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


def _generate_project_content(deploy_req: DeployRequest, project_name: str) -> dict:
    """Generate project file contents (in memory)."""
    # Setup Jinja2 environment
    template_dir = Path(__file__).parent / "templates"
    env = Environment(loader=FileSystemLoader(template_dir))

    # Template context
    context = {
        "project_name": project_name,
        "model_id": deploy_req.modelId,
        "system_prompt": deploy_req.system.replace('"', '\\"'),
        "tools": deploy_req.tools,
        "aws_account": get_account_id(),
        "aws_region": get_region(),
        "cwd": os.getcwd(),
    }

    # Generate file contents
    files = {}
    main_template = env.get_template("main.py.j2")
    files["src/main.py"] = main_template.render(**context)
    pyproject_template = env.get_template("pyproject.toml.j2")
    files["pyproject.toml"] = pyproject_template.render(**context)
    agentcore_template = env.get_template("agentcore.yaml.j2")
    files[".bedrock_agentcore.yaml"] = agentcore_template.render(**context)

    return files


def _generate_project_files(deploy_req: DeployRequest, project_path: Path, project_name: str) -> None:
    """Generate project files to disk."""
    # Get file contents
    files = _generate_project_content(deploy_req, project_name)

    # Create src directory
    src_dir = project_path / "src"
    src_dir.mkdir(exist_ok=True)

    # Write files to disk
    for file_path, content in files.items():
        full_path = project_path / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content)

    logger.debug("Generated project files in %s", project_path)


async def _run_agentcore_launch(project_path: Path):
    """Run agentcore launch and stream output."""
    logger.debug("Running agentcore launch in %s", project_path)

    # Run agentcore launch
    process = await asyncio.create_subprocess_exec(
        "agentcore", "launch", cwd=project_path, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT
    )

    # Stream output line by line
    while True:
        line = await process.stdout.readline()
        if not line:
            break
        yield line.decode() if isinstance(line, bytes) else line

    # Wait for process to complete
    await process.wait()

    if process.returncode == 0:
        yield "✅ Deployment completed successfully!\n"
    else:
        yield f"❌ Deployment failed with exit code {process.returncode}\n"


def create_app(project_path: Path) -> FastAPI:
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
            raise HTTPException(status_code=400, detail="invalid request") from None

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
            conversation_manager=SlidingWindowConversationManager(window_size=40),
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

    @app.post("/api/preview")
    async def preview(request: Request):
        """Preview generated code without deploying."""
        try:
            body = await request.body()
            deploy_req = DeployRequest(**json.loads(body.decode()))
        except PydanticUserError:
            raise HTTPException(status_code=400, detail="invalid request") from None

        # Generate files in memory
        files = _generate_project_content(deploy_req, "preview_agent")

        return {"files": files}

    @app.post("/api/deploy")
    async def deploy(request: Request):
        """Deploy agent to AgentCore."""
        try:
            body = await request.body()
            deploy_req = DeployRequest(**json.loads(body.decode()))
        except PydanticUserError:
            raise HTTPException(status_code=400, detail="invalid request") from None

        project_name = project_path.stem
        logger.debug("Starting deployment for project: %s", project_name)

        async def generate_deploy_stream():
            # Generate files
            _generate_project_files(deploy_req, project_path, project_name)
            yield _to_sse({"textDelta": f"✅ Generated project files in {project_path}\n"})
            yield _to_sse({"textDelta": "Files created:\n"})
            for file_path in project_path.rglob("*"):
                if file_path.is_file():
                    yield _to_sse({"textDelta": f"  - {file_path.relative_to(project_path)}\n"})

            # Run agentcore launch and stream output
            yield _to_sse({"textDelta": "🚀 Starting deployment...\n"})
            async for output in _run_agentcore_launch(project_path):
                yield _to_sse({"textDelta": output})

        return StreamingResponse(
            generate_deploy_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )

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
        # Check if we're in an existing project directory
        current_dir = Path.cwd()
        config_file = current_dir / ".bedrock_agentcore.yaml"
        if config_file.exists():
            # Use existing project directory
            project_path = current_dir
        else:
            # Generate new project
            project_name = f"startapp_agent_{uuid.uuid4().hex[:8]}"
            project_path = current_dir / project_name
            project_path.mkdir(exist_ok=False)
    except Exception as e:
        console.print(f"❌ Error creating project: {e}")
        logger.exception("Error creating project")
        raise typer.Exit(1) from None

    try:
        # Find available port and warn if user's choice wasn't available
        available_port = find_available_port(port)
        if port != available_port:
            console.print(f"[yellow]⚠️  Port {port} is in use, using port {available_port} instead[/yellow]")

        # Show startup message
        console.print(
            Panel(
                f"🚀 [bold green]Starting Bedrock AgentCore Web Interface[/bold green]\n\n"
                f"[bold]Server:[/bold] http://{host}:{available_port}\n"
                f"[dim]Press Ctrl+C to stop the server[/dim]",
                title="AgentCore StartApp",
                border_style="bright_green",
            )
        )

        # Open browser if requested
        if open_browser:
            server_url = f"http://{host}:{available_port}"
            try:
                webbrowser.open(server_url)
                console.print(f"🌐 Opening {server_url} in your default browser...")
            except Exception as e:
                console.print(f"⚠️ Could not open browser automatically: {e}")
                console.print(f"💡 Please manually open: {server_url}")

        # Create and run the FastAPI app
        app = create_app(project_path)

        # Configure uvicorn
        config = uvicorn.Config(app=app, host=host, port=available_port, log_level="info")

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
