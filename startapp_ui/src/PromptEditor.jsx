import { Box, Button, Container, Dialog, Field, GridItem, Portal, SimpleGrid, Stack, Text, Textarea } from "@chakra-ui/react";
import Messages from "./Messages";
import { GoArrowUp, GoPencil } from "react-icons/go";
import { useState } from "react";
import { useFormik } from "formik";
import { invokeStream } from "./api/api";
import { cloneDeep, omit } from "lodash";
import { ApiError } from "./utils/apiFetch";
import { toaster } from "./components/ui/toaster";
import { transformStreamedMessage } from "./utils/messages";

const AGENT_SCRIPT_FORMAT = `# Agent Script Format

This rule defines the standard format for Agent scripts, which are reusable workflows that automate complex processes.

<rule>
name: agent_script_format
description: Standards for creating and formatting Agent scripts
actions:
  - type: suggest
    message: |
      Agent scripts must follow the standard format:
      
      1. Include Overview, Parameters, and Steps sections
      2. Use RFC2119 keywords (MUST, SHOULD, MAY) in constraints
      3. Provide context for all negative constraints (MUST NOT, SHOULD NOT, etc.)
      4. Use lowercase with underscores for parameter names
      5. Use "You" instead of "The model" in constraints
      6. Include examples where appropriate
      7. Follow the template structure defined in this rule

examples:
  - input: |
      # My Script
      
      This is a standard script format.
    output: |
      # My Script
      
      ## Overview
      
      This script helps users accomplish a specific task by guiding them through a series of steps.
      
      ## Parameters
      
      - **parameter_name** (required): Description of the parameter
      - **optional_param** (optional): Description of the optional parameter
      
      ## Steps
      
      ### 1. First Step
      
      Description of what happens in this step.
      
      **Constraints:**
      - You MUST perform specific action
      - You SHOULD consider certain factors
      
      ### 2. Second Step
      
      Description of what happens in this step.
      
      **Constraints:**
      - You MUST save output to a file
      
      ## Examples
      
      Example of expected output or behavior.

metadata:
  priority: high
  version: 1.0
</rule>

# Agent Script Format Specification

## Overview

This document defines the standard format for Agent scripts. Scripts are markdown files that provide structured guidance for agents to follow when performing specific tasks, making complex workflows repeatable and consistent.

## Script Structure

Each script MUST include the following sections:

### 1. Title and Overview

\`\`\`markdown
# [Script Name]

## Overview

[A concise description of what the script does and when to use it]
\`\`\`

### 2. Parameters

\`\`\`markdown
## Parameters

- **required_param** (required): [Description of the required parameter]
- **another_required** (required): [Description of another required parameter]
- **optional_param** (optional): [Description of the optional parameter]
- **optional_with_default** (optional, default: "default_value"): [Description]
\`\`\`

Parameter names MUST:
- Use lowercase letters
- Use underscores for spaces (snake_case)
- Be descriptive of their purpose

For parameters with flexible input methods:

\`\`\`markdown
## Parameters

- **input_data** (required): The data to be processed.

**Constraints for parameter acquisition:**
- You MUST ask for all required parameters upfront in a single prompt rather than one at a time
- You MUST support multiple input methods including:
  - Direct input: Text provided directly in the conversation
  - File path: Path to a local file
  - URL: Link to an internal resource
  - Other methods: You SHOULD be open to other ways the user might want to provide the data
- You MUST use appropriate tools to access content based on the input method
- You MUST confirm successful acquisition of all parameters before proceeding
- You SHOULD save any acquired data to a consistent location for use in subsequent steps
\`\`\`

### 3. Steps

\`\`\`markdown
## Steps

### 1. [Step Name]

[Natural language description of what happens in this step]

**Constraints:**
- You MUST [specific requirement using RFC2119 keyword]
- You SHOULD [recommended behavior using RFC2119 keyword]
- You MAY [optional behavior using RFC2119 keyword]

### 2. [Next Step]

[Description]

**Constraints:**
- [List of constraints]
\`\`\`

For steps with conditional logic:

\`\`\`markdown
### 3. [Conditional Step]

If [condition], proceed with [specific action]. Otherwise, [alternative action].

**Constraints:**
- You MUST check [condition] before proceeding
- If [condition] is true, You MUST [action]
- If [condition] is false, You MUST [alternative action]
\`\`\`

### 4. Examples (Optional but Recommended)

\`\`\`markdown
## Examples

### Example Input
[Example input]

### Example Output
[Example output]
\`\`\`

### 5. Troubleshooting (Optional)

\`\`\`markdown
## Troubleshooting

### [Common Issue]
If [issue description], you should [resolution steps].

### [Another Issue]
[Description and resolution]
\`\`\`

## RFC2119 Keywords

Scripts MUST use the following keywords as defined in RFC2119 to indicate requirement levels:

- **MUST** (or **REQUIRED**): Absolute requirement
- **MUST NOT** (or **SHALL NOT**): Absolute prohibition
- **SHOULD** (or **RECOMMENDED**): There may be valid reasons to ignore this item, but the full implications must be understood and carefully weighed
- **SHOULD NOT** (or **NOT RECOMMENDED**): There may be valid reasons when this behavior is acceptable, but the full implications should be understood
- **MAY** (or **OPTIONAL**): Truly optional item

## Negative Constraints and Context

When using negative constraints (MUST NOT, SHOULD NOT, SHALL NOT, NEVER, etc.), you MUST provide context explaining why the restriction exists. This helps users understand the reasoning and avoid similar issues.

**Format for negative constraints:**
\`\`\`markdown
- You MUST NOT [action] because [reason/context]
- You SHOULD NEVER [action] since [explanation of consequences]
- You SHALL NOT [action] as [technical limitation or risk]
\`\`\`

**Examples:**

Good constraint with context:
\`\`\`markdown
- You MUST NOT use ellipses (...) in responses because your output will be read aloud by a text-to-speech engine, and the engine cannot properly pronounce ellipses
- You SHOULD NEVER delete Git history files since this could corrupt the repository and make recovery impossible
- You MUST NOT run \`git push\` because this could publish unreviewed code to shared repositories where others depend on it
\`\`\`

Bad constraint without context:
\`\`\`markdown
- You MUST NOT use ellipses
- You SHOULD NEVER delete Git files
- You MUST NOT run git push
\`\`\`

**Common contexts for negative constraints:**
- **Technical limitations**: "because the system cannot handle..."
- **Security risks**: "since this could expose sensitive data..."
- **Data integrity**: "as this could corrupt or lose important information..."
- **User experience**: "because users will be confused by..."
- **Compatibility issues**: "since this breaks integration with..."
- **Performance concerns**: "as this could cause significant slowdowns..."
- **Workflow disruption**: "because this interferes with established processes..."

## Interactive Scripts

For scripts with interactive elements:

1. The natural language description SHOULD clearly indicate when user interaction is expected
2. Constraints MUST specify how to handle user responses
3. The script SHOULD specify where to save interaction records

Example:

\`\`\`markdown
### 2. Requirements Clarification

Guide the user through a series of questions to refine their initial idea.

**Constraints:**
- You MUST ask one question at a time
- You MUST append each question and answer to "idea-honing.md"
- You SHOULD adapt follow-up questions based on previous answers
- You MUST continue asking questions until sufficient detail is gathered
\`\`\`

## Best Practices

1. Keep steps focused and concise
2. Use clear, specific constraints
3. Include examples for complex outputs
4. Use natural language descriptions that are easy to understand
5. Minimize complex conditional logic
6. Specify file paths for all artifacts created
7. Include troubleshooting guidance for common issues
8. Test scripts thoroughly before sharing
9. Always list required parameters before optional parameters
10. Use "You" instead of "The model" in constraints for more concise scripts
`

