"""Tests for the dev command."""

import subprocess
from pathlib import Path
from unittest.mock import Mock, patch

import pytest
import typer
from typer.testing import CliRunner

from bedrock_agentcore_starter_toolkit.cli.cli import app
from bedrock_agentcore_starter_toolkit.utils.runtime.schema import (
    BedrockAgentCoreAgentSchema,
    BedrockAgentCoreConfigSchema,
)


class TestDevCommand:
    """Test the dev command functionality."""

    def setup_method(self):
        """Setup test runner."""
        self.runner = CliRunner()

    def test_dev_command_no_config(self, tmp_path):
        """Test dev command when no configuration file exists."""
        with patch("bedrock_agentcore_starter_toolkit.cli.dev.Path.cwd", return_value=tmp_path):
            result = self.runner.invoke(app, ["dev"])
            
        assert result.exit_code == 1
        assert "Configuration Not Found" in result.stdout

    def test_dev_command_no_default_agent(self, tmp_path):
        """Test dev command when no default agent is configured."""
        config = BedrockAgentCoreConfigSchema(
            default_agent="",
            agents={}
        )
        
        with (
            patch("bedrock_agentcore_starter_toolkit.cli.dev.Path.cwd", return_value=tmp_path),
            patch("bedrock_agentcore_starter_toolkit.cli.dev.load_config_if_exists", return_value=config),
        ):
            result = self.runner.invoke(app, ["dev"])
            
        assert result.exit_code == 1
        assert "No default agent configured" in result.stdout

    def test_dev_command_no_entrypoint(self, tmp_path):
        """Test dev command when agent has empty entrypoint."""
        agent = BedrockAgentCoreAgentSchema(
            name="test_agent",
            entrypoint="",  # Empty string instead of None
            source_path=str(tmp_path)
        )
        config = BedrockAgentCoreConfigSchema(
            default_agent="test_agent",
            agents={"test_agent": agent}
        )
        
        with (
            patch("bedrock_agentcore_starter_toolkit.cli.dev.Path.cwd", return_value=tmp_path),
            patch("bedrock_agentcore_starter_toolkit.cli.dev.load_config_if_exists", return_value=config),
        ):
            result = self.runner.invoke(app, ["dev"])
            
        assert result.exit_code == 1
        assert "No entrypoint configured" in result.stdout

    def test_dev_command_entrypoint_not_found(self, tmp_path):
        """Test dev command when entrypoint file doesn't exist."""
        agent = BedrockAgentCoreAgentSchema(
            name="test_agent",
            entrypoint=str(tmp_path / "nonexistent.py"),
            source_path=str(tmp_path)
        )
        config = BedrockAgentCoreConfigSchema(
            default_agent="test_agent",
            agents={"test_agent": agent}
        )
        
        with (
            patch("bedrock_agentcore_starter_toolkit.cli.dev.Path.cwd", return_value=tmp_path),
            patch("bedrock_agentcore_starter_toolkit.cli.dev.load_config_if_exists", return_value=config),
        ):
            result = self.runner.invoke(app, ["dev"])
            
        assert result.exit_code == 1
        assert "Entrypoint file not found" in result.stdout

    @patch("bedrock_agentcore_starter_toolkit.cli.dev.subprocess.Popen")
    def test_dev_command_success(self, mock_popen, tmp_path):
        """Test successful dev command execution."""
        # Create entrypoint file
        entrypoint_file = tmp_path / "agent.py"
        entrypoint_file.write_text("# test agent")
        
        agent = BedrockAgentCoreAgentSchema(
            name="test_agent",
            entrypoint=str(entrypoint_file),
            source_path=str(tmp_path)
        )
        config = BedrockAgentCoreConfigSchema(
            default_agent="test_agent",
            agents={"test_agent": agent}
        )
        
        # Mock subprocess
        mock_process = Mock()
        mock_process.wait.return_value = 0
        mock_popen.return_value = mock_process
        
        with (
            patch("bedrock_agentcore_starter_toolkit.cli.dev.Path.cwd", return_value=tmp_path),
            patch("bedrock_agentcore_starter_toolkit.cli.dev.load_config_if_exists", return_value=config),
        ):
            result = self.runner.invoke(app, ["dev"])
            
        assert result.exit_code == 0
        assert "Starting development server" in result.stdout
        assert "test_agent" in result.stdout
        
        # Verify uvicorn command was called correctly
        mock_popen.assert_called_once_with(
            ["uv", "run", "uvicorn", "agent:app", "--reload", "--host", "0.0.0.0", "--port", "8080"],
            cwd=tmp_path
        )

    @patch("bedrock_agentcore_starter_toolkit.cli.dev.subprocess.Popen")
    def test_dev_command_keyboard_interrupt(self, mock_popen, tmp_path):
        """Test dev command handles KeyboardInterrupt gracefully."""
        # Create entrypoint file
        entrypoint_file = tmp_path / "agent.py"
        entrypoint_file.write_text("# test agent")
        
        agent = BedrockAgentCoreAgentSchema(
            name="test_agent",
            entrypoint=str(entrypoint_file),
            source_path=str(tmp_path)
        )
        config = BedrockAgentCoreConfigSchema(
            default_agent="test_agent",
            agents={"test_agent": agent}
        )
        
        # Mock subprocess to raise KeyboardInterrupt
        mock_process = Mock()
        mock_process.wait.side_effect = KeyboardInterrupt()
        mock_process.terminate.return_value = None
        mock_popen.return_value = mock_process
        
        with (
            patch("bedrock_agentcore_starter_toolkit.cli.dev.Path.cwd", return_value=tmp_path),
            patch("bedrock_agentcore_starter_toolkit.cli.dev.load_config_if_exists", return_value=config),
        ):
            result = self.runner.invoke(app, ["dev"])
            
        # Typer converts KeyboardInterrupt to exit code 130, but our handler should still run
        assert result.exit_code == 130
        assert "Shutting down development server" in result.stdout
        
        # Verify process was terminated
        mock_process.terminate.assert_called_once()

    @patch("bedrock_agentcore_starter_toolkit.cli.dev.subprocess.Popen")
    def test_dev_command_subprocess_error(self, mock_popen, tmp_path):
        """Test dev command handles subprocess errors."""
        # Create entrypoint file
        entrypoint_file = tmp_path / "agent.py"
        entrypoint_file.write_text("# test agent")
        
        agent = BedrockAgentCoreAgentSchema(
            name="test_agent",
            entrypoint=str(entrypoint_file),
            source_path=str(tmp_path)
        )
        config = BedrockAgentCoreConfigSchema(
            default_agent="test_agent",
            agents={"test_agent": agent}
        )
        
        # Mock subprocess to raise an exception
        mock_popen.side_effect = Exception("Subprocess failed")
        
        with (
            patch("bedrock_agentcore_starter_toolkit.cli.dev.Path.cwd", return_value=tmp_path),
            patch("bedrock_agentcore_starter_toolkit.cli.dev.load_config_if_exists", return_value=config),
        ):
            result = self.runner.invoke(app, ["dev"])
            
        assert result.exit_code == 1
        assert "Failed to start development server" in result.stdout
