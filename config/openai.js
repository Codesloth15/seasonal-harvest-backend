// Compatibility shim for older imports. New code should import from config/anthropic.js.
export { getAnthropicClient as getOpenAIClient } from "./anthropic.js";
