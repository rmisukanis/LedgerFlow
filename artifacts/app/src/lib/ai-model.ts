import { useSyncExternalStore } from "react"

export type AiProvider = "grok" | "gemini"

export const AI_MODELS: { value: AiProvider; label: string }[] = [
  { value: "grok", label: "Grok" },
  { value: "gemini", label: "Gemini" },
]

const STORAGE_KEY = "ledgerflow.aiModel"

function read(): AiProvider {
  try {
    return localStorage.getItem(STORAGE_KEY) === "gemini" ? "gemini" : "grok"
  } catch {
    return "grok"
  }
}

let current = read()
const listeners = new Set<() => void>()

export function getAiModel(): AiProvider {
  return current
}

export function setAiModel(next: AiProvider) {
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // The choice still applies for this page load.
  }
  listeners.forEach(listener => listener())
}

export function aiModelLabel(provider: AiProvider) {
  return provider === "gemini" ? "Gemini" : "Grok"
}

export function useAiModel() {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getAiModel,
    () => "grok" as AiProvider,
  )
}
