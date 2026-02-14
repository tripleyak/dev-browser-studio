# Dev Browser Studio

**Version 1.2.0**

> A browser automation toolkit with video recording and an autonomous AI perception-action loop for UI testing, data extraction, and browser agent development.

---

## What is Dev Browser Studio?

Dev Browser Studio is a tool that lets you automate web browser actions (like clicking buttons, filling forms, and navigating websites) while **recording everything on video**. It also includes an **autonomous perception-action loop** that uses Claude's Vision API to see, reason about, and interact with web pages — no selectors or scripting required.

This is especially useful for:

- **Autonomous browser agents** - Give the AI a task and watch it navigate, click, and extract data
- **Testing websites** - Make sure buttons work, forms submit correctly, and pages load properly
- **Data extraction** - Scrape structured data from pages using natural language instructions
- **Debugging issues** - Record exactly what happens when something goes wrong
- **Quality assurance (QA)** - Verify that your website looks and works correctly

## Why Choose Dev Browser Studio?

### The Problem with Other Tools

Most browser automation tools (like Playwright or Selenium) can take screenshots, but they can't easily record videos of what's happening. When something goes wrong, you're left guessing what happened between screenshots.

### The Solution

Dev Browser Studio gives you **on-demand video recording**. You control exactly when recording starts and stops, and you get the video file immediately. No waiting, no complicated setup.

| Feature | Dev Browser Studio | Standard Playwright | Playwright MCP |
|---------|---------------|---------------------|----------------|
| Video Recording | Start/stop anytime | Only automatic, full session | No |
| Video Available | Immediately | After page closes | N/A |
| Console Log Capture | Yes, with timestamps | Manual setup required | No |
| AI-Parseable Output | Key frames + JSON | No | No |
| Autonomous Agent Loop | Yes (Claude Vision) | No | No |
| Persistent Pages | Yes | No | No |
| Recording Control | Full control | No control | N/A |

### Key Advantages

1. **Perception Loop** - Autonomous AI agent that sees, reasons, and acts on web pages
2. **On-Demand Recording** - Start and stop recording whenever you want
3. **Instant Access** - Get the video file immediately after stopping
4. **Console Log Capture** - Automatically captures console.log/warn/error during recordings
5. **AI-Parseable Output** - Extracts key frames as images + JSON summary for AI analysis
6. **Persistent Pages** - Pages stay open between scripts, so you don't lose your place
7. **Budget Controls** - Limit cycles, tokens, cost, and duration for agent runs
8. **Simple API** - Easy to use, even if you're new to programming

---

## Prerequisites

Before you can use Dev Browser Studio, you need to install a few things on your computer.

### Required Software

#### 1. Node.js (version 18 or later)

Node.js is a program that runs JavaScript code on your computer.

**How to check if you have it:**
```bash
node --version
```

If you see a number like `v18.0.0` or higher, you're good! If not, install it:

