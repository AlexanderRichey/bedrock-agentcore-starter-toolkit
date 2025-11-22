import { Button, Dialog, Portal, Text } from "@chakra-ui/react";
import { useState } from "react";

export default function DeployButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog.Root open={isOpen} onOpenChange={e => setIsOpen(e.open)}>
      <Dialog.Trigger asChild>
        <Button variant="solid">Deploy to AgentCore</Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Deploy to AgentCore</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>This feature hasn't been implemented yet!</Text>
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
