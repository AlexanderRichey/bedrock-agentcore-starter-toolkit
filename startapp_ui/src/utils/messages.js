export const transformStreamedMessage = (m) => {
  const messages = []
  for (let index = 0; index < m.content.length; index++) {
    const block = m.content[index];
    const nextIndex = index + 1
    if (m.content.length > nextIndex) {
      const nextBlock = m.content[nextIndex]
      if (nextBlock.id && !block.id) {
        messages.push({
          isToolUse: true,
          role: "assistant",
          content: [block],
          toolUse: [{
            id: nextBlock.id,
            name: nextBlock.name,
            type: "request",
            request: nextBlock.request,
          }]
        })
        messages.push({
          isToolUse: true,
          role: "user",
          toolUse: [{
            id: nextBlock.id,
            name: nextBlock.name,
            type: "response",
            response: nextBlock.response,
          }]
        })
        index++
      } else if (block.id) {
        messages.push({
          isToolUse: true,
          role: "assistant",
          content: [],
          toolUse: [{
            id: block.id,
            name: block.name,
            type: "request",
            request: block.request,
          }]
        })
        messages.push({
          isToolUse: true,
          role: "user",
          toolUse: [{
            id: block.id,
            name: block.name,
            type: "response",
            response: block.response,
          }]
        })
      }
    } else {
      if (block.id) {
        messages.push({
          isToolUse: true,
          role: "assistant",
          content: [],
          toolUse: [{
            id: block.id,
            name: block.name,
            type: "request",
            request: block.request,
          }]
        })
        messages.push({
          isToolUse: true,
          role: "user",
          toolUse: [{
            id: block.id,
            name: block.name,
            type: "response",
            response: block.response,
          }]
        })
      } else {
        messages.push({
          isToolUse: false,
          role: "assistant",
          content: [block]
        })
      }
    }
  }
  return messages
}