- **Mac**: `brew install node` (requires [Homebrew](https://brew.sh))
- **Windows**: Download from [nodejs.org](https://nodejs.org)
- **Linux**: `sudo apt install nodejs npm` (Ubuntu/Debian)

#### 2. npm (comes with Node.js)

npm is a package manager that installs JavaScript libraries.

**How to check:**
```bash
npm --version
```

#### 3. ffmpeg (for video encoding)

ffmpeg converts the recorded frames into video files.

**How to install:**

- **Mac**: `brew install ffmpeg`
- **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH
- **Linux**: `sudo apt install ffmpeg`

**How to check:**
```bash
ffmpeg -version
```

> **Note**: If you don't have ffmpeg, the tool will save individual image frames instead of a video file. The video feature works best with ffmpeg installed.

#### 4. Anthropic API Key (for perception loop)

The autonomous perception loop requires a Claude API key:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Get one at [console.anthropic.com](https://console.anthropic.com). Not needed for video recording or manual scripting.

#### 5. Claude Code (optional but recommended)

If you're using this as a Claude Code skill:

```bash
npm install -g @anthropic-ai/claude-code
```

---

## Installation

### Option 1: As a Claude Code Skill (Recommended)

If you use Claude Code, this is the easiest way to get started.

**Step 1: Clone the repository**
```bash
git clone https://github.com/tripleyak/dev-browser-studio.git ~/.claude/skills/dev-browser-studio
```

**Step 2: Install dependencies**
```bash
cd ~/.claude/skills/dev-browser-studio
npm install
```

**Step 3: Restart Claude Code**

Close and reopen Claude Code. The skill will be automatically available.

### Option 2: Standalone Installation

If you want to use this without Claude Code:

**Step 1: Clone the repository**
```bash
git clone https://github.com/tripleyak/dev-browser-studio.git
cd dev-browser-studio
```

**Step 2: Install dependencies**
```bash
npm install
```

**Step 3: Start the server**
```bash
npm run start-server
```

You should see:
```
Using persistent browser profile: /path/to/.browser-data
Recordings directory: /path/to/recordings
Browser launched with persistent profile...
HTTP API server running on port 9222
```

---

## Quick Start Guide

Here's a simple example to get you started. This script will:
1. Open a website
2. Start recording
3. Click around
4. Stop recording and save the video

### Example: Record a Website Visit

```typescript
import { connect, waitForPageLoad } from "./src/client.js";

// Connect to the browser server
const client = await connect();

// Create a new page called "demo"
const page = await client.page("demo");

// Go to a website
await page.goto("https://example.com");
await waitForPageLoad(page);

// Start recording
await client.startRecording("demo");
console.log("Recording started!");

// Do some actions (these will be recorded)
await page.click("a");  // Click a link
await waitForPageLoad(page);

// Take a screenshot too (optional)
await page.screenshot({ path: "screenshot.png" });

// Stop recording and get AI-parseable results
const result = await client.stopRecording("demo");
console.log(`Video saved to: ${result.videoPath}`);
console.log(`Duration: ${result.durationMs}ms`);
console.log(`Frames captured: ${result.frameCount}`);
console.log(`Console logs: ${result.consoleLogs?.length ?? 0}`);
console.log(`Key frames for AI: ${result.keyFramePaths?.join(", ")}`);
console.log(`Summary JSON: ${result.summaryPath}`);

// Disconnect (the page stays open for later)
await client.disconnect();
```

### Running the Example

Save the code above to a file called `demo.ts`, then run:

```bash
npx tsx demo.ts
```

Your video will be saved in the `recordings/` folder!

---

## How to Use

### Starting the Server

Before you can automate browsers, start the server:

```bash
# From the dev-browser-studio directory
npm run start-server
```

**Options:**
- Add `--headless` to run without showing the browser window
- The browser window is useful for debugging (you can see what's happening)

### Basic Operations

#### Creating and Using Pages

```typescript
import { connect } from "./src/client.js";

const client = await connect();

// Create or get a page by name
const page = await client.page("my-page");

// Pages persist! If you run this script again,
// you'll get the same page in the same state
```

#### Navigating Websites

```typescript
// Go to a URL
await page.goto("https://google.com");

// Wait for the page to fully load
await waitForPageLoad(page);

// Get current URL
console.log(page.url());

// Get page title
console.log(await page.title());
```

#### Interacting with Elements

```typescript
// Click a button or link
await page.click("button.submit");

// Type text into an input field
await page.fill("input[name='email']", "user@example.com");

// Select from a dropdown
await page.selectOption("select#country", "USA");

// Check a checkbox
await page.check("input[type='checkbox']");
```

#### Taking Screenshots

```typescript
// Screenshot of visible area
await page.screenshot({ path: "screenshot.png" });

// Screenshot of entire page (including scrolled content)
await page.screenshot({ path: "full-page.png", fullPage: true });
```

### Video Recording

This is what makes Dev Browser Studio special!

#### Start Recording

```typescript
await client.startRecording("page-name", {
  maxWidth: 1280,    // Video width (default: 1280)
  maxHeight: 720,    // Video height (default: 720)
  quality: 80,       // JPEG quality 0-100 (default: 80)
});
```

#### Stop Recording and Get Video

```typescript
const result = await client.stopRecording("page-name");

console.log(result.videoPath);   // Path to the video file
console.log(result.durationMs);  // Recording duration in milliseconds
console.log(result.frameCount);  // Number of frames captured
```

#### Check Recording Status

```typescript
const status = await client.getRecordingStatus("page-name");

if (status.isRecording) {
  console.log(`Recording since: ${status.startedAt}`);
  console.log(`Frames so far: ${status.frameCount}`);
}
```

### AI-Parseable Recording Output

Each recording produces three outputs designed for AI consumption:

1. **Video File** (WebM) - The full recording at `recordings/<timestamp>.webm`
2. **Key Frame Images** (JPEG) - Evenly-spaced frames that AI assistants can view directly
3. **Summary JSON** - Structured metadata including console logs

Example summary JSON:
```json
{
  "recording": {
    "videoPath": "recordings/1705432100000.webm",
    "durationMs": 5230,
    "frameCount": 157,
    "startedAt": "2024-01-16T20:15:00.000Z",
    "stoppedAt": "2024-01-16T20:15:05.230Z"
  },
  "consoleLogs": [
    {
      "timestamp": "2024-01-16T20:15:01.234Z",
      "level": "log",
      "text": "Button clicked",
      "url": "https://example.com/app"
    },
    {
      "timestamp": "2024-01-16T20:15:02.567Z",
      "level": "error",
      "text": "Failed to fetch data",
      "url": "https://example.com/app"
    }
  ],
  "keyFrames": [
    "recordings/1705432100000_frame_0.jpg",
    "recordings/1705432100000_frame_1.jpg",
    "recordings/1705432100000_frame_2.jpg"
  ],
  "page": {
    "url": "https://example.com/app",
    "title": "My Application"
  }
}
```

The key frames allow Claude and other AI assistants to "see" what happened during the recording by viewing the extracted images.

### AI-Friendly Page Inspection

Dev Browser Studio can describe what's on a page in a format that's easy for AI assistants to understand.

```typescript
// Get a structured description of the page
const snapshot = await client.getAISnapshot("page-name");
console.log(snapshot);
```

This returns something like:
```yaml
- banner:
  - link "Home" [ref=e1]
  - link "About" [ref=e2]
- main:
  - heading "Welcome" [level=1]
  - button "Get Started" [ref=e3]
  - textbox [ref=e4]
    - /placeholder: "Enter your email"
```

You can then interact with elements by their reference:
```typescript
const button = await client.selectSnapshotRef("page-name", "e3");
await button.click();
```

### Perception Loop (Autonomous Agent)

The perception loop lets an AI agent autonomously interact with web pages. It captures screenshots and ARIA snapshots, sends them to Claude Vision, receives structured actions, and executes them in a loop until the task is complete.

#### Basic Usage

```typescript
import { connect } from "./src/client.js";
import { PerceptionLoop } from "./src/perception-loop.js";

const client = await connect();
const page = await client.page("agent");
await page.goto("https://books.toscrape.com");

const loop = new PerceptionLoop({
  maxCycles: 10,
  budget: { maxEstimatedCostUSD: 0.50 },
});

const result = await loop.run(
  client,
  "agent",
  "Find the cheapest book on this page. Return the title and price in extracted_data.",
);

console.log(result.success);        // true
console.log(result.extractedData);  // { title: "...", price: "£13.99" }
console.log(result.budgetUsed);     // { cycles: 3, estimatedTokens: 39359, ... }
```

#### How It Works

Each cycle:
1. **Capture** — Takes a JPEG screenshot + ARIA accessibility snapshot
2. **Perceive** — Sends both to Claude Vision with the task and action history
3. **Act** — Claude returns a structured tool_use action (click, type, scroll, navigate, etc.)
4. **Execute** — The action runs on the page via Playwright
5. **Repeat** — Until the agent calls `done` or `fail`, or a budget limit is hit

The agent has 10 actions available: `click`, `type`, `scroll`, `navigate`, `keyboard`, `wait`, `hover`, `select`, `done`, and `fail`.

#### Configuration

```typescript
const loop = new PerceptionLoop({
  model: "claude-sonnet-4-5-20250929",  // Claude model (default: Sonnet)
  maxCycles: 50,                         // Max perception-action cycles
  maxConsecutiveErrors: 5,               // Stop after N errors in a row
  maxSnapshotChars: 40000,               // Truncate large ARIA snapshots
  settleTimeMs: 300,                     // Wait after each action for page to settle
  budget: {
    maxCycles: 100,                      // Hard cycle limit
    maxTokens: 500000,                   // Total input+output tokens
    maxCostUSD: 5.00,                    // Estimated cost cap
    maxDurationMs: 600000,               // 10 minute timeout
  },
  safety: {
    readOnlyMode: false,                 // Block clicks/typing (allow only scroll/navigate)
    blockedURLPatterns: [".*admin.*"],    // Regex patterns to block navigation
  },
});
```

#### Audit Logging

Every run produces an audit trail in `recordings/perception-<timestamp>/`:

```
perception-1705432100000/
├── cycles.jsonl    # One JSON line per cycle (action, result, tokens, timing)
├── summary.json    # Final result + budget usage
└── frames/
    ├── cycle-0.jpg # Screenshot at each cycle
    ├── cycle-1.jpg
    └── ...
```

#### Result Object

```typescript
interface LoopResult {
  success: boolean;                    // Did the agent complete the task?
  summary: string;                     // Agent's summary of what happened
  cycles: number;                      // Total cycles used
  extractedData?: Record<string, unknown>;  // Data the agent extracted
  budgetUsed: {
    cycles: number;
    estimatedTokens: number;
    estimatedCostUSD: number;
    durationMs: number;
  };
}
```

---

## API Reference

### Client Methods

| Method | Description |
|--------|-------------|
| `connect(url?)` | Connect to the server (default: `http://localhost:9222`) |
| `client.page(name, options?)` | Get or create a page by name |
| `client.list()` | List all page names |
| `client.close(name)` | Close a page |
| `client.disconnect()` | Disconnect from server (pages stay open) |
| `client.startRecording(name, options?)` | Start video recording |
| `client.stopRecording(name)` | Stop recording and get video + console logs + key frames |
| `client.getRecordingStatus(name)` | Check if recording is active |
| `client.getConsoleLogs(name)` | Get captured console logs |
| `client.clearConsoleLogs(name)` | Clear captured console logs |
| `client.getAISnapshot(name)` | Get AI-friendly page description |
| `client.selectSnapshotRef(name, ref)` | Get element by reference ID |

### Recording Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxWidth` | number | 1280 | Maximum video width in pixels |
| `maxHeight` | number | 720 | Maximum video height in pixels |
| `quality` | number | 80 | JPEG quality (0-100, higher = better quality, larger files) |
| `everyNthFrame` | number | 1 | Capture every Nth frame (1 = all frames) |
| `captureConsoleLogs` | boolean | true | Capture console.log/warn/error during recording |
| `extractKeyFrames` | boolean | true | Extract key frames as separate images for AI viewing |
| `keyFrameCount` | number | 5 | Number of key frames to extract |

### Perception Loop Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | string | `claude-sonnet-4-5-20250929` | Claude model for vision |
| `maxCycles` | number | 50 | Max perception-action cycles |
| `maxConsecutiveErrors` | number | 5 | Stop after N consecutive errors |
| `maxSnapshotChars` | number | 40000 | Truncate ARIA snapshots beyond this |
| `settleTimeMs` | number | 300 | Wait time after actions (ms) |
| `apiTimeoutMs` | number | 30000 | Claude API call timeout (ms) |
| `budget.maxCycles` | number | 100 | Hard cycle budget limit |
| `budget.maxTokens` | number | 500000 | Max total tokens |
| `budget.maxCostUSD` | number | 5.00 | Max estimated cost |
| `budget.maxDurationMs` | number | 600000 | Max duration (ms) |
| `safety.readOnlyMode` | boolean | false | Block mutating actions |
| `safety.blockedURLPatterns` | string[] | [] | Regex patterns to block |

### Page Options

| Option | Type | Description |
|--------|------|-------------|
| `viewport.width` | number | Browser window width |
| `viewport.height` | number | Browser window height |

---

## Common Use Cases

### Testing a Login Flow

```typescript
const client = await connect();
const page = await client.page("login-test");

// Start recording to capture the entire flow
await client.startRecording("login-test");

// Navigate to login page
await page.goto("https://myapp.com/login");
await waitForPageLoad(page);

// Fill in credentials
await page.fill("input[name='email']", "test@example.com");
await page.fill("input[name='password']", "testpassword");

// Click login button
await page.click("button[type='submit']");
await waitForPageLoad(page);

// Verify we're logged in
const welcomeText = await page.textContent("h1");
console.log(`Page says: ${welcomeText}`);

// Stop recording
const { videoPath } = await client.stopRecording("login-test");
console.log(`Login flow recorded to: ${videoPath}`);

await client.disconnect();
```

### Debugging a Bug

```typescript
const client = await connect();
const page = await client.page("debug");

// Go to the page with the bug
await page.goto("https://myapp.com/buggy-page");

// Start recording before the problematic action
await client.startRecording("debug");

// Perform the action that causes the bug
await page.click("#problematic-button");

// Wait a moment to capture the result
await new Promise(resolve => setTimeout(resolve, 2000));

// Stop recording
const { videoPath } = await client.stopRecording("debug");
console.log(`Bug reproduction recorded to: ${videoPath}`);

// Also take a screenshot of the final state
await page.screenshot({ path: "bug-state.png" });

await client.disconnect();
```

### Visual Regression Testing

```typescript
const client = await connect();
const page = await client.page("visual-test");

const pagesToTest = [
  "https://myapp.com/",
  "https://myapp.com/about",
  "https://myapp.com/contact",
];

await client.startRecording("visual-test");

for (const url of pagesToTest) {
  await page.goto(url);
  await waitForPageLoad(page);

  // Take a screenshot of each page
  const filename = url.replace(/[^a-z0-9]/gi, "_") + ".png";
  await page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
}

const { videoPath } = await client.stopRecording("visual-test");
console.log(`Visual test recorded to: ${videoPath}`);

await client.disconnect();
```

---

## Troubleshooting

### "Cannot connect to server"

**Problem**: The script can't connect to `http://localhost:9222`

**Solution**: Make sure the server is running:
```bash
npm run start-server
```

### "ffmpeg not found"

**Problem**: Videos aren't being created, only image frames

**Solution**: Install ffmpeg:
- Mac: `brew install ffmpeg`
- Windows: Download from [ffmpeg.org](https://ffmpeg.org)
- Linux: `sudo apt install ffmpeg`

### "Page not found"

**Problem**: `client.page("name")` throws an error

**Solution**: Make sure the server is running and the page name is correct. Page names are case-sensitive.

### Browser window doesn't appear

**Problem**: You can't see the browser

**Solution**: Make sure you didn't start with `--headless`. Run:
```bash
npm run start-server
```

Without any flags, the browser window should be visible.

### Recording has no frames

**Problem**: `stopRecording` returns `frameCount: 0`

**Solution**: Make sure something is happening on the page during recording. Try adding delays or actions between start and stop:
```typescript
await client.startRecording("test");
await page.goto("https://example.com");
await new Promise(r => setTimeout(r, 1000)); // Wait 1 second
const result = await client.stopRecording("test");
```

---

## Frequently Asked Questions

### What browsers does this support?

Dev Browser Studio uses Chromium (the open-source version of Chrome). It's bundled with Playwright, so you don't need to install it separately.

### Can I use my existing Chrome profile?

Yes! Use "Extension Mode" by installing the Chrome extension. This lets you automate your existing Chrome browser with all your logged-in sessions, bookmarks, and extensions.

### How long can recordings be?

There's no hard limit, but longer recordings create larger files. A typical 1-minute recording at 720p is around 5-10MB.

### What video format is used?

Videos are saved as WebM files using the VP9 codec. This format is widely supported and provides good compression.

### Can I record mobile layouts?

Yes! Set a mobile viewport when creating the page:
```typescript
const page = await client.page("mobile-test", {
  viewport: { width: 375, height: 812 }  // iPhone X size
});
```

### Does this work on CI/CD pipelines?

Yes! Use headless mode:
```bash
npm run start-server -- --headless
```

---

## Project Structure

```
dev-browser-studio/
├── README.md              # This file
├── SKILL.md               # Skill instructions for AI assistants
├── package.json           # Project dependencies
├── tsconfig.json          # TypeScript configuration
├── server.sh              # Server startup script
├── src/
│   ├── index.ts           # Server code
│   ├── client.ts          # Client API
│   ├── perception-loop.ts # Autonomous agent loop
│   ├── vlm-client.ts      # Claude Vision API wrapper
│   ├── tools.ts           # Agent action vocabulary + executor
│   ├── frame-sampler.ts   # Perceptual hash change detection
│   ├── budget.ts          # Cycle/token/cost/duration limits
│   ├── audit-logger.ts    # JSONL audit trail + frame saving
│   ├── video-encoder.ts   # Video encoding
│   ├── types.ts           # TypeScript types
│   └── snapshot/          # Page inspection code
├── scripts/
│   └── start-server.ts    # Server entry point
└── recordings/            # Videos + perception loop audit logs
```

---

## Contributing

Contributions are welcome! If you find a bug or have a feature request:

1. Open an issue on GitHub
2. Fork the repository
3. Create a branch for your changes
4. Submit a pull request

---

## License

MIT License - feel free to use this in your own projects!

---

## Credits

Dev Browser Studio is built on top of:
- [Playwright](https://playwright.dev) - Browser automation library
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) - For video recording
- Original concept from [dev-browser](https://github.com/SawyerHood/dev-browser) by Sawyer Hood

---

## Version History

### v1.2.0
- Autonomous perception-action loop using Claude Vision API
- 10 agent actions: click, type, scroll, navigate, keyboard, wait, hover, select, done, fail
- Budget controls: cycle, token, cost, and duration limits
- ARIA snapshot truncation for large pages (configurable maxSnapshotChars)
- Navigation recovery: page handle re-acquired after link clicks
- Perceptual hash frame sampling (skip unchanged frames)
- JSONL audit logging with per-cycle screenshots
- Safety guardrails: read-only mode, URL pattern blocking, stuck detection
- New dependencies: @anthropic-ai/sdk, sharp

### v1.1.0
- Console log capture via CDP Runtime API
- Key frame extraction as JPEG images for AI viewing
- Recording summary JSON with metadata and logs
- Enhanced stopRecording response with consoleLogs, keyFramePaths, summaryPath
- New client methods: getConsoleLogs(), clearConsoleLogs()
- Updated documentation with AI-parseable output examples

### v1.0.0 (Initial Release)
- On-demand video recording with CDP Screencast
- Persistent page management
- AI-friendly page snapshots
- WebM video encoding with ffmpeg
- Comprehensive documentation for beginners
