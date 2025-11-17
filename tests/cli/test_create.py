"""Tests for the create command."""

import os
import shutil
import subprocess
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

import pytest
import typer
from typer.testing import CliRunner

from bedrock_agentcore_starter_toolkit.cli.create import create
from bedrock_agentcore_starter_toolkit.operations.runtime.models import ConfigureResult


@pytest.fixture
def runner():
    """Create a CLI runner for testing."""
    return CliRunner()


@pytest.fixture
def temp_template_dir(tmp_path):
    """Create a temporary template directory with sample project structure."""
    template_dir = tmp_path / "template"
    template_dir.mkdir()
    
    # Create sample project structure
    (template_dir / "src").mkdir()
    (template_dir / "test").mkdir()
    
    # Create sample files
    (template_dir / "pyproject.toml").write_text("""[project]
name = "sample-project"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
    "bedrock-agentcore>=1.0.5",
    "strands-agents>=1.14.0",
    "pytest>=7.0.0",
]
""")
    
    (template_dir / "src" / "agent.py").write_text("""from bedrock_agentcore import BedrockAgentCoreApp
from strands import Agent

app = BedrockAgentCoreApp()
agent = Agent(callback_handler=lambda *args, **kwargs: None)

@app.entrypoint
def invoke(payload):
    user_message = payload.get("prompt", "Hello! How can I help you today?")
    result = agent(user_message)
    return {"result": result.message}

if __name__ == "__main__":
    app.run()
""")
    
    (template_dir / "test" / "__init__.py").write_text("")
    (template_dir / "test" / "test_agent.py").write_text("""import pytest
from unittest.mock import Mock, patch
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from agent import app, agent, invoke

def test_agent_initialization():
    assert agent is not None
""")
    
    (template_dir / ".gitignore").write_text("__pycache__/\n.venv/\n")
    (template_dir / "README.md").write_text("# Sample Project")
    
    return template_dir


