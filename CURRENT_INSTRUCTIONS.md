# Current Instructions

Before you begin, familiarize yourself with this project. Pay attention to CONTRUBUTING.md, README.md, and the CLI entrypoint at `./src/bedrock_agentcore_starter_toolkit/cli/cli.py`.

Your goal is to add a new `create` command (`agentcore create`) that should do the following.

1. Produce a new project inside a new directory with a name of the user's choosing. The project should be structured as the sample project in `/Users/alrichey/Code/scrap/sample-project`.
2. Do the equivalent of calling `agentcore configure` to generate the needed `.bedrock_agentcore.yaml` file. Don't ask the user for the project name again. Use the name they should have already given.
3. Attempt to run `uv sync` in the new directory to resolve the dependencies for the user.
4. Print a helpful output message informing the customer that they can develop locally with `agentcore dev`, then easily deploy and test with `agentcore launch` and `agentcore invoke`

Here are some other key points:

- Unit tests are required for your work to be accepted.
- You MUST activate the venv at `/Users/alrichey/Code/bedrock-agentcore-starter-toolkit/.venv` to use the updated `agentcore` CLI.
- Run the CLI with `uv run agentcore`

Remember to think carefully and form a plan before proceeding.
