import { Box, Button, Code, Flex, ScrollArea, Stack, Status } from "@chakra-ui/react";
import Markdown from "react-markdown";
import { Prose } from "./components/ui/prose";
import { useEffect, useRef } from "react";

function groupMessages(messages) {
  const grouped = []
  for (let index = 0; index < messages.length; index++) {
    const element = messages[index];
    if (element.isToolUse) {
      if (element.content && element.content.length > 0) {
        grouped.push({
          type: "text",
          role: element.role,
          content: element.content
        })
      }

      const toolUses = element.toolUse.map(tu => ({
        type: "toolUse",
        id: tu.id,
        name: tu.name,
        request: tu.request,
        response: null,
      }))

      // Look ahead, in case toolUses have resolved.
      const nextMessageIdx = index + 1
      if (messages.length > nextMessageIdx) {
        const nextMessage = messages[nextMessageIdx]
        nextMessage.toolUse.forEach(tu => {
          const found = toolUses.find((ptu) => ptu.id === tu.id)
          if (found) {
            found.response = tu.response
          }
        });
      }

      grouped.push(...toolUses)

      index++
    } else {
      grouped.push({
        type: "text",
        role: element.role,
        content: element.content
      })
    }
  }
  return grouped
}

function Message({ role, content }) {
  const isUser = role === 'user'
  return (
    <Flex
      paddingX={4}
      paddingY={1}
      background="whiteAlpha.800"
      color="black"
      borderColor="white"
      borderWidth="thin"
      borderRadius="20px"
      width="fit-content"
      alignSelf={isUser ? 'flex-end' : 'flex-start'}
    >
      {content.map((c, i) => {
        if (c.text) {
          return <Prose key={i}><Markdown>{c.text}</Markdown></Prose>
        } else {
          return <Box key={i} />
        }
      })}
    </Flex>
  )
}

function ToolUse({ id, name, request, response }) {
  let color = "blue"
  if (request && response) {
    if (response.status === "success") {
      color = "green"
    } else {
      color = "red"
    }
  }

  return (
    <Flex
      paddingY={2}
      paddingX={4}
      background='whiteAlpha.800'
      color='black'
      borderRadius="20px"
      borderColor="gray.200"
      borderWidth="thin"
      width="fit-content"
      alignSelf='flex-start'
    >
      <Stack direction="row">
        <Status.Root colorPalette={color}>
          <Status.Indicator />
        </Status.Root>
        <Code>{name}</Code>
      </Stack>
    </Flex>
  )
}

function StreamingMessage({ content }) {
  return content.map((block, i) => {
    if (block.text) {
      return <Message key={`sm${i}`} role="assistant" content={[block]} />
    }
    if (block.id) {
      return <ToolUse key={`sm${i}`} {...block} />
    }
  })
}

export default function Messages({ height, messages, streamingMessage, clearConversation }) {
  const scrollRef = useRef(null)
  const grouppedMessages = groupMessages(messages)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingMessage]);

  return (
    <ScrollArea.Root
      position="absolute"
      top="0"
      width="100%"
      height="100%"
      maxHeight={height}
    >
      <ScrollArea.Viewport
        ref={scrollRef}
      >
        <ScrollArea.Content>
          <Stack paddingTop={8} paddingLeft={4} paddingRight={4} paddingBottom={4} gapY={6}>
            {grouppedMessages.map((m, i) => m.type === "text"
              ? <Message key={i} role={m.role} content={m.content} />
              : <ToolUse key={i} id={m.id} name={m.name} request={m.request} response={m.response} />)}
            {streamingMessage.isStreaming && <StreamingMessage content={streamingMessage.content} />}
            {messages.length > 0 && (
              <Flex justifyContent="center">
                <Button onClick={clearConversation} size="sm" variant="ghost">
                  Clear Conversation
                </Button>
              </Flex>
            )}
          </Stack>
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar>
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner />
    </ScrollArea.Root>
  )
}
