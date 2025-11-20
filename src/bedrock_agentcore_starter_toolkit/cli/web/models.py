"""Request and response models for the web API."""

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


class InvokeRequest(BaseModel):
    """Request model for the /api/invoke endpoint."""

    modelId: str
    sessionId: Optional[str] = None
    system: str
    mcpServers: List[MCPServer] = []
    clientTools: List[ClientTool] = []
    tools: List[str] = []
    messages: List[Dict[str, Any]] = []
    maxIterations: int = 10


class ToolUseDelta(BaseModel):
    """Tool use delta information."""

    id: str
    name: str
    type: str
    request: Optional[Dict[str, Any]] = None
    response: Optional[Dict[str, Any]] = None


class InvokeEvent(BaseModel):
    """Event model for streaming responses."""

    textDelta: Optional[str] = None
    toolUseDelta: Optional[ToolUseDelta] = None
