import React from "react";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const STR = {
  en: { title: "Assessment Sessions", new: "New Session", empty: "No sessions yet. Start a new one to begin assessing a framework." },
  pt: { title: "Sessões de Avaliação", new: "Nova Sessão", empty: "Ainda não há sessões. Inicie uma nova para avaliar um framework." },
};

export default function ConversationSidebar({ language, conversations, activeId, onSelect, onNew, onDelete, creating }) {
  const s = STR[language] || STR.en;
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">{s.title}</h3>
        <Button size="sm" onClick={onNew} disabled={creating}>
          <Plus className="h-4 w-4" /> {s.new}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-4">{s.empty}</p>
        ) : conversations.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer text-sm transition-colors ${c.id === activeId ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span className="truncate flex-1">{c.metadata?.name || "Untitled session"}</span>
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}