import { Button, CodeBlock, Dialog, Portal, Spinner, Text } from "@chakra-ui/react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createShikiAdapter } from "@chakra-ui/react"
import { showCode } from "./api/api";

const shikiAdapter = createShikiAdapter({
  async load() {
    const { createHighlighter } = await import("shiki")
    return createHighlighter({
      langs: ["python"],
      themes: ["github-dark"],
    })
  },
  theme: "github-dark"
})

export default function ShowCodeButton({ values }) {
  const [isOpen, setIsOpen] = useState(false)

  const mut = useMutation({
    mutationFn: () => showCode({
      modelId: values.modelId,
      tools: values.tools,
      system: values.system
    })
  })

  useEffect(() => {
    if (isOpen && !mut.isPending) {
      mut.mutateAsync()
    }
  }, [isOpen])

  return (
    <Dialog.Root open={isOpen} onOpenChange={e => setIsOpen(e.open)}>
      <Dialog.Trigger asChild>
        <Button variant="subtle">Show Code</Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxWidth="100ch">
            <Dialog.Header>
              <Dialog.Title>Code</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {mut.isPending && <Spinner />}
              {mut.isSuccess && (
                <CodeBlock.AdapterProvider value={shikiAdapter}>
                  <CodeBlock.Root
                    language="python"
                    title="main.py"
                    code={mut.data.files["src/main.py"]}
                    maxHeight="40rem"
                    overflow="auto"
                  >
                    <CodeBlock.Header>
                      <CodeBlock.Title>main.py</CodeBlock.Title>
                      <CodeBlock.Control>
                        <CodeBlock.CopyTrigger />
                        <CodeBlock.CollapseTrigger />
                      </CodeBlock.Control>
                    </CodeBlock.Header>
                    <CodeBlock.Content>
                      <CodeBlock.Code>
                        <CodeBlock.CodeText />
                      </CodeBlock.Code>
                    </CodeBlock.Content>
                  </CodeBlock.Root>
                </CodeBlock.AdapterProvider>
              )}
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
