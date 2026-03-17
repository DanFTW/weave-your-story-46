

## Problem

The LLM buttons use `window.open(url, "_blank")` which opens the web browser. Inside the Median native app, this should use `median.window.open()` with `'external'` mode to trigger the OS URL handler, which will open the native app via Universal Links/App Links if installed.

Additionally, the URLs should be updated to the canonical domains that are registered as Universal Links by each app:
- ChatGPT: `https://chatgpt.com` (the app registers this domain for Universal Links)
- Claude: `https://claude.ai` (already correct)
- Gemini: `https://gemini.google.com/app` (the `/app` path is more likely to trigger the native app)

## Research findings

None of these apps expose custom URL schemes (`chatgpt://`, etc.) publicly. They all rely on Universal Links (iOS) and App Links (Android) on their web domains. The key is to open these URLs through the OS rather than in an in-app browser, so the OS can intercept and redirect to the native app.

## Plan — 1 file: `src/components/flows/llm-import/LLMImportConfig.tsx`

### Update `llmLinks` URLs (lines 15-19)

Change `https://chat.openai.com` to `https://chatgpt.com` (canonical Universal Link domain). Keep Claude as-is. Keep Gemini as-is.

### Update click handler (line 133)

Import `median` and `isMedian` from `@/utils/median`. Replace `window.open(llm.url, "_blank")` with logic that:
1. If inside Median app: use `median.window.open(url, 'external')` to hand the URL to the OS, which triggers Universal Link / App Link handling (opens native app if installed, browser otherwise)
2. Otherwise: fall back to `window.open(url, "_blank")`

### Summary

| Line | Change |
|------|--------|
| 1 | Add import for `median, isMedian` |
| 16 | Update ChatGPT URL to `https://chatgpt.com` |
| 133 | Use `isMedian() ? median.window.open(url, 'external') : window.open(url, '_blank')` |

