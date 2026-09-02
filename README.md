# Traceglass

A private, local-first reader for agent trajectory JSON files.

## Use it

```powershell
npm run dev
```

Open `http://localhost:3000`, then drop a `trajectory.json` file onto the upload area. The file is parsed entirely in the browser and is not sent anywhere.

## What it shows

- A plain-language run overview
- Message and reasoning timeline
- Tool calls with input, output, errors, and timing
- Search and role/tool/error filters
- Token, duration, and tool-health summaries
- A formatted raw JSON view
