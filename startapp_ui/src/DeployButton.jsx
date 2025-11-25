import { Button, CodeBlock, Dialog, Portal } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { deploy } from "./api/api";
import { toaster } from "./components/ui/toaster";
import { useQueryClient } from "@tanstack/react-query";

export default function DeployButton({ values, setTargetToDeployed }) {
  const [isOpen, setIsOpen] = useState(false)
  const [consoleState, setConsoleState] = useState("")
  const done = useRef(false)
  const scrollRef = useRef(null)
  const queryClient = useQueryClient()

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
      }

      doDeploy()
    }
  }, [isOpen])

  return (
    <Dialog.Root open={isOpen} onOpenChange={e => setIsOpen(e.open)}>
      <Dialog.Trigger asChild>
        <Button variant="solid" borderRadius="20px">Deploy</Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxWidth="49rem">
            <Dialog.Header>
              <Dialog.Title>Deploy to AgentCore</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <CodeBlock.Root
                ref={scrollRef}
                code={consoleState}
                language="bash"
                width="46rem"
                height="30rem"
                overflow="scroll"
              >
                <CodeBlock.Content>
                  <CodeBlock.Code>
                    <CodeBlock.CodeText />
                  </CodeBlock.Code>
                </CodeBlock.Content>
              </CodeBlock.Root>
            </Dialog.Body>
            <Dialog.Footer />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
