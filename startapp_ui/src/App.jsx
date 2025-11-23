import { Box, Button, Container, Field, Fieldset, GridItem, Heading, NativeSelect, SimpleGrid, Stack, Text, Textarea } from '@chakra-ui/react'
import { useState } from 'react'
import { useFormik } from 'formik'
import { GoArrowUp } from 'react-icons/go'
import { omit } from 'lodash'

import ToolEntry from './ToolEntry'
import Messages from './Messages'
import DeployButton from './DeployButton'
import { invokePreview } from './api/api'
import { toaster } from './components/ui/toaster'
import { transformStreamedMessage } from './utils/messages'
import ShowCodeButton from './ShowCodeButton'
import InvokeDeployedAgentButton from './InvokeDeployedAgentButton'

function App() {
  const [nextMessage, setNextMessage] = useState("")
  const [streamingMessage, setStreamingMessage] = useState({
    isStreaming: false,
    role: "assistant",
    content: []
  })
  const formik = useFormik({
    initialValues: {
      modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      tools: ["time", "calculator", "browser", "code_interpreter"],
      mcpServers: [],
      system: "You are a helpful AI assistant.",
      messages: [],
      maxIterations: 32,
    },
    onSubmit: async (values) => {
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
        formik.setErrors(formErrors)
        return
      }

      const payload = Object.assign(values, {
        messages: [...values.messages, {
          isToolUse: false,
          role: "user",
          content: [{ "text": nextMessage }]
        }]
      })

      await formik.setValues(payload)
      setNextMessage(_ => "")

      const m = { role: "assistant", content: [], isStreaming: true }
      setStreamingMessage(m)
      try {
        for await (const event of invokePreview(payload)) {
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
            }
          }
          setStreamingMessage(Object.assign({}, m))
        }

        await formik.setFieldValue("messages", [...payload.messages, ...transformStreamedMessage(m)])
      } catch (error) {
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
      }

      setStreamingMessage({ role: "assistant", content: [], isStreaming: false })
    }
  })

  const makeToolChangeHandler = (toolId) => () => {
    const isChecked = formik.values.tools.includes(toolId)
    const newToolsList = isChecked
      ? formik.values.tools.filter((v) => v !== toolId)
      : formik.values.tools.concat([toolId])
    formik.setFieldValue("tools", newToolsList)
  }

  const handleNextMessageChange = (e) => setNextMessage(e.currentTarget.value)

  const clearConversation = () => formik.setFieldValue("messages", [])

  return (
    <Container padding="1rem" height="100dvh">
      <Container paddingY={3} paddingX={0} height="4rem" display="flex" alignItems="center" justifyContent="space-between">
        <Heading>AgentCore Explorer</Heading>
        <Stack direction="row" gap={3}>
          <InvokeDeployedAgentButton />
          <ShowCodeButton values={formik.values} />
          <DeployButton values={formik.values} />
        </Stack>
      </Container>
      <SimpleGrid columns={5} gap={4} height="calc(100% - 4rem)">
        <GridItem colSpan={2}>
          <Fieldset.Root>
            <Stack>
              <Fieldset.Legend>
                Specify your agent
              </Fieldset.Legend>
              <Fieldset.HelperText>
                An agent consists of a model, tools, and a prompt.
              </Fieldset.HelperText>
            </Stack>

            <Fieldset.Content>
              <Field.Root required={true} invalid={!!formik.errors.modelId}>
                <Field.Label>Model</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    name='modelId'
                    value={formik.values.modelId}
                    onChange={formik.handleChange}
                  >
                    <option value="us.anthropic.claude-sonnet-4-5-20250929-v1:0">Claude Sonnet 4.5</option>
                    <option value="us.anthropic.claude-sonnet-4-20250514-v1:0">Claude Sonnet 4</option>
                    <option value="us.anthropic.claude-haiku-4-5-20251001-v1:0">Claude Haiku 4.5</option>
                    <option value="us.anthropic.claude-3-5-haiku-20241022-v1:0">Claude Haiku 3.5</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <Field.ErrorText>{formik.errors.modelId}</Field.ErrorText>
              </Field.Root>

              <Field.Root required={true} invalid={!!formik.errors.modelId}>
                <Field.Label>Framework</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    name='sdk'
                    value={formik.values.sdk}
                    onChange={formik.handleChange}
                  >
                    <option value="strands-sdk">Strands SDK</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <Field.ErrorText>{formik.errors.modelId}</Field.ErrorText>
              </Field.Root>


              <Box>
                <Text fontSize="sm" fontWeight="semibold" paddingBottom={2}>Tools</Text>

                <Field.Root paddingX={1}>
                  <Stack gap={2}>
                    <ToolEntry
                      id="time"
                      name="Get Current Time"
                      description="Expose the current time in UTC to your Agent."
                      isChecked={formik.values.tools.includes("time")}
                      onCheckedChange={makeToolChangeHandler("time")}
                    />
                    <ToolEntry
                      id="calculator"
                      name="Calculator"
                      description="Allow your Agent to use a powerful calculator (basic arithmetic, advanced calculus, equation solving, matrix operations)."
                      isChecked={formik.values.tools.includes("calculator")}
                      onCheckedChange={makeToolChangeHandler("calculator")}
                    />
                    <ToolEntry
                      id="browser"
                      name="AgentCore Browser"
                      description="Allow your Agent to use a headless browser."
                      isChecked={formik.values.tools.includes("browser")}
                      onCheckedChange={makeToolChangeHandler("browser")}
                    />
                    <ToolEntry
                      id="code_interpreter"
                      name="AgentCore Code Interpreter"
                      description="Allow your Agent to use a code interpreter."
                      isChecked={formik.values.tools.includes("code_interpreter")}
                      onCheckedChange={makeToolChangeHandler("code_interpreter")}
                    />
                  </Stack>
                </Field.Root>
              </Box>

              <Field.Root required={true} invalid={!!formik.errors.system}>
                <Field.Label>Prompt</Field.Label>
                <Textarea
                  name="system"
                  value={formik.values.system}
                  onChange={formik.handleChange}
                  size="lg"
                  placeholder='Tell your agent what its goal is.'
                  height="100%"
                  resize="none"
                  rows={12}
                />
                <Field.ErrorText>{formik.errors.system}</Field.ErrorText>
              </Field.Root>
            </Fieldset.Content>
          </Fieldset.Root>
        </GridItem>

        <GridItem colSpan={3} height="100%" padding={0}>
          <Stack height="2rem">
            <Text fontWeight="semibold" fontSize="sm">
              Test your agent
            </Text>
          </Stack>

          <Container
            backgroundColor="gray.100"
            borderColor="gray.200"
            borderWidth="thin"
            borderRadius="xl"
            maxHeight="48rem"
            height="calc(100% - 2rem)"
            padding={0}
          >
            <Messages height="calc(100% - 8rem)" messages={formik.values.messages} streamingMessage={streamingMessage} clearConversation={clearConversation} />
            <Box
              position="absolute"
              bottom="0"
              width="100%"
              height="8rem"
              borderTopColor="gray.200"
              borderTopWidth="thin"
            >
              <Stack direction="row" padding={4}>
                <Field.Root required={true} invalid={!!formik.errors.messages}>
                  <Textarea
                    size="lg"
                    rows={3}
                    backgroundColor="white"
                    placeholder='Test your agent.'
                    value={nextMessage}
                    onChange={handleNextMessageChange}
                    resize="none"
                  />
                </Field.Root>
                <Button alignSelf="flex-end" loading={formik.isSubmitting} onClick={formik.handleSubmit}>
                  <GoArrowUp />
                </Button>
              </Stack>
            </Box>
          </Container>
        </GridItem>
      </SimpleGrid>
    </Container>
  )
}

export default App
