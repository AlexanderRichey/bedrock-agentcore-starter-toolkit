import { Button, CodeBlock, Dialog, Flex, IconButton, Portal } from "@chakra-ui/react";
import { GoX } from 'react-icons/go'
import { useEffect, useRef, useState } from "react";
import { deploy } from "./api/api";
import { toaster } from "./components/ui/toaster";
import { useQueryClient } from "@tanstack/react-query";

export default function DeployButton({ values, setTargetToDeployed }) {
  const [isOpen, setIsOpen] = useState(false)
  const [consoleState, setConsoleState] = useState("")
  const [hasDeployed, setHasDeployed] = useState(false)
  const done = useRef(false)
  const scrollRef = useRef(null)
  const queryClient = useQueryClient()

  const handleOpenChange = (state) => {
    if (state) {
      setIsOpen(true)
    } else {
      if (done.current) {
        return
      }
      setIsOpen(false)
      setConsoleState("")
    }
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [consoleState]);

  useEffect(() => {
    if (!done.current && isOpen) {
      done.current = true

      async function doDeploy() {
        try {
          for await (const event of deploy({
            modelId: values.modelId,
            tools: values.tools,
            system: values.system
          })) {
            if (event.textDelta) {
              setConsoleState(state => state + event.textDelta)
            }
          }
          setTargetToDeployed()
        } catch (error) {
          toaster.create({
            type: "error",
            title: "Ah, dang it!",
            description: error.message || "That didn't work."
          })
        }

        queryClient.invalidateQueries({
          queryKey: ["config"]
        })

        setHasDeployed(true)
        done.current = false
      }

      doDeploy()
    }
  }, [isOpen])

  return (
    <Dialog.Root open={isOpen} onOpenChange={e => handleOpenChange(e.open)}>
      <Dialog.Trigger asChild>
        <Button
          variant="solid"
          borderRadius="20px"
        >
          Deploy
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxWidth="59rem">
            <Dialog.Header>
              <Flex justifyContent="space-between" alignItems="center" width="100%">
                <Dialog.Title>Deploy to AgentCore</Dialog.Title>
                <Dialog.ActionTrigger asChild>
                  <IconButton variant="ghost" disabled={!hasDeployed}>
                    <GoX />
                  </IconButton>
                </Dialog.ActionTrigger>
              </Flex>
            </Dialog.Header>
            <Dialog.Body>
              <CodeBlock.Root
                ref={scrollRef}
                code={consoleState}
                language="bash"
                width="56rem"
                height="40rem"
                overflow="scroll"
              >
                <CodeBlock.Content>
                  <CodeBlock.Code>
                    <CodeBlock.CodeText />
                  </CodeBlock.Code>
                </CodeBlock.Content>
              </CodeBlock.Root>
            </Dialog.Body>
            <Dialog.Footer>
              {hasDeployed && (
                <Flex alignItems="flex-end">
                  <Dialog.ActionTrigger asChild>
                    <Button variant="outline" borderRadius="20px">Close</Button>
                  </Dialog.ActionTrigger>
                </Flex>
              )}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
