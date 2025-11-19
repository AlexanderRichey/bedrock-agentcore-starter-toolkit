import { useMutation } from "@tanstack/react-query";
import { retrieveMcpTools } from "../api/api";

export function useRetrieveMcpTools() {
  return useMutation({
    throwOnError: false,
    mutationFn: retrieveMcpTools
  })
}
