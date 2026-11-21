# Brief to Prototype

An AI-assisted product planning workspace. Start with a brief, review an interactive user flow, then preview a clickable prototype. Every screen links to requirements, and proposed changes are compared against the applied flow before they take effect.

## Run locally

Use Node.js 24.

```bash
npm ci
npm run dev
```

Open http://localhost:3000. The sample salon project works without a key. Select **Apply changes** to add rescheduling, then open **Preview prototype**. Choose a service and time, confirm, and reschedule. Use **Reset sample** to restore the original demo.

To draft your own flow or revise it with live AI, copy `.env.example` to `.env.local`, set `OPENAI_API_KEY`, and restart the dev server. Briefs and answers used for live generation are sent to OpenAI. The key stays server-side. The active project and its draft are saved in your browser.

## Build and host

```bash
npm run build
npm run preview
```

Import the source into Vercel as a Vite project to deploy the client and the Node.js function at `/api/assist`. Set `OPENAI_API_KEY` if you want that deployment to offer live generation. A public demo can leave the key unset to run the sample only. Before enabling paid API access for public visitors, configure authentication or request limits for the endpoint.

## How it works

The Node.js endpoint requests structured JSON for clarification, generation, and revision. Zod validates the data, including screen links, requirement IDs, and reachability from the first screen. React renders the result with fixed components for choices, actions, and summaries. Draft impact is computed by comparing screen and requirement IDs, and the preview reads the applied revision. Animations honor reduced-motion preferences.
