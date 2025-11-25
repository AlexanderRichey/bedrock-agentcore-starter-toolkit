import { useState } from "react";
import { transformStreamedMessage } from "../utils/messages";
import { useCallback } from "react";

export function useChat({ invokeFn }) {
  const [streamingResponse, setStreamingResponse] = useState({
    isStreaming: false,
    role: "assistant",
    content: []
  })

  const resetStreamingResponse = () => setStreamingResponse({ role: "assistant", content: [], isStreaming: false })

  const chat = useCallback(async (payload) => {
    const m = { role: "assistant", content: [], isStreaming: true }
    setStreamingResponse(m)
    for await (const event of invokeFn(payload)) {
      if (event.textDelta) {
        if (m.content.length === 0 || !(m.content[m.content.length - 1].hasOwnProperty("text"))) {
          m.content.push({ text: event.textDelta })
        } else {
          m.content[m.content.length - 1].text += event.textDelta
        }
      }
      if (event.toolUseDelta) {
        const found = m.content.find(mm => mm.id && mm.id === event.toolUseDelta.id)
        if (found) {
          found.response = event.toolUseDelta.response
        } else {
          m.content.push(event.toolUseDelta)
        }
      }
      setStreamingResponse(Object.assign({}, m))
    }

    return transformStreamedMessage(m)
  }, [invokeFn])

  return {
    streamingResponse,
    resetStreamingResponse,
    chat
  }
}
