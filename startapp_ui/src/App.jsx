import { Box, Button, Container, Field, Fieldset, GridItem, Heading, NativeSelect, SimpleGrid, Stack, Textarea } from '@chakra-ui/react'
import { useState } from 'react'
import { useFormik } from 'formik'
import { GoArrowUp } from 'react-icons/go'
import { omit } from 'lodash'

import ToolEntry from './ToolEntry'
import Messages from './Messages'
import DeployButton from './DeployButton'
import { invoke, invokePreview, retrieveConfig } from './api/api'
import { toaster } from './components/ui/toaster'
import ShowCodeButton from './ShowCodeButton'
import { useChat } from './hooks/chat'
import { useQuery } from '@tanstack/react-query'

function App() {
  const configQuery = useQuery({
    queryKey: ["config"],
    queryFn: retrieveConfig
  })
  const hasDeployedAgent = (
    configQuery.isSuccess
    && configQuery.data
    && configQuery.data["bedrock_agentcore"]
    && configQuery.data["bedrock_agentcore"]["agent_arn"]
  )
  const [target, setTarget] = useState("draft")
  const isTargetDeployedAgent = target == "deployed"
  const [nextMessage, setNextMessage] = useState("")
  const { streamingResponse, resetStreamingResponse, chat } = useChat({
    invokeFn: isTargetDeployedAgent ? invoke : invokePreview
  })
  const invokeForm = useFormik({
    initialValues: {
      messages: []
    },
    onSubmit: async (values) => {
      let payload = Object.assign(values, {
        messages: [...values.messages, {
          isToolUse: false,
          role: "user",
          content: [
            { "text": nextMessage }
          ]
        }]
      })

      await invokeForm.setValues(payload)
      setNextMessage(_ => "")

      try {
        const response = await chat(payload)
        await invokeForm.setFieldValue("messages", [...payload.messages, ...response])
      } catch (error) {
        invokeForm.setErrors(omit(error, ["message"]))
        if (error.statusCode() >= 500) {
          toaster.create({
            type: "error",
            title: "Ah, dang it!",
            description: error.message || "Something has gone wrong."
          })
        } else {
          toaster.create({
            type: "warning",
            title: "Validation Error",
            description: error.message || "Not all fields are valid."
          })
        }
      }

      resetStreamingResponse()
    }
  })
  const builderForm = useFormik({
    initialValues: {
      modelId: "us.anthropic.claude-3-5-haiku-20241022-v1:0",
      tools: ["time", "calculator", "browser", "code_interpreter"],
      mcpServers: [],
      system: "You are a helpful AI assistant.",
      messages: [],
      maxIterations: 32,
    },
    onSubmit: async (values) => {
      // Validate the input
      const formErrors = Object.entries({
        "messages": nextMessage.length,
        "system": values.system.length
      }).reduce((prev, [name, val]) => {
        if (val === 0) {
          prev[name] = "This field is required."
        }
        return prev
      }, {})
      if (Object.keys(formErrors).length > 0) {
        builderForm.setErrors(formErrors)
        return
      }

      // Create the input payload
      const payload = Object.assign(values, {
        messages: [...values.messages, {
          isToolUse: false,
          role: "user",
          content: [{ "text": nextMessage }]
        }]
      })

      // Set the builderForm state with the payload, which will cause
      // the user's message to render in the chat window
      await builderForm.setValues(payload)

      // Clear out the input textarea.
      setNextMessage(_ => "")

      try {
        const response = await chat(payload)
        await builderForm.setFieldValue("messages", [...payload.messages, ...response])
      } catch (error) {
        builderForm.setErrors(omit(error, ["message"]))
        if (error.statusCode() >= 500) {
          toaster.create({
            type: "error",
            title: "Ah, dang it!",
            description: error.message || "Something has gone wrong."
          })
        } else {
          toaster.create({
            type: "warning",
            title: "Validation Error",
            description: error.message || "Not all fields are valid."
          })
        }
      }

      resetStreamingResponse()
    }
  })

  const makeToolChangeHandler = (toolId) => () => {
    const isChecked = builderForm.values.tools.includes(toolId)
    const newToolsList = isChecked
      ? builderForm.values.tools.filter((v) => v !== toolId)
      : builderForm.values.tools.concat([toolId])
    builderForm.setFieldValue("tools", newToolsList)
  }

  const handleNextMessageChange = (e) => setNextMessage(e.currentTarget.value)

  const clearConversation = () => isTargetDeployedAgent ?
    invokeForm.setFieldValue("messages", []) :
    builderForm.setFieldValue("messages", [])

  return (
    <Container padding="0px 28px 0 28px" height="100dvh" backgroundColor="#F2f2f2" color="black">

      <SimpleGrid columns={5} gap={4} height="100%">
        <GridItem
          marginTop={8}
          colSpan={2}
          borderRadius="24px 24px 0 0"
          border="0.5px solid #e5e5e5"
          bg="#FFF"
          boxShadow="0 5px 10px 0 rgba(0, 0, 0, 0.10)"
          p="30px"
          zIndex="100"
        >
          <Fieldset.Root>
            <Fieldset.Content>

              <Heading fontSize="30px" fontStyle="normal" fontWeight="normal" marginBottom={3}>AgentCore Explorer</Heading>

              <Stack direction="row" gap={3} marginBottom={2}>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    name='target'
                    value={target}
                    onChange={(e) => setTarget(e.currentTarget.value)}
                    borderRadius="20px"
                    border="var(--Borders-sm, 1px) solid var(--border-default, #E4E4E7)"
                  >
                    <option value="draft">Draft</option>
                    <option disabled={!hasDeployedAgent} value="deployed">Deployed</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>

                <ShowCodeButton values={builderForm.values} />

                <DeployButton
                  values={builderForm.values}
                  setTargetToDeployed={() => setTarget("deployed")}
                />
              </Stack>

              <Heading as="h2" fontSize="18px" fontWeight="medium" marginBottom={2}>Configs</Heading>

              <Field.Root required={true} invalid={!!builderForm.errors.modelId} disabled={isTargetDeployedAgent}>
                <Field.Label>Model</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    name='modelId'
                    value={builderForm.values.modelId}
                    onChange={builderForm.handleChange}
                    borderRadius="20px"
                    border="var(--Borders-sm, 1px) solid var(--border-default, #E4E4E7)"
                  >
                    <option value="us.anthropic.claude-sonnet-4-5-20250929-v1:0">Claude Sonnet 4.5</option>
                    <option value="us.anthropic.claude-sonnet-4-20250514-v1:0">Claude Sonnet 4</option>
                    <option value="us.anthropic.claude-haiku-4-5-20251001-v1:0">Claude Haiku 4.5</option>
                    <option value="us.anthropic.claude-3-5-haiku-20241022-v1:0">Claude Haiku 3.5</option>
                    <option value="open-ai-gpt-5" disabled>OpenAI GPT 5 (CLI Only)</option>
                    <option value="open-ai-gpt-5-mini" disabled>OpenAI GPT 5 Mini (CLI Only)</option>
                    <option value="open-ai-gpt-5-nano" disabled>OpenAI GPT 5 Nano (CLI Only)</option>
                    <option value="google-gemini-3-pro" disabled>Google Gemini 3 Pro (CLI Only)</option>
                    <option value="google-gemini-2.5-pro" disabled>Google Gemini 2.5 Pro (CLI Only)</option>
                    <option value="google-gemini-2.5-flash" disabled>Google Gemini 2.5 Flash (CLI Only)</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <Field.ErrorText>{builderForm.errors.modelId}</Field.ErrorText>
              </Field.Root>

              <Field.Root required={true} invalid={!!builderForm.errors.modelId} disabled={isTargetDeployedAgent}>
                <Field.Label>Framework</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    name='sdk'
                    value={builderForm.values.sdk}
                    onChange={builderForm.handleChange}
                    borderRadius="20px"
                    border="var(--Borders-sm, 1px) solid var(--border-default, #E4E4E7)"
                  >
                    <option value="strands-sdk">Strands SDK</option>
                    <option disabled value="claude-sdk">Claude Agent SDK (CLI Only)</option>
                    <option disabled value="open-ailaude-sdk">OpenAI Agents SDK (CLI Only)</option>
                    <option disabled value="langgraph">LangGraph (CLI Only)</option>
                    <option disabled value="google-adk">Google ADK (CLI Only)</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <Field.ErrorText>{builderForm.errors.modelId}</Field.ErrorText>
              </Field.Root>

              <Field.Root required={true} invalid={!!builderForm.errors.system} disabled={isTargetDeployedAgent}>
                <Field.Label>System Prompt</Field.Label>
                <Textarea
                  name="system"
                  value={builderForm.values.system}
                  onChange={builderForm.handleChange}
                  size="lg"
                  placeholder='Type agent instructions here...'
                  height="100%"
                  resize="none"
                  rows={12}
                  borderRadius="20px"
                  border="var(--Borders-sm, 1px) solid var(--border-default, #E4E4E7)"
                  background="var(--bg-subtle, #FAFAFA)"
                />
                <Field.ErrorText>{builderForm.errors.system}</Field.ErrorText>
              </Field.Root>

              <Box>
                <Field.Root paddingX={0} disabled={isTargetDeployedAgent}>
                  <Field.Label marginBottom={1}>Tools</Field.Label>
                  <Stack gap={2}>
                    <ToolEntry
                      id="time"
                      name="Get Current Time"
                      description="Expose the current time in UTC to your Agent."
                      isChecked={builderForm.values.tools.includes("time")}
                      onCheckedChange={makeToolChangeHandler("time")}
                      disabled={isTargetDeployedAgent}
                    />
                    <ToolEntry
                      id="calculator"
                      name="Calculator"
                      description="Allow your Agent to use a powerful calculator (basic arithmetic, advanced calculus, equation solving, matrix operations)."
                      isChecked={builderForm.values.tools.includes("calculator")}
                      onCheckedChange={makeToolChangeHandler("calculator")}
                      disabled={isTargetDeployedAgent}
                    />
                    <ToolEntry
                      id="browser"
                      name="AgentCore Browser"
                      description="Allow your Agent to use a headless browser."
                      isChecked={builderForm.values.tools.includes("browser")}
                      onCheckedChange={makeToolChangeHandler("browser")}
                      disabled={isTargetDeployedAgent}
                    />
                    <ToolEntry
                      id="code_interpreter"
                      name="AgentCore Code Interpreter"
                      description="Allow your Agent to use a code interpreter."
                      isChecked={builderForm.values.tools.includes("code_interpreter")}
                      onCheckedChange={makeToolChangeHandler("code_interpreter")}
                      disabled={isTargetDeployedAgent}
                    />
                  </Stack>
                </Field.Root>
              </Box>


            </Fieldset.Content>
          </Fieldset.Root>
        </GridItem>

        <GridItem colSpan={3} height="100%">
          <Container
            maxHeight="100vh"
            height="100%"
            padding={0}
          >
            <Box
              position="absolute"
              top="200px"
              left="100px"
              width="400px"
              height="400px"
              borderRadius="400px"
              background="#FF86E1"
              filter="blur(250px)"
              zIndex="0"
            />
            <Box
              position="absolute"
              top="50px"
              left="350px"
              width="280px"
              height="280px"
              borderRadius="280px"
              background="#89BCFF"
              filter="blur(150px)"
              zIndex="0"
            />

            <Messages
              height="calc(100% - 8rem)"
              messages={isTargetDeployedAgent ? invokeForm.values.messages : builderForm.values.messages}
              streamingMessage={streamingResponse}
              clearConversation={clearConversation}
            />
            <Box
              position="absolute"
              bottom="0"
              width="100%"
              height="8rem"
              zIndex="100"
            >
              <Stack padding="2px" background="linear-gradient(45deg, #c89eff, #5cb5fe)" borderRadius="24px" backgroundColor="#FFF">
                <Stack direction="row" width="100%" height="100%" background="#FFF" borderRadius="22px" padding="16px">
                  <Field.Root required={true} invalid={!!builderForm.errors.messages}>
                    <Textarea
                      height="4rem"
                      size="lg"
                      rows={3}
                      placeholder='Test your agent.'
                      value={nextMessage}
                      onChange={handleNextMessageChange}
                      resize="none"
                      border="none"
                      outlineWidth={0}
                      padding="0px"
                    />
                  </Field.Root>
                  <Button
                    alignSelf="flex-end"
                    loading={isTargetDeployedAgent ? invokeForm.isSubmitting : builderForm.isSubmitting}
                    onClick={isTargetDeployedAgent ? invokeForm.handleSubmit : builderForm.handleSubmit}
                    backgroundColor="#F19100"
                    borderRadius="24px"
                    width="40px"
                    height="40px">
                    <GoArrowUp />
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Container>
        </GridItem>
      </SimpleGrid>
    </Container>
  )
}

export default App
