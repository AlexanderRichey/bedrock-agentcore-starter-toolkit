# Sample Project

A simple AI agent application built with Amazon Bedrock Agent Core and Strands Agents framework.

## Overview

This project implements a basic AI agent that can process user prompts and return responses. It uses the Bedrock Agent Core framework for AWS integration and the Strands Agents library for agent functionality.

## Features

- AI agent with customizable callback handling
- AWS Bedrock integration via BedrockAgentCoreApp
- Simple prompt-response interface
- Extensible architecture for additional functionality

## Project Structure

```
sample-project/
├── src/
│   └── agent.py          # Main agent implementation
├── test/
│   ├── __init__.py       # Test package init
│   └── test_agent.py     # Unit tests
├── pyproject.toml        # Project configuration
├── uv.lock              # Dependency lock file
└── README.md            # This file
```

## Requirements

- Python >= 3.10
- [uv](https://docs.astral.sh/uv/) (required for dependency management)
- bedrock-agentcore >= 1.0.5
- strands-agents >= 1.14.0

## Installation

Install dependencies using uv:

```bash
uv sync
```

## Usage

### Running the Agent

To run the agent application locally:

```bash
# Run the dev server
agentcore dev

# Invoke with curl
curl -i -X POST http://localhost:8080/invocations -d '{"prompt":"Hello world!"}'

# Or run with python directly
uv run python src/agent.py
```

## Development

### Running Tests

Run the unit tests using pytest:

```bash
uv run pytest
```

Or run specific test files:

```bash
uv run pytest test/test_agent.py -v
```

### Code Structure

- **`agent.py`**: Contains the main application logic
  - `app`: BedrockAgentCoreApp instance for AWS integration
  - `agent`: Strands Agent instance with callback handler
  - `invoke()`: Main entrypoint function decorated with `@app.entrypoint`

### Testing

The project includes comprehensive unit tests covering:
- Agent initialization
- Invoke function with various payload scenarios
- BedrockAgentCoreApp integration
- Error handling and edge cases
