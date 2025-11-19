"""BedrockAgentCore CLI main module."""

import typer

from ..cli.gateway.commands import gateway_app
from ..cli.memory.commands import memory_app
from ..cli.observability.commands import observability_app
from ..cli.web.commands import web_app
from ..utils.logging_config import setup_toolkit_logging
from .create.commands import create_app
from .identity.commands import identity_app
from .import_agent.commands import import_agent
from .runtime.commands import (
    configure_app,
    destroy,
    invoke,
    launch,
    status,
    stop_session,
)
from .runtime.dev_command import dev

app = typer.Typer(name="agentcore", help="BedrockAgentCore CLI", add_completion=False, rich_markup_mode="rich")

# Setup centralized logging for CLI
setup_toolkit_logging(mode="cli")

# startapp
app.add_typer(web_app, name="startapp")

# runtime
app.command("invoke")(invoke)
app.command("status")(status)
app.command("launch")(launch)
app.command("dev")(dev)
app.command("import-agent")(import_agent)
app.command("destroy")(destroy)
app.command("stop-session")(stop_session)
app.add_typer(identity_app, name="identity")
app.add_typer(configure_app)

# gateway
app.add_typer(gateway_app, name="gateway")

# memory
app.add_typer(memory_app, name="memory")

# observability
app.add_typer(observability_app, name="obs")

# import-agent
app.command("import-agent")(import_agent)

# create
app.add_typer(create_app, name="create")


def main():
    """Entry point for the CLI application."""
    app()


if __name__ == "__main__":
    main()
