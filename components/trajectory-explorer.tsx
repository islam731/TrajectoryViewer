'use client';

import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  BrainCircuit,
  Braces,
  Check,
  CheckCircle2,
  Clock3,
  Code2,
  Copy,
  FileJson2,
  FileText,
  Gauge,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  Search,
  SquareTerminal,
  UserRound,
  Wrench,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  asRecord,
  asString,
  formatCompact,
  formatDuration,
  formatTime,
  JsonObject,
  messageCreated,
  messageInfo,
  messageParts,
  messageRole,
  messageText,
  partText,
  partType,
  readPath,
  safeJson,
  searchableMessage,
  summarizeTrajectory,
  toolDescription,
  toolName,
  toolStatus,
  TrajectoryData,
  TrajectoryMessage,
} from '@/lib/trajectory';

type Filter = 'all' | 'user' | 'assistant' | 'tools' | 'errors';
type View = 'timeline' | 'raw';

const filterLabels: Array<[Filter, string]> = [
  ['all', 'All'],
  ['user', 'User'],
  ['assistant', 'Assistant'],
  ['tools', 'Tools'],
  ['errors', 'Errors'],
];

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }
  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => void copy()} aria-label={label}>
      {copied ? <Check className="text-emerald-600" /> : <Copy />}
      <span className="hidden sm:inline">{copied ? 'Copied' : label}</span>
    </Button>
  );
}

function ExpandableText({ text, tone = 'plain' }: { text: string; tone?: 'plain' | 'reasoning' }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 900;
  return (
    <div>
      <div className={`relative ${!expanded && isLong ? 'max-h-52 overflow-hidden' : ''}`}>
        <pre className={`whitespace-pre-wrap break-words font-sans text-[13px] leading-6 ${tone === 'reasoning' ? 'text-slate-600 dark:text-slate-300' : 'text-foreground'}`}>{text}</pre>
        {!expanded && isLong && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(to_bottom,transparent,var(--card))]" />}
      </div>
      {isLong && (
        <Button type="button" variant="ghost" size="sm" className="mt-2 -ml-2 text-primary" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Show less' : `Show all · ${formatCompact(text.length)} chars`}
        </Button>
      )}
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === undefined || value === null || value === '') return null;
  const text = safeJson(value);
  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-slate-700/20 bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</span>
        <CopyButton value={text} label={`Copy ${title.toLowerCase()}`} />
      </header>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-5 text-slate-200">{text}</pre>
    </section>
  );
}

