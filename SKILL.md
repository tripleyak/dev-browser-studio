---
name: dev-browser-studio
description: Browser automation studio with video recording for UI/UX testing and QA. Use when users ask to test websites, record browser sessions, debug UI issues, perform visual QA, or automate browser workflows with video evidence. Trigger phrases include "record the browser", "test the UI", "capture video of", "debug the page", "QA the website", "visual test", or any browser interaction request requiring video proof.
---

# Dev Browser Studio

Browser automation with built-in video recording for UI/UX testing, debugging, and quality assurance. Write small, focused scripts to accomplish tasks incrementally while capturing video evidence of every interaction.

## Key Capabilities

- **Video Recording**: Start/stop recording on demand, get video files immediately
- **Persistent Pages**: Pages stay open between script executions
- **AI-Friendly Snapshots**: Structured page inspection optimized for AI assistants
- **Visual QA**: Perfect for UI testing, debugging, and quality assurance workflows

## Choosing Your Approach

- **Local/source-available sites**: Read the source code first to write selectors directly
- **Unknown page layouts**: Use `getAISnapshot()` to discover elements and `selectSnapshotRef()` to interact with them
- **Visual feedback**: Take screenshots and record videos to see what the user sees

## Setup

Two modes available. Ask the user if unclear which to use.

### Standalone Mode (Default)

Launches a new Chromium browser for fresh automation sessions.

```bash
./server.sh &
```

Add `--headless` flag if user requests it. **Wait for the `Ready` message before running scripts.**

### Extension Mode

Connects to user's existing Chrome browser. Use this when:

- The user is already logged into sites and wants you to do things behind an authed experience that isn't local dev.
- The user asks you to use the extension

**Start the relay server:**

```bash
npm install && npm run start-extension &
```

Wait for `Waiting for extension to connect...` followed by `Extension connected` in the console.

## Writing Scripts

Execute scripts inline using heredocs:

```bash
npx tsx <<'EOF'
import { connect, waitForPageLoad } from "@/client.js";

const client = await connect();
const page = await client.page("example", { viewport: { width: 1920, height: 1080 } });

await page.goto("https://example.com");
await waitForPageLoad(page);

console.log({ title: await page.title(), url: page.url() });
await client.disconnect();
EOF
```

### Key Principles

1. **Small scripts**: Each script does ONE thing (navigate, click, fill, check)
2. **Evaluate state**: Log/return state at the end to decide next steps
3. **Descriptive page names**: Use `"checkout"`, `"login"`, not `"main"`
4. **Disconnect to exit**: `await client.disconnect()` - pages persist on server
5. **Plain JS in evaluate**: `page.evaluate()` runs in browser - no TypeScript syntax

## Video Recording

Record browser sessions to WebM video using CDP Screencast:

```typescript
import { connect } from "@/client.js";

const client = await connect();
const page = await client.page("demo");
await page.goto("https://example.com");

// Start recording
await client.startRecording("demo", {
  maxWidth: 1280,   // default: 1280
  maxHeight: 720,   // default: 720
  quality: 80,      // JPEG quality 0-100, default: 80
});

// Perform interactions...
await page.click("a");
await page.screenshot({ path: "tmp/screenshot.png" });

// Stop recording and get video path
const { videoPath, durationMs, frameCount } = await client.stopRecording("demo");
console.log(`Video saved to: ${videoPath}`);

await client.disconnect();
```

Videos are saved to the `recordings/` directory as WebM files (VP9 codec). Requires `ffmpeg` installed for encoding; falls back to saving individual frames if unavailable.

## Client API

```typescript
const client = await connect();

// Get or create named page (viewport only applies to new pages)
const page = await client.page("name");
const pageWithSize = await client.page("name", { viewport: { width: 1920, height: 1080 } });

const pages = await client.list(); // List all page names
await client.close("name"); // Close a page
await client.disconnect(); // Disconnect (pages persist)

// ARIA Snapshot methods
const snapshot = await client.getAISnapshot("name"); // Get accessibility tree
const element = await client.selectSnapshotRef("name", "e5"); // Get element by ref

// Video Recording methods
await client.startRecording("name"); // Start recording page
const { videoPath, durationMs, frameCount } = await client.stopRecording("name"); // Stop and get video
const status = await client.getRecordingStatus("name"); // Check if recording
```

The `page` object is a standard Playwright Page.

## Waiting

```typescript
import { waitForPageLoad } from "@/client.js";

await waitForPageLoad(page); // After navigation
await page.waitForSelector(".results"); // For specific elements
await page.waitForURL("**/success"); // For specific URL
```

## Inspecting Page State

### Screenshots

```typescript
await page.screenshot({ path: "tmp/screenshot.png" });
await page.screenshot({ path: "tmp/full.png", fullPage: true });
```

### ARIA Snapshot (Element Discovery)

Use `getAISnapshot()` to discover page elements. Returns YAML-formatted accessibility tree:

```yaml
- banner:
  - link "Hacker News" [ref=e1]
  - navigation:
    - link "new" [ref=e2]
- main:
  - list:
    - listitem:
      - link "Article Title" [ref=e8]
      - link "328 comments" [ref=e9]
- contentinfo:
  - textbox [ref=e10]
    - /placeholder: "Search"
```

**Interpreting refs:**

- `[ref=eN]` - Element reference for interaction (visible, clickable elements only)
- `[checked]`, `[disabled]`, `[expanded]` - Element states
- `[level=N]` - Heading level
- `/url:`, `/placeholder:` - Element properties

**Interacting with refs:**

```typescript
const snapshot = await client.getAISnapshot("hackernews");
console.log(snapshot); // Find the ref you need

const element = await client.selectSnapshotRef("hackernews", "e2");
await element.click();
```

## Error Recovery

Page state persists after failures. Debug with:

```bash
npx tsx <<'EOF'
import { connect } from "@/client.js";

const client = await connect();
const page = await client.page("hackernews");

await page.screenshot({ path: "tmp/debug.png" });
console.log({
  url: page.url(),
  title: await page.title(),
  bodyText: await page.textContent("body").then((t) => t?.slice(0, 200)),
});

await client.disconnect();
EOF
```

## Scraping Data

For scraping large datasets, intercept and replay network requests rather than scrolling the DOM. See [references/scraping.md](references/scraping.md) for the complete guide covering request capture, schema discovery, and paginated API replay.
