import { Box, Button, Container, Dialog, Field, Portal, Stack, Textarea } from "@chakra-ui/react";
import { useState } from "react";
import { useFormik } from "formik";
import { GoArrowUp } from "react-icons/go";
import { omit } from 'lodash'

import { toaster } from './components/ui/toaster'
import { transformStreamedMessage } from './utils/messages'
import Messages from "./Messages";
import { invoke, retrieveConfig } from "./api/api";
import { useQuery } from "@tanstack/react-query";

export default function InvokeDeployedAgentButton() {
  const configQuery = useQuery({
    queryKey: ["config"],
    queryFn: retrieveConfig
  })
  const [isOpen, setIsOpen] = useState(false)
  const [nextMessage, setNextMessage] = useState("")
  const [streamingMessage, setStreamingMessage] = useState({
    isStreaming: false,
    role: "assistant",
    content: []
  })
  const formik = useFormik({
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

      await formik.setValues(payload)
      setNextMessage(_ => "")

      const m = { role: "assistant", content: [], isStreaming: true }
      setStreamingMessage(m)

      try {
        for await (const event of invoke(payload)) {
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
        console.log(error)
        formik.setErrors(omit(error, ["message"]))
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

      setStreamingMessage({ role: "assistant", content: [], isStreaming: false })
    }
  })

  const clearConversation = () => formik.setFieldValue("messages", [])

  const isDisabled = !(
    configQuery.isSuccess
      && configQuery.data
      && configQuery.data["bedrock_agentcore"]
      && configQuery.data["bedrock_agentcore"]["agent_arn"]
  )

  return (
    <Dialog.Root open={isOpen} onOpenChange={e => setIsOpen(e.open)}>
      <Dialog.Trigger asChild>
        <Button variant="subtle" disabled={isDisabled}>Invoke Deployed Agent</Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxWidth="49rem">
            <Dialog.Header>
              <Dialog.Title>Invoke Deployed Agent</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Container
                backgroundColor="gray.100"
                borderColor="gray.200"
                borderWidth="thin"
                borderRadius="xl"
                height="100%"
                minHeight="36rem"
                maxHeight="calc(100% - 2rem)"
                padding={0}
              >
                <Messages messages={formik.values.messages} streamingMessage={streamingMessage} height="28rem" clearConversation={clearConversation} />
                <Box
                  position="absolute"
                  bottom="0"
                  width="100%"
                  height="8rem"
                  backgroundColor="gray.100"
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
                        placeholder='Type your prompt.'
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
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Close</Button>
              </Dialog.ActionTrigger>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