const PROMPT_WRITER_PROMPT = `# Prompt Generator

## Overview

This script helps users create standardized agent scripts by guiding them through the process of defining script requirements, structure, and constraints. It automatically generates a well-formatted agent script following the standards defined in the AmazonBuilderGenAIPowerUsersQContext package. The script detects available MCP servers and recommends appropriate tools based on the user's requirements.

## Parameters

- **script_purpose** (required): Brief description of what the script should accomplish
- **complexity** (optional, default: "medium"): Complexity level of the script ("simple", "medium", "complex")

**Constraints for parameter acquisition:**
- You MUST ask for all required parameters upfront in a single prompt

## Steps

### 1. Detect Available MCP Servers and Tools

Identify all available MCP servers and their tools to recommend appropriate ones for the script.

**Constraints:**
- You MUST check for all available MCP servers in the user's environment
- You MUST compile a comprehensive list of available tools from all detected MCP servers
- You MUST categorize tools by functionality (e.g., file operations, communication, data processing)
- You MUST save this information for later use in tool recommendations
- You MUST inform the user about the detected MCP servers
- You MUST NOT attempt to use any tools during this detection phase
- You SHOULD handle cases where no MCP servers are detected gracefully

### 2. Gather Script Requirements

Collect detailed information about the script's purpose, functionality, and requirements.

**Constraints:**
- You MUST ask the user a series of structured questions to gather requirements
- You MUST ask about:
  - The specific problem the script solves
  - The expected inputs and outputs
  - The main steps the script should perform
  - Any specific data sources or systems the script needs to interact with
  - Any specific constraints or requirements
- You MUST adapt follow-up questions based on previous answers
- You SHOULD summarize the gathered requirements before proceeding
- You MUST ask the user to confirm or refine the requirements before proceeding

### 3. Recommend Appropriate MCP Tools

Based on the script requirements, recommend appropriate MCP tools from the available servers.

**Constraints:**
- You MUST analyze the script requirements to identify needed functionality
- You MUST match required functionality to available MCP tools
- You MUST recommend specific tools from the detected MCP servers that best fit the requirements
- You MUST explain why each recommended tool is appropriate for the task
- You MUST ask the user to confirm or modify the tool selections
- You SHOULD suggest alternative tools if the ideal ones are not available
- You MUST respect the user's tool preferences if they have specific requests
- You MUST ensure all recommended tools are actually available in the user's environment
- You MUST group tool recommendations by the MCP server that provides them

### 4. Define Script Parameters

Define the parameters that the script will accept.

**Constraints:**
- You MUST help the user identify all necessary parameters
- You MUST classify parameters as required or optional
- You MUST suggest appropriate default values for optional parameters
- You MUST ensure parameter names follow snake_case convention
- You MUST provide clear descriptions for each parameter
- You SHOULD suggest parameter constraints when appropriate
- You MUST format parameters according to the standard script format
- You SHOULD suggest parameters needed for the recommended MCP tools

### 5. Define Script Steps

Define the logical steps that the script will follow.

**Constraints:**
- You MUST help the user break down the script functionality into clear, sequential steps
- You MUST ensure the first step is "Verify Dependencies" that checks for all required tools, including MCP tools
- You MUST name each step descriptively
- You MUST write a clear description for each step
- You MUST define appropriate constraints for each step using RFC2119 keywords (MUST, SHOULD, MAY)
- You MUST provide context for all negative constraints (MUST NOT, SHOULD NOT)
- You SHOULD suggest error handling and validation steps
- You MUST incorporate the recommended MCP tools into appropriate steps
- You SHOULD suggest appropriate tool usage where applicable
- You MUST ensure the steps account for MCP server availability checks

### 6. Generate Script Content

Generate the complete script content following the standard format.

**Constraints:**
- You MUST follow the script format defined under Agent Script Format
- You MUST include all sections: Title, Overview, Parameters, Steps
- You MUST format all constraints using RFC2119 keywords
- You SHOULD include Examples section if appropriate
- You SHOULD include Troubleshooting section for complex scripts
- You MUST ensure the script is well-formatted and follows all style guidelines
- You MUST use "You" instead of "The model" in constraints
- You MUST include proper dependency verification for all MCP tools
- You MUST include proper error handling for cases where MCP servers are unavailable
- You SHOULD include example tool invocations in the Examples section

## Examples

### Example Input

\`\`\`
I need a script that helps users analyze log files and extract error patterns.
\`\`\`

### Example Output

\`\`\`markdown
# Log Analyzer

## Overview

This script helps users analyze log files to identify and extract error patterns, frequency, and trends. It automates the process of parsing logs, categorizing errors, and generating summary reports.

## Parameters

- **log_path** (required): Path to the log file or directory containing logs
- **output_format** (optional, default: "markdown"): Format for the analysis report ("markdown", "json", "csv")
- **error_types** (optional): Specific error types to focus on (comma-separated list)

## Steps

### 1. Parse Log Files

Read and parse the provided log files.

**Constraints:**
- You MUST handle both single files and directories
- You MUST support common log formats (text, JSON, XML)
- You SHOULD detect log format automatically
- You MUST handle large files efficiently
- You SHOULD use rtla_fetch_logs for RTLA logs if available

...
\`\`\`

## Troubleshooting

### Missing Requirements
If the user provides vague or incomplete requirements:
1. Ask more specific questions to clarify the script's purpose
2. Provide examples of well-defined requirements
3. Suggest potential use cases based on the limited information provided

### Tool Availability Issues
If required tools are not available:
1. Explain which tools are missing and why they're needed
2. Suggest alternative approaches that don't require the missing tools
3. Offer to create a simplified version of the script that works with available tools
`

