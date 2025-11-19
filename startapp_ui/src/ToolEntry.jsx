import { Field, Switch } from "@chakra-ui/react";

export default function ToolEntry({
  name,
  id,
  description,
  isChecked,
  onCheckedChange
}) {
  return (
    <Field.Root>
      <Switch.Root checked={isChecked} onCheckedChange={onCheckedChange}>
        <Switch.HiddenInput />
        <Switch.Control />
        <Switch.Label>
          <Field.Label>{name}</Field.Label>
          <Field.HelperText>{description}</Field.HelperText>
        </Switch.Label>
      </Switch.Root>
    </Field.Root>
  )
}