class TestCreateCommand:
    """Test cases for the create command."""
    
    @patch('bedrock_agentcore_starter_toolkit.cli.create.configure_bedrock_agentcore')
    @patch('subprocess.run')
    def test_create_success(self, mock_subprocess, mock_configure, runner, temp_template_dir, tmp_path):
        """Test successful project creation."""
        # Setup mocks
        mock_configure.return_value = ConfigureResult(
            config_path=tmp_path / "test-project" / ".bedrock_agentcore.yaml",
            execution_role="test-role",
            ecr_repository="test-repo",
            s3_path="test-bucket",
            region="us-west-2",
            account_id="123456789012",
            auto_create_ecr=False,
            auto_create_s3=False
        )
        mock_subprocess.return_value = Mock(returncode=0)
        
        # Change to temp directory
        original_cwd = Path.cwd()
        os.chdir(tmp_path)
        
        try:
            with patch('bedrock_agentcore_starter_toolkit.cli.create.Path') as mock_path_class:
                # Mock the template path to use our temp template
                mock_path_class.return_value = temp_template_dir
                mock_path_class.cwd.return_value = tmp_path
                
                # Mock Path constructor calls
                def path_side_effect(path_str):
                    if path_str == "/Users/alrichey/Code/scrap/sample-project":
                        return temp_template_dir
                    return Path(path_str)
                
                mock_path_class.side_effect = path_side_effect
                
                app = typer.Typer()
                app.command()(create)
                
                result = runner.invoke(app, ["test-project"])
                
                assert result.exit_code == 0
                assert "Project 'test-project' created successfully!" in result.stdout
                
                # Verify project directory was created
                project_path = tmp_path / "test-project"
                assert project_path.exists()
                assert (project_path / "src" / "agent.py").exists()
                assert (project_path / "pyproject.toml").exists()
                
                # Verify pyproject.toml was updated
                pyproject_content = (project_path / "pyproject.toml").read_text()
                assert 'name = "test-project"' in pyproject_content
                
        finally:
            os.chdir(original_cwd)
    
    def test_create_empty_name(self, runner):
        """Test create with empty project name."""
        app = typer.Typer()
        app.command()(create)
        
        result = runner.invoke(app, [""])
        
        assert result.exit_code == 1
        assert "Project name cannot be empty" in result.stdout
    
    def test_create_invalid_name(self, runner):
        """Test create with invalid project name."""
        app = typer.Typer()
        app.command()(create)
        
        result = runner.invoke(app, ["!!!"])
        
        assert result.exit_code == 1
        assert "Project name must contain at least one alphanumeric character" in result.stdout
    
    def test_create_existing_directory(self, runner, tmp_path):
        """Test create when directory already exists."""
        # Create existing directory
        existing_dir = tmp_path / "existing-project"
        existing_dir.mkdir()
        
        original_cwd = Path.cwd()
        os.chdir(tmp_path)
        
        try:
            app = typer.Typer()
            app.command()(create)
            
            result = runner.invoke(app, ["existing-project"])
            
            assert result.exit_code == 1
            assert "Directory 'existing-project' already exists" in result.stdout
            
        finally:
            os.chdir(original_cwd)
    
    def test_create_custom_template(self, runner, temp_template_dir, tmp_path):
        """Test create with custom template."""
        original_cwd = Path.cwd()
        os.chdir(tmp_path)
        
        try:
            with patch('bedrock_agentcore_starter_toolkit.cli.create.configure_bedrock_agentcore') as mock_configure:
                with patch('subprocess.run') as mock_subprocess:
                    mock_configure.return_value = ConfigureResult(
                        config_path=tmp_path / "custom-project" / ".bedrock_agentcore.yaml",
                        execution_role="test-role",
                        ecr_repository="test-repo",
                        s3_path="test-bucket",
                        region="us-west-2",
                        account_id="123456789012",
                        auto_create_ecr=False,
                        auto_create_s3=False
                    )
                    mock_subprocess.return_value = Mock(returncode=0)
                    
                    app = typer.Typer()
                    app.command()(create)
                    
                    result = runner.invoke(app, ["custom-project", "--template", str(temp_template_dir)])
                    
                    assert result.exit_code == 0
                    assert "Project 'custom-project' created successfully!" in result.stdout
                    
        finally:
            os.chdir(original_cwd)
    
    def test_create_nonexistent_template(self, runner, tmp_path):
        """Test create with nonexistent custom template."""
        original_cwd = Path.cwd()
        os.chdir(tmp_path)
        
        try:
            app = typer.Typer()
            app.command()(create)
            
            result = runner.invoke(app, ["test-project", "--template", "/nonexistent/path"])
            
            assert result.exit_code == 1
            assert "Template path '/nonexistent/path' does not exist" in result.stdout
            
        finally:
            os.chdir(original_cwd)
    
    @patch('bedrock_agentcore_starter_toolkit.cli.create.configure_bedrock_agentcore')
    def test_create_configure_failure(self, mock_configure, runner, temp_template_dir, tmp_path):
        """Test create when configure fails."""
        mock_configure.side_effect = Exception("Configuration failed")
        
        original_cwd = Path.cwd()
        os.chdir(tmp_path)
        
        try:
            with patch('bedrock_agentcore_starter_toolkit.cli.create.Path') as mock_path_class:
                mock_path_class.return_value = temp_template_dir
                mock_path_class.cwd.return_value = tmp_path
                
                def path_side_effect(path_str):
                    if path_str == "/Users/alrichey/Code/scrap/sample-project":
                        return temp_template_dir
                    return Path(path_str)
                
                mock_path_class.side_effect = path_side_effect
                
                app = typer.Typer()
                app.command()(create)
                
                result = runner.invoke(app, ["test-project"])
                
                assert result.exit_code == 1
                assert "Error creating project" in result.stdout
                
                # Verify cleanup - project directory should not exist
                project_path = tmp_path / "test-project"
                assert not project_path.exists()
                
        finally:
            os.chdir(original_cwd)
    
    @patch('bedrock_agentcore_starter_toolkit.cli.create.configure_bedrock_agentcore')
    @patch('subprocess.run')
    def test_create_uv_sync_failure(self, mock_subprocess, mock_configure, runner, temp_template_dir, tmp_path):
        """Test create when uv sync fails."""
        mock_configure.return_value = ConfigureResult(
            config_path=tmp_path / "test-project" / ".bedrock_agentcore.yaml",
            execution_role="test-role",
            ecr_repository="test-repo",
            s3_path="test-bucket",
            region="us-west-2",
            account_id="123456789012",
            auto_create_ecr=False,
            auto_create_s3=False
        )
        mock_subprocess.side_effect = subprocess.CalledProcessError(1, "uv")
        
        original_cwd = Path.cwd()
        os.chdir(tmp_path)
        
        try:
            with patch('bedrock_agentcore_starter_toolkit.cli.create.Path') as mock_path_class:
                mock_path_class.return_value = temp_template_dir
                mock_path_class.cwd.return_value = tmp_path
                
                def path_side_effect(path_str):
                    if path_str == "/Users/alrichey/Code/scrap/sample-project":
                        return temp_template_dir
                    return Path(path_str)
                
                mock_path_class.side_effect = path_side_effect
                
                app = typer.Typer()
                app.command()(create)
                
                result = runner.invoke(app, ["test-project"])
                
                assert result.exit_code == 0  # Should still succeed
                assert "Warning: Failed to install dependencies" in result.stdout
                assert "Project 'test-project' created successfully!" in result.stdout
                
        finally:
            os.chdir(original_cwd)
