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

export async function showCode(payload) {
  return apiFetch("/api/preview", {
    method: "POST",
    body: payload,
  })
}

export function deploy(payload) {
  return apiStream("/api/deploy", {
    method: "POST",
    body: payload,
  })
}
