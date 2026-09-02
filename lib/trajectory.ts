export type JsonObject = Record<string, unknown>;

export type TrajectoryMessage = JsonObject & {
  info?: JsonObject;
  parts?: unknown[];
};

export type TrajectoryData = JsonObject & {
  info: JsonObject;
  messages: TrajectoryMessage[];
};

export type RunSummary = {
  messages: number;
  users: number;
  assistants: number;
  tools: number;
  toolsCompleted: number;
  toolsFailed: number;
  reasoningParts: number;
  textParts: number;
  durationMs: number | null;
  finish: string;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cacheRead: number;
    cacheWrite: number;
  };
  toolCounts: Array<[string, number]>;
};

export function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function asRecord(value: unknown): JsonObject {
  return isRecord(value) ? value : {};
}

export function readPath(value: unknown, path: string[]): unknown {
  let cursor = value;
  for (const key of path) {
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

export function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function parseTrajectory(raw: string): TrajectoryData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('This file is not valid JSON.');
  }

  if (Array.isArray(parsed)) {
    return { info: {}, messages: parsed.filter(isRecord) };
  }
  if (!isRecord(parsed)) {
    throw new Error('The JSON root must be an object or an array of messages.');
  }
  if (!Array.isArray(parsed.messages)) {
    throw new Error('No messages array was found in this trajectory.');
  }

  return {
    ...parsed,
    info: asRecord(parsed.info),
    messages: parsed.messages.filter(isRecord),
  } as TrajectoryData;
}

export function messageInfo(message: TrajectoryMessage): JsonObject {
  return asRecord(message.info);
}

export function messageRole(message: TrajectoryMessage): string {
  return (
    asString(readPath(message, ['info', 'role'])) ||
    asString(message.role) ||
    asString(readPath(message, ['author', 'role'])) ||
    'unknown'
  ).toLowerCase();
}

export function messageParts(message: TrajectoryMessage): JsonObject[] {
  if (Array.isArray(message.parts)) return message.parts.filter(isRecord);
  if (typeof message.content === 'string') return [{ type: 'text', text: message.content }];
  if (Array.isArray(message.content)) return message.content.filter(isRecord);
  return [];
}

export function partType(part: JsonObject): string {
  return asString(part.type, 'unknown').toLowerCase();
}

export function partText(part: JsonObject): string {
  if (typeof part.text === 'string') return part.text;
  if (typeof part.content === 'string') return part.content;
  return '';
}

export function messageText(message: TrajectoryMessage): string {
  return messageParts(message)
    .filter((part) => partType(part) === 'text')
    .map(partText)
    .filter(Boolean)
    .join('\n\n');
}

export function messageCreated(message: TrajectoryMessage): number | string | null {
  const value = readPath(message, ['info', 'time', 'created']) ?? readPath(message, ['time', 'created']);
  return typeof value === 'number' || typeof value === 'string' ? value : null;
}

export function toolStatus(part: JsonObject): string {
  return asString(readPath(part, ['state', 'status']), 'unknown').toLowerCase();
}

export function toolName(part: JsonObject): string {
  return asString(part.tool, 'tool');
}

export function toolDescription(part: JsonObject): string {
  const input = asRecord(readPath(part, ['state', 'input']));
  return (
    asString(input.description) ||
    asString(input.filePath) ||
    asString(input.name) ||
    asString(input.command) ||
    'Tool interaction'
  );
}

export function safeJson(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return String(value);
  }
}

function timeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function summarizeTrajectory(data: TrajectoryData): RunSummary {
  let users = 0;
  let assistants = 0;
  let tools = 0;
  let toolsCompleted = 0;
  let toolsFailed = 0;
  let reasoningParts = 0;
  let textParts = 0;
  const toolMap = new Map<string, number>();

  for (const message of data.messages) {
    const role = messageRole(message);
    if (role === 'user') users += 1;
    if (role === 'assistant') assistants += 1;
    for (const part of messageParts(message)) {
      const type = partType(part);
      if (type === 'text') textParts += 1;
      if (type === 'reasoning') reasoningParts += 1;
      if (type === 'tool') {
        tools += 1;
        const name = toolName(part);
        toolMap.set(name, (toolMap.get(name) ?? 0) + 1);
        const status = toolStatus(part);
        if (status === 'completed' || status === 'success') toolsCompleted += 1;
        if (status === 'error' || status === 'failed') toolsFailed += 1;
      }
    }
  }

  const created = timeNumber(readPath(data, ['info', 'time', 'created']));
  const updated = timeNumber(readPath(data, ['info', 'time', 'updated']));
  const tokenInfo = asRecord(readPath(data, ['info', 'tokens']));
  const cache = asRecord(tokenInfo.cache);
  const finalMessage = [...data.messages].reverse().find((message) => messageRole(message) === 'assistant');

  return {
    messages: data.messages.length,
    users,
    assistants,
    tools,
    toolsCompleted,
    toolsFailed,
    reasoningParts,
    textParts,
    durationMs: created !== null && updated !== null && updated >= created ? updated - created : null,
    finish: finalMessage ? asString(readPath(finalMessage, ['info', 'finish']), 'unknown') : 'unknown',
    tokens: {
      input: asNumber(tokenInfo.input),
      output: asNumber(tokenInfo.output),
      reasoning: asNumber(tokenInfo.reasoning),
      cacheRead: asNumber(cache.read),
      cacheWrite: asNumber(cache.write),
    },
    toolCounts: [...toolMap.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en', { notation: value >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
}

export function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return '—';
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`;
  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds} sec`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function formatTime(value: number | string | null): string {
  if (value === null) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function searchableMessage(message: TrajectoryMessage): string {
  return safeJson(message).toLowerCase();
}