function ToolPart({ part, index }: { part: JsonObject; index: number }) {
  const state = asRecord(part.state);
  const status = toolStatus(part);
  const isError = status === 'error' || status === 'failed';
  const isDone = status === 'completed' || status === 'success';
  const duration = readPath(state, ['time', 'end']) && readPath(state, ['time', 'start'])
    ? Number(readPath(state, ['time', 'end'])) - Number(readPath(state, ['time', 'start']))
    : null;
  return (
    <details className={`group overflow-hidden rounded-xl border ${isError ? 'border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/20' : 'border-border bg-background/65'}`}>
      <summary className="flex cursor-pointer list-none items-start gap-3 px-3 py-3 marker:content-none">
        <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${isError ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-slate-900 text-white dark:bg-slate-700'}`}>
          {isError ? <XCircle className="size-3.5" /> : <SquareTerminal className="size-3.5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold">{toolName(part)}</span>
            <Badge variant={isError ? 'destructive' : isDone ? 'secondary' : 'outline'} className="capitalize">{status}</Badge>
            {duration !== null && Number.isFinite(duration) && <span className="text-[11px] text-muted-foreground">{formatDuration(duration)}</span>}
          </span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">{toolDescription(part)}</span>
        </span>
        <span className="mt-1 font-mono text-[10px] text-muted-foreground">#{index + 1}</span>
      </summary>
      <div className="border-t border-border px-3 pb-3 pt-1">
        <JsonBlock title="Input" value={state.input} />
        <JsonBlock title="Output" value={state.output} />
        <JsonBlock title="Error" value={state.error} />
        {state.metadata !== undefined && <JsonBlock title="Metadata" value={state.metadata} />}
      </div>
    </details>
  );
}

function MessageCard({ message, index }: { message: TrajectoryMessage; index: number }) {
  const role = messageRole(message);
  const parts = messageParts(message);
  const text = messageText(message);
  const info = messageInfo(message);
  const tokens = asRecord(info.tokens);
  const isUser = role === 'user';
  const toolParts = parts.filter((part) => partType(part) === 'tool');
  const reasoningParts = parts.filter((part) => partType(part) === 'reasoning');
  const stepFinish = parts.find((part) => partType(part) === 'step-finish');

  return (
    <article id={`message-${index}`} className="scroll-mt-28 rounded-2xl border border-border bg-card shadow-[0_10px_35px_-28px_rgba(15,23,42,.42)]">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <span className={`grid size-8 place-items-center rounded-xl ${isUser ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`}>
          {isUser ? <UserRound className="size-4" /> : <Bot className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold capitalize">{role}</h3>
            <span className="font-mono text-[10px] text-muted-foreground">Turn {index + 1}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {formatTime(messageCreated(message)) && <span>{formatTime(messageCreated(message))}</span>}
            {toolParts.length > 0 && <span>{toolParts.length} tool {toolParts.length === 1 ? 'call' : 'calls'}</span>}
            {reasoningParts.length > 0 && <span>{reasoningParts.length} reasoning {reasoningParts.length === 1 ? 'block' : 'blocks'}</span>}
          </div>
        </div>
        {(Number(tokens.output) > 0 || Number(tokens.reasoning) > 0) && (
          <span title="Output + reasoning tokens" className="rounded-full bg-muted px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
            {formatCompact(Number(tokens.output ?? 0) + Number(tokens.reasoning ?? 0))} generated
          </span>
        )}
      </header>

      <div className="space-y-3 p-4 sm:p-5">
        {text && <ExpandableText text={text} />}

        {reasoningParts.map((part, partIndex) => (
          <details key={`reasoning-${partIndex}`} className="group rounded-xl border border-indigo-200/60 bg-indigo-50/50 dark:border-indigo-900 dark:bg-indigo-950/20">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 marker:content-none">
              <BrainCircuit className="size-4 text-indigo-600 dark:text-indigo-300" />
              <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-100">Reasoning</span>
              <span className="ml-auto font-mono text-[10px] text-indigo-500">{formatCompact(partText(part).length)} chars</span>
            </summary>
            <div className="border-t border-indigo-200/60 px-3 py-3 dark:border-indigo-900"><ExpandableText text={partText(part)} tone="reasoning" /></div>
          </details>
        ))}

        {toolParts.length > 0 && <div className="space-y-2">{toolParts.map((part, partIndex) => <ToolPart key={asString(part.id, String(partIndex))} part={part} index={partIndex} />)}</div>}

        {stepFinish && (
          <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-3 text-[11px] text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-emerald-600" />
            Step finished
            {asString(stepFinish.reason) && <Badge variant="outline" className="capitalize">{asString(stepFinish.reason)}</Badge>}
            {Number(stepFinish.cost) > 0 && <span>· cost {String(stepFinish.cost)}</span>}
          </div>
        )}
      </div>
    </article>
  );
}

function SummaryCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-[11px] font-medium uppercase tracking-[0.09em]">{label}</span></div>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
      {detail && <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

function RunSidebar({ data, fileName, filteredIndexes }: { data: TrajectoryData; fileName: string; filteredIndexes: number[] }) {
  const title = asString(data.info.title) || fileName;
  const model = asString(readPath(data, ['info', 'model', 'id'])) || asString(data.info.model);
  return (
    <aside className="sticky top-[73px] hidden h-[calc(100vh-89px)] overflow-hidden rounded-2xl bg-sidebar text-sidebar-foreground xl:flex xl:flex-col">
      <div className="border-b border-sidebar-border p-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">Current run</p>
        <h2 className="mt-2 break-words text-sm font-semibold leading-5">{title}</h2>
        {model && <Badge className="mt-3 bg-sidebar-accent text-sidebar-accent-foreground">{model}</Badge>}
      </div>
      <nav aria-label="Trajectory turns" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40">Run map · {filteredIndexes.length}</p>
        <div className="space-y-0.5">
          {filteredIndexes.map((index) => {
            const message = data.messages[index];
            const role = messageRole(message);
            const tools = messageParts(message).filter((part) => partType(part) === 'tool').length;
            return (
              <button key={index} type="button" onClick={() => document.getElementById(`message-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-xs text-sidebar-foreground/65 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <span className={`grid size-6 shrink-0 place-items-center rounded-lg ${role === 'user' ? 'bg-amber-400/15 text-amber-200' : 'bg-emerald-400/15 text-emerald-200'}`}>{role === 'user' ? <UserRound className="size-3" /> : <Bot className="size-3" />}</span>
                <span className="min-w-0 flex-1 truncate capitalize">{role} · {index + 1}</span>
                {tools > 0 && <span className="font-mono text-[10px] text-sidebar-foreground/35">{tools}t</span>}
              </button>
            );
          })}
        </div>
      </nav>
      <div className="border-t border-sidebar-border p-4 text-[11px] leading-5 text-sidebar-foreground/45">
        <LockKeyhole className="mr-1 inline size-3" /> Parsed locally. Nothing is uploaded.
      </div>
    </aside>
  );
}

function InsightsSidebar({ data, fileName, fileSize }: { data: TrajectoryData; fileName: string; fileSize: number }) {
  const summary = summarizeTrajectory(data);
  const tokenRows: Array<[string, number, string]> = [
    ['Input', summary.tokens.input, 'bg-emerald-500'],
    ['Output', summary.tokens.output, 'bg-amber-500'],
    ['Reasoning', summary.tokens.reasoning, 'bg-indigo-500'],
    ['Cache read', summary.tokens.cacheRead, 'bg-slate-400'],
  ];
  const maxToken = Math.max(...tokenRows.map((row) => row[1]), 1);
  const toolRate = summary.tools ? Math.round((summary.toolsCompleted / summary.tools) * 100) : 0;

  return (
    <aside className="sticky top-[73px] hidden h-[calc(100vh-89px)] space-y-3 overflow-y-auto lg:block">
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tool health</h2>
          <span className="font-mono text-xs font-semibold">{toolRate}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${toolRate}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-emerald-700 dark:text-emerald-300">{summary.toolsCompleted} completed</span>
          <span className={summary.toolsFailed ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground'}>{summary.toolsFailed} failed</span>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Token profile</h2>
        <div className="mt-4 space-y-3">
          {tokenRows.map(([label, value, color]) => (
            <div key={label}>
              <div className="mb-1.5 flex justify-between text-[11px]"><span className="text-muted-foreground">{label}</span><span className="font-mono">{formatCompact(value)}</span></div>
              <div className="h-1.5 rounded-full bg-muted"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(value ? 3 : 0, (value / maxToken) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tool mix</h2>
        <div className="mt-3 space-y-2">
          {summary.toolCounts.length ? summary.toolCounts.map(([name, count]) => (
            <div key={name} className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-2 text-xs"><Wrench className="size-3 text-muted-foreground" /><span className="min-w-0 flex-1 truncate font-mono">{name}</span><span className="font-mono text-muted-foreground">{count}</span></div>
          )) : <p className="text-xs text-muted-foreground">No tool calls found.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Local file</h2>
        <div className="mt-3 flex items-start gap-2"><FileJson2 className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="truncate text-xs font-medium" title={fileName}>{fileName}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{formatCompact(fileSize)} bytes</p></div></div>
      </section>
    </aside>
  );
}

export function TrajectoryExplorer({ data, fileName, fileSize, onReplace }: { data: TrajectoryData; fileName: string; fileSize: number; onReplace: () => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('timeline');
  const summary = useMemo(() => summarizeTrajectory(data), [data]);
  const filteredIndexes = useMemo(() => data.messages.map((_, index) => index).filter((index) => {
    const message = data.messages[index];
    const parts = messageParts(message);
    const role = messageRole(message);
    const matchesFilter = filter === 'all' || filter === role || (filter === 'tools' && parts.some((part) => partType(part) === 'tool')) || (filter === 'errors' && parts.some((part) => partType(part) === 'tool' && ['error', 'failed'].includes(toolStatus(part))));
    return matchesFilter && (!query.trim() || searchableMessage(message).includes(query.trim().toLowerCase()));
  }), [data, filter, query]);
  const raw = useMemo(() => view === 'raw' ? safeJson(data) : '', [data, view]);
  const title = asString(data.info.title) || asString(data.info.slug) || fileName;
  const path = asString(data.info.path) || asString(data.info.directory);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex h-[57px] max-w-[1600px] items-center gap-3 px-4 lg:px-6">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><FileJson2 className="size-4" /></span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">Traceglass</p><p className="truncate text-[10px] text-muted-foreground">{title}</p></div>
          <div className="flex rounded-lg border border-border bg-card p-0.5">
            <Button type="button" size="sm" variant={view === 'timeline' ? 'secondary' : 'ghost'} onClick={() => setView('timeline')}><MessageSquareText /> <span className="hidden sm:inline">Timeline</span></Button>
            <Button type="button" size="sm" variant={view === 'raw' ? 'secondary' : 'ghost'} onClick={() => setView('raw')}><Braces /> <span className="hidden sm:inline">Raw JSON</span></Button>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onReplace}><RefreshCw /><span className="hidden sm:inline">Open another</span></Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:px-6 xl:grid-cols-[238px_minmax(0,1fr)_260px]">
        <RunSidebar data={data} fileName={fileName} filteredIndexes={filteredIndexes} />

        <section className="min-w-0">
          {view === 'timeline' ? (
            <>
              <section className="mb-4 overflow-hidden rounded-2xl border border-border bg-card">
                <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Run overview</Badge>
                      {summary.finish !== 'unknown' && <Badge variant="outline" className="capitalize">finish: {summary.finish}</Badge>}
                    </div>
                    <h1 className="mt-3 text-xl font-semibold tracking-[-0.025em]">{title}</h1>
                    {path && <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground" title={path}>{path}</p>}
                    <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
                      This run contains <strong className="font-semibold text-foreground">{summary.assistants} assistant turns</strong> responding to {summary.users} user {summary.users === 1 ? 'turn' : 'turns'}. The agent made <strong className="font-semibold text-foreground">{summary.tools} tool calls</strong>; {summary.toolsCompleted} completed and {summary.toolsFailed} failed. The timeline below keeps the exact order and original content.
                    </p>
                    {summary.toolsFailed > 0 && <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{summary.toolsFailed} failed tool {summary.toolsFailed === 1 ? 'call appears' : 'calls appear'} in the run. Use the Errors filter to find {summary.toolsFailed === 1 ? 'it' : 'them'}.</div>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 lg:w-[330px]">
                    <SummaryCard icon={<MessageSquareText className="size-3.5" />} label="Turns" value={String(summary.messages)} detail={`${summary.textParts} text blocks`} />
                    <SummaryCard icon={<Clock3 className="size-3.5" />} label="Elapsed" value={formatDuration(summary.durationMs)} detail="created → updated" />
                    <SummaryCard icon={<Gauge className="size-3.5" />} label="Tools" value={String(summary.tools)} detail={`${summary.toolsCompleted} complete`} />
                  </div>
                </div>
              </section>

              <div className="sticky top-[57px] z-20 mb-4 rounded-2xl border border-border bg-background/94 p-2.5 shadow-sm backdrop-blur-xl">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search trajectory" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search text, tools, commands, paths…" className="h-9 bg-card pl-9" /></div>
                  <div className="flex gap-1 overflow-x-auto" aria-label="Filter messages">{filterLabels.map(([value, label]) => <Button key={value} type="button" size="sm" variant={filter === value ? 'secondary' : 'ghost'} onClick={() => setFilter(value)} className="shrink-0">{label}{value === 'errors' && summary.toolsFailed > 0 && <span className="ml-1 rounded-full bg-red-100 px-1.5 font-mono text-[10px] text-red-700 dark:bg-red-950 dark:text-red-300">{summary.toolsFailed}</span>}</Button>)}</div>
                </div>
              </div>

              <div className="space-y-3">
                {filteredIndexes.map((index) => <MessageCard key={asString(data.messages[index].id, String(index))} message={data.messages[index]} index={index} />)}
                {filteredIndexes.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-16 text-center"><Search className="mx-auto size-6 text-muted-foreground" /><h2 className="mt-3 text-sm font-semibold">No matching turns</h2><p className="mt-1 text-xs text-muted-foreground">Try a different search or filter.</p></div>}
              </div>
            </>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-slate-700/30 bg-slate-950 text-slate-100">
              <header className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><p className="text-sm font-semibold">Raw trajectory</p><p className="mt-0.5 text-[11px] text-slate-400">The original structure, formatted for reading</p></div><CopyButton value={raw} label="Copy JSON" /></header>
              <pre className="max-h-[calc(100vh-140px)] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[11px] leading-5 text-slate-200">{raw}</pre>
            </section>
          )}
        </section>

        <InsightsSidebar data={data} fileName={fileName} fileSize={fileSize} />
      </div>
    </main>
  );
}

export function UploadTrajectory({ onLoaded }: { onLoaded: (data: TrajectoryData, file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  async function load(file?: File) {
    if (!file) return;
    setError('');
    try {
      const { parseTrajectory } = await import('@/lib/trajectory');
      onLoaded(parseTrajectory(await file.text()), file);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not read this trajectory.');
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/90">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><FileJson2 className="size-4" /></span><div><p className="text-sm font-semibold tracking-tight">Traceglass</p><p className="text-[11px] text-muted-foreground">Trajectory reader</p></div></div>
          <span className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground"><LockKeyhole className="size-3.5 text-emerald-600" />Files stay in your browser</span>
        </div>
      </header>
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1500px] place-items-center px-5 py-12 lg:px-8">
        <div className="w-full max-w-3xl">
          <div className="mb-8 text-center"><p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">Follow the whole run</p><h1 className="text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Turn a dense trajectory into a clear story.</h1><p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-7 text-muted-foreground">Upload one JSON file to inspect every message, reasoning step, tool call, timing, token count, and outcome in order.</p></div>
          <button type="button" aria-label="Choose or drop a trajectory JSON file" onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void load(event.dataTransfer.files[0]); }} className={`group w-full rounded-[28px] border border-dashed bg-card p-4 text-left shadow-[0_24px_80px_-44px_rgba(15,23,42,.4)] transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25 ${dragging ? 'border-primary bg-accent/50' : 'border-primary/35 hover:border-primary/65 hover:bg-accent/40'}`}>
            <div className="grid min-h-72 place-items-center rounded-[20px] border border-border bg-background/70 px-6 text-center"><div><span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15 transition-transform group-hover:-translate-y-1"><FileText className="size-6" /></span><p className="text-lg font-semibold">Drop trajectory.json here</p><p className="mt-2 text-sm text-muted-foreground">or click to choose a file from your computer</p><span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-mono text-[11px] text-muted-foreground"><Code2 className="size-3" />JSON · processed locally</span></div></div>
          </button>
          <input ref={inputRef} aria-label="Trajectory JSON file" type="file" accept="application/json,.json" className="sr-only" onChange={(event) => void load(event.target.files?.[0])} />
          {error && <div role="alert" className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-destructive"><AlertTriangle className="size-4" />{error}</div>}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5 text-emerald-600" />Works with trajectory objects and message arrays<ArrowRight className="size-3.5" />No account needed</div>
        </div>
      </section>
    </main>
  );
}
