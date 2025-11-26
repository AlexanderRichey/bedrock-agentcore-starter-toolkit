import { Field, Switch } from "@chakra-ui/react";

export default function ToolEntry({
  name,
  id,
  description,
  isChecked,
  onCheckedChange,
  disabled
}) {
  return (
    <Field.Root disabled={disabled}>
      <Switch.Root checked={isChecked} onCheckedChange={onCheckedChange} style={{
        display: "flex",
        justifyContent: "space-between", // pushes label and control apart
        alignItems: "center",
        width: "100%",                  // take full container width
        gap: "16px",                     // optional gap between label and control
      }}>
        <Switch.HiddenInput />
        <Switch.Label>
          <Field.Label>{name}</Field.Label>
          <Field.HelperText>{description}</Field.HelperText>
        </Switch.Label>
        <Switch.Control
          width="40px"
          height="20px"
          borderRadius="10px"
          colorPalette="purple"
          bg={isChecked ? "#622DD2" : "#E4E4E7"} // track color
          transition="background-color 0.3s"
          sx={{
            ".chakra-switch__thumb": {
              background: "white",
              boxShadow: "none",
            },
          }}
          />

      </Switch.Root>
    </Field.Root>
  )
}
