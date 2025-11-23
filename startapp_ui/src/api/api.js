import { apiFetch, apiStream } from "../utils/apiFetch";

export function invokePreview(payload) {
  return apiStream("/api/invoke-preview", {
    method: "POST",
    body: payload,
  })
}

export function invoke(payload) {
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
  return apiFetch("/api/code-preview", {
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

export async function retrieveConfig() {
  return apiFetch("/api/config", {
    method: "GET"
  })
}
