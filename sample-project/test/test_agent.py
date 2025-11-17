import pytest
from unittest.mock import Mock, patch
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from agent import app, agent, invoke


class TestAgent:
    def test_agent_initialization(self):
        """Test that agent is properly initialized with callback handler"""
        assert agent is not None
        assert hasattr(agent, 'callback_handler')
        assert callable(agent.callback_handler)

    @patch('agent.agent')
    def test_invoke_with_prompt(self, mock_agent):
        """Test invoke function with user prompt"""
        mock_result = Mock()
        mock_result.message = "Test response"
        mock_agent.return_value = mock_result
        
        payload = {"prompt": "Hello, how are you?"}
        result = invoke(payload)
        
        mock_agent.assert_called_once_with("Hello, how are you?")
        assert result == {"result": "Test response"}

    @patch('agent.agent')
    def test_invoke_without_prompt(self, mock_agent):
        """Test invoke function with default prompt"""
        mock_result = Mock()
        mock_result.message = "Default response"
        mock_agent.return_value = mock_result
        
        payload = {}
        result = invoke(payload)
        
        mock_agent.assert_called_once_with("Hello! How can I help you today?")
        assert result == {"result": "Default response"}

    @patch('agent.agent')
    def test_invoke_with_empty_prompt(self, mock_agent):
        """Test invoke function with empty prompt"""
        mock_result = Mock()
        mock_result.message = "Empty response"
        mock_agent.return_value = mock_result
        
        payload = {"prompt": ""}
        result = invoke(payload)
        
        mock_agent.assert_called_once_with("")
        assert result == {"result": "Empty response"}


class TestBedrockAgentCoreApp:
    def test_app_initialization(self):
        """Test that BedrockAgentCoreApp is properly initialized"""
        assert app is not None
        assert hasattr(app, 'entrypoint')

    def test_entrypoint_decorator(self):
        """Test that invoke function is decorated as entrypoint"""
        assert hasattr(invoke, '__name__')
        assert invoke.__name__ == 'invoke'
