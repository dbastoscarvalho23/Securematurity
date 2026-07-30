import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Check, ChevronDown, Loader2, X, AlertCircle } from "lucide-react";

const statusMeta = {
  pending: { icon: Loader2, spin: true, label: "Pending" },
  running: { icon: Loader2, spin: true, label: "Running" },
  in_progress: { icon: Loader2, spin: true, label: "In progress" },
  completed: { icon: Check, spin: false, label: "Completed" },
  success: { icon: Check, spin: false, label: "Done" },
  failed: { icon: X, spin: false, label: "Failed" },
  error: { icon: AlertCircle, spin: false, label: "Error" },
};

function ToolCall({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const status = toolCall.status || "pending";
  const meta = statusMeta[status] || statusMeta.pending;
  const Icon = meta.icon;
  let parsedResults = toolCall.results;
  try {
    if (typeof parsedResults === "string") parsedResults = JSON.parse(parsedResults);
  } catch { /* keep raw */ }
  const failed = /failed|error/i.test(status) || (parsedResults && parsedResults.success === false);
  const proj = toolCall.display_projection || {};
  const hide = proj.hide_details && proj.details_redacted;

  return (
    <div className="mt-2 text-xs rounded-lg border border-border bg-muted/40 px-3 py-2">
      <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 w-full text-left">
        <Icon className={`h-3.5 w-3.5 ${meta.spin ? "animate-spin" : ""} ${failed ? "text-destructive" : "text-muted-foreground"}`} />
        <span className="font-medium text-foreground">{toolCall.name}</span>
        {!hide && <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${expanded ? "rotate-180" : ""}`} />}
        <span className={failed ? "text-destructive" : "text-muted-foreground"}>{proj.active_label && meta.spin ? proj.active_label : (failed ? (proj.error_label || meta.label) : (proj.label || meta.label))}</span>
      </button>
      {!hide && expanded && (
        <div className="mt-2 space-y-1.5">
          {toolCall.arguments_string && (
            <div>
              <div className="text-muted-foreground">Parameters:</div>
              <pre className="whitespace-pre-wrap break-words bg-background rounded p-2">{(() => { try { return JSON.stringify(JSON.parse(toolCall.arguments_string), null, 2); } catch { return toolCall.arguments_string; } })()}</pre>
            </div>
          )}
          {parsedResults !== undefined && parsedResults !== null && (
            <div>
              <div className="text-muted-foreground">Result:</div>
              <pre className="whitespace-pre-wrap break-words bg-background rounded p-2">{typeof parsedResults === "string" ? parsedResults : JSON.stringify(parsedResults, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${isUser ? "bg-primary text-primary-foreground" : "bg-card border border-border text-card-foreground shadow-sm"}`}>
        {message.content && (isUser
          ? <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          : <ReactMarkdown className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-headings:my-2">{message.content}</ReactMarkdown>)}
        {message.tool_calls?.map((tc, i) => <ToolCall key={i} toolCall={tc} />)}
      </div>
    </div>
  );
}