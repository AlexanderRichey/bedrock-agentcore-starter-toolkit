"""Create command for generating new AgentCore projects."""

import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel

from ..operations.runtime import configure_bedrock_agentcore

console = Console()


def create(
    project_name: str = typer.Argument(..., help="Name of the new project directory"),
    template_path: Optional[str] = typer.Option(
        None, "--template", "-t", help="Path to custom template directory"
    ),
) -> None:
    """Create a new AgentCore project with sample code and configuration.
    
    This command creates a new directory with the specified name, copies the sample
    project structure, configures the agent, and installs dependencies.
    
    Examples:
        agentcore create my-agent
        agentcore create my-agent --template /path/to/custom/template
    """
    # Validate project name
    if not project_name or not project_name.strip():
        console.print("[red]Error: Project name cannot be empty[/red]")
        raise typer.Exit(1)
    
    # Clean project name (remove invalid characters)
    clean_name = "".join(c for c in project_name if c.isalnum() or c in "-_").strip()
    if not clean_name:
        console.print("[red]Error: Project name must contain at least one alphanumeric character[/red]")
        raise typer.Exit(1)
    
    project_path = Path.cwd() / clean_name
    
    # Check if directory already exists
    if project_path.exists():
        console.print(f"[red]Error: Directory '{clean_name}' already exists[/red]")
        raise typer.Exit(1)
    
    try:
        # Determine template source
        if template_path:
            template_source = Path(template_path)
            if not template_source.exists() or not template_source.is_dir():
                console.print(f"[red]Error: Template path '{template_path}' does not exist or is not a directory[/red]")
                raise typer.Exit(1)
        else:
            # Use default sample project
            template_source = Path("/Users/alrichey/Code/scrap/sample-project")
            if not template_source.exists():
                console.print("[red]Error: Default sample project template not found[/red]")
                raise typer.Exit(1)
        
        console.print(f"[cyan]Creating new AgentCore project: {clean_name}[/cyan]")
        
        # Create project directory
        project_path.mkdir(parents=True)
        
        # Copy template files (excluding .venv, __pycache__, .pytest_cache)
        exclude_patterns = {".venv", "__pycache__", ".pytest_cache", ".git"}
        
        for item in template_source.iterdir():
            if item.name not in exclude_patterns:
                if item.is_dir():
                    shutil.copytree(item, project_path / item.name, 
                                  ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
                else:
                    shutil.copy2(item, project_path)
        
        # Update pyproject.toml with new project name
        pyproject_path = project_path / "pyproject.toml"
        if pyproject_path.exists():
            content = pyproject_path.read_text()
            content = content.replace('name = "sample-project"', f'name = "{clean_name}"')
            pyproject_path.write_text(content)
        
        console.print(f"[green]✓[/green] Project structure created")
        
        # Change to project directory for configuration
        original_cwd = Path.cwd()
        os.chdir(project_path)
        
        try:
            # Configure the agent
            console.print("[cyan]Configuring AgentCore agent...[/cyan]")
            
            entrypoint_path = project_path / "src" / "agent.py"
            if not entrypoint_path.exists():
                console.print("[red]Error: agent.py not found in template[/red]")
                raise typer.Exit(1)
            
            # Call configure_bedrock_agentcore directly
            result = configure_bedrock_agentcore(
                agent_name=clean_name,
                entrypoint_path=entrypoint_path,
                auto_create_ecr=True,
                auto_create_s3=True,
                auto_create_execution_role=True,
                enable_observability=True,
                memory_mode="NO_MEMORY",
                deployment_type="container",
                container_runtime="auto",
                non_interactive=True,
            )
            
            console.print(f"[green]✓[/green] Agent configured: {clean_name}")
            
            # Install dependencies with uv sync
            console.print("[cyan]Installing dependencies...[/cyan]")
            try:
                subprocess.run(["uv", "sync"], check=True, capture_output=True, text=True)
                console.print("[green]✓[/green] Dependencies installed")
            except subprocess.CalledProcessError as e:
                console.print(f"[yellow]Warning: Failed to install dependencies: {e}[/yellow]")
                console.print("[yellow]You can run 'uv sync' manually in the project directory[/yellow]")
            except FileNotFoundError:
                console.print("[yellow]Warning: 'uv' not found. Please install uv and run 'uv sync' in the project directory[/yellow]")
            
        finally:
            # Return to original directory
            os.chdir(original_cwd)
        
        # Show success message
        invoke_example = '{"prompt": "Hello!"}'
        success_message = (
            f"🎉 [green]Project '{clean_name}' created successfully![/green]\n\n"
            f"[bold]Next steps:[/bold]\n"
            f"  1. [cyan]cd {clean_name}[/cyan]\n"
            f"  2. [cyan]agentcore dev[/cyan] - Start local development server\n"
            f"  3. [cyan]agentcore launch[/cyan] - Deploy to AWS\n"
            f"  4. [cyan]agentcore invoke '{invoke_example}'[/cyan] - Test your agent\n\n"
            f"[dim]Your agent is ready for development and deployment![/dim]"
        )
        
        console.print(
            Panel(
                success_message,
                title="🚀 AgentCore Project Created",
                border_style="green",
            )
        )
        
    except Exception as e:
        # Clean up on failure
        if project_path.exists():
            shutil.rmtree(project_path, ignore_errors=True)
        console.print(f"[red]Error creating project: {e}[/red]")
        raise typer.Exit(1)
