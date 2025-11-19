import { Button, Dialog, Field, Fieldset, Input, Portal } from "@chakra-ui/react";
import { useFormik } from "formik";
import { useState } from "react";
import { GoPlus } from "react-icons/go";
import { useRetrieveMcpTools } from "./hooks/mcp";

export default function MCPSelector({ setMcpServers, setTools }) {
  const [isOpen, setIsOpen] = useState(false)
  const mutation = useRetrieveMcpTools()
  const formik = useFormik({
    initialValues: {
      name: '',
      url: '',
      token: '',
    },
    onSubmit: async (values) => {
      const response = await mutation.mutateAsync(values)
      setMcpServers((servers) => [...servers, values])
      setTools((tools) => [...tools, ...(response.tools.map(tool => ({
        name: `@${values.name}/${tool.name}`,
        description: tool.description,
      })))])
      formik.resetForm()
      setIsOpen(false)
    }
  })

  return (
    <Dialog.Root open={isOpen} onOpenChange={e => setIsOpen(e.open)}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="solid"><GoPlus /> Add Tools</Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Add MCP Server</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Fieldset.Root>
                <Fieldset.Content>
                  <Field.Root required={true} invalid={mutation.error?.hasOwnProperty("name")}>
                    <Field.Label>
                      Logical Name
                      <Field.RequiredIndicator />
                    </Field.Label>
                    <Field.HelperText>A logical name for the MCP server to be used to reference tools.</Field.HelperText>
                    <Input name="name" required value={formik.values.name} onChange={formik.handleChange} />
                    <Field.ErrorText>{mutation.error?.name}</Field.ErrorText>
                  </Field.Root>

                  <Field.Root required={true} invalid={mutation.error?.hasOwnProperty("url") || mutation.error?.hasOwnProperty("message")}>
                    <Field.Label>
                      URL
                      <Field.RequiredIndicator />
                    </Field.Label>
                    <Field.HelperText>The URL of the MCP server.</Field.HelperText>
                    <Input name="url" required value={formik.values.url} onChange={formik.handleChange} />
                    <Field.ErrorText>{mutation.error?.url || mutation.error?.message}</Field.ErrorText>
                  </Field.Root>

                  <Field.Root required={false} invalid={mutation.error?.hasOwnProperty("token")}>
                    <Field.Label>
                      Bearer Token
                      <Field.RequiredIndicator />
                    </Field.Label>
                    <Field.HelperText>An optional bearer token for the MCP server.</Field.HelperText>
                    <Input name="token" value={formik.values.token} onChange={formik.handleChange} />
                    <Field.ErrorText>{mutation.error?.token}</Field.ErrorText>
                  </Field.Root>
                </Fieldset.Content>
              </Fieldset.Root>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button loading={formik.isSubmitting} onClick={formik.handleSubmit}>Retrieve Tools</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
