# MMCARTBOX

MMCARTBOX is a lightweight, privacy-friendly ChartGPT-like interface that runs in the browser. This branch adds multi-dataset and multi-series support, and provides an optional Node.js server that can safely proxy requests to an LLM (OpenAI) or use a local fallback parser when no API key is present.

What's new in this update:
- Multiple CSV uploads (each becomes a named dataset).
- Multi-series chart rendering (select multiple Y columns).
- "Ask server for suggestion" button — a POST to /api/suggest which uses an OpenAI call when OPENAI_API_KEY is set, otherwise falls back to a local parser.
- Node.js server code (server.js), package.json and .env.example for running the suggestion service locally.
- Improved client-side prompt handling with server-first, local fallback logic.

Files added/updated:
- index.html — UI updated for multiple datasets and multi-series control.
- styles.css — small layout tweaks.
- app.js — client logic for multi-dataset, multi-series, and server integration.
- server.js — Express server that proxies suggestions to an LLM or uses a safe fallback.
- package.json — server dependencies and scripts.
- .env.example — environment variable example.
- README.md — updated usage + server instructions.

How to use (frontend-only):
1. Open `index.html` in a modern browser.
2. Upload one or more CSV files (or Load Sample Data).
3. Select a dataset from the "Dataset" dropdown.
4. Choose chart type, X column and one or more Y columns (hold Ctrl/Cmd for multi-select).
5. Click "Render Chart" to view the chart.
6. Click "Download PNG" to save the chart.

How to run the optional server (enables better prompt parsing via an LLM):
1. Install Node.js (>= 16 recommended).
2. cd to the repository root (where `server.js` and `package.json` are).
3. Run:
   - npm install
   - Copy `.env.example` to `.env` and set OPENAI_API_KEY if you want model-based suggestions.
   - npm start
4. With the server running, open the frontend (served via any static server or file:// in the browser) and use "Ask server for suggestion" or submit a prompt — the client will POST to `http://localhost:3000/api/suggest` (if your frontend is served from the server, requests will be same-origin).

Security notes:
- Do not commit your `.env` with secret keys.
- The server includes a local fallback parser so it will function even when no API key is provided.
- Server-side usage of an LLM keeps the API key off the user's browser and avoids leaking it to clients.

Next improvements you can ask for:
- Multi-series aggregation (group-by) and stacked charts.
- Time parsing and auto-detection for date axis.
- Save / export chart specifications (Vega-Lite or Chart.js JSON).
- Example Dockerfile to containerize the server.

License: MIT
