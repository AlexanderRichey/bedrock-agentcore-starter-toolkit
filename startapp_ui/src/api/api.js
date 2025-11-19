import { apiFetch, apiStream } from "../utils/apiFetch";

export function invokeStream(payload) {
  return apiStream("/api/invoke", {
    method: "POST",
    body: payload,
  })
}

export async function retrieveMcpTools(payload) {
  return apiFetch("/api/mcptools", {
    method: "POST",
    body: payload,
  })
}
