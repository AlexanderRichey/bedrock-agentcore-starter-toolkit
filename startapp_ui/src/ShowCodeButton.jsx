import { Button, CodeBlock, Dialog, Portal, Spinner } from "@chakra-ui/react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createShikiAdapter } from "@chakra-ui/react"
import { showCode } from "./api/api";
import { toaster } from "./components/ui/toaster";

const shikiAdapter = createShikiAdapter({
  async load() {
    const { createHighlighterCore } = await import("shiki/core")
    const { createJavaScriptRegexEngine } = await import("shiki/engine/javascript")
    const githubDark = await import("shiki/themes/github-dark-default.mjs")
    const python = await import("shiki/langs/python.mjs")
    return createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      langs: [python],
      themes: [githubDark],
    })
  },
  theme: "github-dark-default"
})

export default function ShowCodeButton({ values }) {
  const [isOpen, setIsOpen] = useState(false)

  const mut = useMutation({
    mutationFn: async () => {
      try {
        return await showCode({
          modelId: values.modelId,
          tools: values.tools,
          system: values.system
        })
      } catch (error) {
        toaster.create({
          type: "error",
          title: "Ah, dang it!",
          description: error.message || "Something has gone wrong."
        })
        throw error
      }
    }
  })

  useEffect(() => {
    if (isOpen && !mut.isPending) {
      mut.mutate()
    }
  }, [isOpen])

  return (
    <Dialog.Root open={isOpen} onOpenChange={e => setIsOpen(e.open)}>
      <Dialog.Trigger asChild>
        <Button variant="subtle" borderRadius="20px">Show Code</Button>
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
