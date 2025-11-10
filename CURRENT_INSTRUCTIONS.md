# Current Instructions

Before you begin, familiarize yourself with this project. Pay attention to CONTRUBUTING.md, README.md, and the CLI entrypoint at `./src/bedrock_agentcore_starter_toolkit/cli/cli.py`.

Your goal is to add a new `dev` command to this project (`agentcore dev`) that should do the following:

1. Read the customer's .agentcore.yaml file to find the agent's entrypoint. Give an informative error message if the project is not properly configured.
2. Run the local server so that it can be invoked with `curl`, e.g., `curl -X POST --url http://localhost:8080/invocations --header "Content-Type: application/json" --data '{"prompt": "Hello world!"}'`. All you need to do to accomplish this is to run `uv run uvicorn {entrypoint}:app --reload` . This will run the application on the appropriate port, which is not configurable, and restart the server automatically when changes are detected. Logs from the server should be piped out to the main `agentcore dev` process so that users can see logs as they are produced.
3. Gracefully exit the server and parent process on `Ctl+C`.

Here are some other key points:

- Unit tests are required for your work to be accepted.
- You can test your work in the `sample-project/` directory.
- You MUST activate the venv at `/Users/alrichey/Code/bedrock-agentcore-starter-toolkit/.venv` to use the updated `agentcore` CLI.
- Run the CLI with `uv run agentcore`

Remember to think carefully and form a plan before proceeding.
