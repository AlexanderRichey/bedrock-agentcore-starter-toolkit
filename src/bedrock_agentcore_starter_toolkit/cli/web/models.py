"""Pydantic models for web API requests and responses."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class MCPServer(BaseModel):
    """MCP Server configuration."""

    name: str
    url: str
    token: Optional[str] = None


class ClientTool(BaseModel):
    """Client tool configuration."""

    name: str
    description: str
    inputSchema: Dict[str, Any]


class Content(BaseModel):
    """Content block in a message."""

    text: Optional[str] = None


class ToolUse(BaseModel):
    """Tool use in a message."""

    id: str
    name: str
    type: str
    request: Optional[Dict[str, Any]] = None
    response: Optional[Dict[str, Any]] = None


class Message(BaseModel):
    """Message in the conversation."""

    role: str
    isToolUse: bool
    toolUse: Optional[List[ToolUse]] = None
    content: Optional[List[Content]] = None


class InvokeRequest(BaseModel):
    """Request model for the /api/invoke endpoint."""

    modelId: str
    sessionId: Optional[str] = None
    system: str
    mcpServers: List[MCPServer] = []
    clientTools: List[ClientTool] = []
    tools: List[str] = []
    messages: List[Message] = []
    maxIterations: int = 10


class ToolUseDelta(BaseModel):
    """Tool use delta for streaming responses."""

    id: str
    name: str
    type: str
    request: Optional[Dict[str, Any]] = None
    response: Optional[Dict[str, Any]] = None


class InvokeEvent(BaseModel):
    """Event model for streaming responses."""

    textDelta: Optional[str] = None
    toolUseDelta: Optional[ToolUseDelta] = None