export default function PromptEditor({ prompt, tools, enabledTools, onChange }) {
  const [value, setValue] = useState(prompt)
  const [nextMessage, setNextMessage] = useState("")
  const [streamingMessage, setStreamingMessage] = useState({
    isStreaming: false,
    role: "assistant",
    content: []
  })
  const handleChange = () => onChange(value)
  const formik = useFormik({
    initialValues: {
      modelId: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
      tools: ["@client/update_system_prompt"],
      clientTools: [
        {
          "name": "update_system_prompt",
          "description": "Use this tool to update the system prompt of the agent the user is currently creating.",
          "inputSchema": {
            "type": "object",
            "properties": {
              "system_prompt": {
                "type": "string"
              }
            },
            "required": ["system_prompt"]
          }
        }
      ],
      mcpServers: [],
      system: PROMPT_WRITER_PROMPT,
      messages: [],
      maxIterations: 8,
    },
    onSubmit: async (values) => {
      const formErrors = Object.entries({
        "messages": nextMessage.length,
      }).reduce((prev, [name, val]) => {
        if (val === 0) {
          prev[name] = "This field is required."
        }
        return prev
      }, {})
      console.log(formErrors)
      if (Object.keys(formErrors).length > 0) {
        formik.setErrors(formErrors)
        return
      }

      let payload = Object.assign(values, {
        messages: [...values.messages, {
          isToolUse: false,
          role: "user",
          content: [
            { "text": nextMessage }
          ]
        }]
      })
      console.log("new payload:", payload)

      await formik.setValues(payload)
      setNextMessage(_ => "")

      const m = { role: "assistant", content: [], isStreaming: true }
      setStreamingMessage(m)

      try {
        let keepGoing = false
        do {
          const clonedPayload = cloneDeep(payload)
          // Add hidden context of AGENT_SCRIPT_FORMAT and the current agent config in separate content blocks.
          const lastMessage = clonedPayload.messages[payload.messages.length - 1]
          const filteredTools = [
            { name: "time", description: "Get the current time in UTC." },
            { name: "web_search_exa", description: "Search the web using Exa AI - performs real-time web searches and can scrape content from specific URLs. Supports configurable result counts and returns the content from the most relevant websites." },
            { name: "scrape_webpage", description: "Scrape a webpage and extract its content in various formats. This tool allows fetching content from a single URL with configurable browser behavior options. Use this for extracting text content, HTML structure, collecting links, or capturing screenshots of webpages." },
            ...tools
          ].filter(t => enabledTools.includes(t.name))
          const formattedTools = JSON.stringify(filteredTools)
          const currentPrompt = value || "Empty"
          lastMessage.content = [
            { "text": AGENT_SCRIPT_FORMAT },
            { "text": `# Current Agent Configuration\n\nThe agent has the following system prompt.\n\n\`\`\`\n${currentPrompt}\n\`\`\`\n\nThe agent has the following tools.\n\n\`\`\`\n${formattedTools}\n\`\`\`` },
            ...(lastMessage.content || [])
          ]

          keepGoing = false
          for await (const event of invokeStream(clonedPayload)) {
            if (event.textDelta) {
              if (m.content.length === 0 || !(m.content[m.content.length - 1].hasOwnProperty("text"))) {
                m.content.push({ text: event.textDelta })
              } else {
                m.content[m.content.length - 1].text += event.textDelta
              }
            }
            if (event.toolUseDelta) {
              const found = m.content.find(mm => mm.id && mm.id === event.toolUseDelta.id)
              if (found) {
                found.response = event.toolUseDelta.response
              } else {
                m.content.push(event.toolUseDelta)
                if (event.toolUseDelta.name == "update_system_prompt") {
                  keepGoing = true

                  const toolResult = JSON.parse(event.toolUseDelta.request.text)
                  setValue(toolResult["system_prompt"])
                  event.toolUseDelta.response = { status: "success", text: "The system prompt was successfully updated." }
                }
              }
            }
            setStreamingMessage(Object.assign({}, m))
          }
          const newMessages = [...payload.messages, ...transformStreamedMessage(m)]
          payload = Object.assign({}, payload, { messages: newMessages })
          await formik.setFieldValue("messages", newMessages)
          m.content = []
          setStreamingMessage(Object.assign({}, m))
        } while (keepGoing);
      } catch (error) {
        if (error instanceof ApiError) {
          formik.setErrors(omit(error, ["message"]))
          if (error.statusCode() >= 500) {
            toaster.create({
              type: "error",
              title: "Server Error",
              description: error.message || "Something has gone wrong."
            })
          } else {
            toaster.create({
              type: "warning",
              title: "Validation Error",
              description: error.message || "Not all fields are valid."
            })
          }
        } else {
          console.log(error)
          toaster.create({
            type: "error",
            title: "Server Error",
            description: error.message || "Something has gone wrong."
          })
        }
      }
      setStreamingMessage({ role: "assistant", content: [], isStreaming: false })
    }
  })

  const clearConversation = () => formik.setFieldValue("messages", [])

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="solid"><GoPencil /> Edit Prompt</Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content width="70rem" maxWidth="90%" height="50rem">
            <Dialog.Header>
              <Dialog.Title>
                Edit Prompt
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <SimpleGrid columns={{ base: 5 }} gap={4} height="100%">
                <GridItem colSpan={{ base: 2 }}>
                  <Stack height="2rem">
                    <Text fontWeight="semibold" fontSize="sm">
                      Use AI to write your prompt
                    </Text>
                  </Stack>
                  <Container
                    backgroundColor="gray.100"
                    borderColor="gray.200"
                    borderWidth="thin"
                    borderRadius="xl"
                    height="100%"
                    maxHeight="calc(100% - 2rem)"
                    padding={0}
                  >
                    <Messages messages={formik.values.messages} streamingMessage={streamingMessage} height="29.7rem" clearConversation={clearConversation} />
                    <Box
                      position="absolute"
                      bottom="0"
                      width="100%"
                      height="8rem"
                      borderTopColor="gray.200"
                      borderTopWidth="thin"
                    >
                      <Stack direction="row" padding={4}>
                        <Field.Root required={true}>
                          <Textarea
                            value={nextMessage}
                            onChange={e => setNextMessage(e.currentTarget.value)}
                            size="lg"
                            rows={3}
                            backgroundColor="white"
                            placeholder='Write a prompt for a basic chatbot.'
                            resize="none"
                            autoFocus
                          />
                        </Field.Root>
                        <Button alignSelf="flex-end" loading={formik.isSubmitting} onClick={formik.handleSubmit}>
                          <GoArrowUp />
                        </Button>
                      </Stack>
                    </Box>
                  </Container>
                </GridItem>
                <GridItem colSpan={{ base: 3 }}>
                  <Stack height="2rem">
                    <Text fontWeight="semibold" fontSize="sm">
                      Edit your prompt manually
                    </Text>
                  </Stack>
                  <Textarea
                    value={value}
                    onChange={e => setValue(e.currentTarget.value)}
                    size="lg"
                    fontFamily="mono"
                    placeholder='Tell your agent what its goal is.'
                    height="100%"
                    maxHeight="calc(100% - 2rem)"
                    borderRadius="md"
                    resize="none"
                  />
                </GridItem>
              </SimpleGrid>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="solid" onClick={handleChange}>Save</Button>
              </Dialog.ActionTrigger>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
