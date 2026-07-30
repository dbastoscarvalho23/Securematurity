import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/lib/LanguageContext";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import ConversationSidebar from "@/components/agents/ConversationSidebar";
import ChatPanel from "@/components/agents/ChatPanel";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

const AGENT_NAME = "framework_guide";
const HIDDEN_KEY = "framework_guide_hidden_sessions";

const getHidden = () => {
  try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]")); } catch { return new Set(); }
};
const saveHidden = (set) => {
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
};

const STR = {
  en: { title: "Framework Guidance", subtitle: "Walk through a framework's controls with an AI guide and record your maturity answers.", createErr: "Could not start a new session.", loadErr: "Could not load sessions.", deleteErr: "Could not delete the session.", deleteTitle: "Delete session?", deleteDesc: "This will permanently delete the session and its messages.", deleteConfirm: "Delete", deleteCancel: "Cancel" },
  pt: { title: "Orientação de Framework", subtitle: "Percorra os controlos de um framework com um guia de IA e registe as suas respostas de maturidade.", createErr: "Não foi possível iniciar uma nova sessão.", loadErr: "Não foi possível carregar as sessões.", deleteErr: "Não foi possível eliminar a sessão.", deleteTitle: "Eliminar sessão?", deleteDesc: "Isto eliminará permanentemente a sessão e as suas mensagens.", deleteConfirm: "Eliminar", deleteCancel: "Cancelar" },
};

export default function FrameworkGuide() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const s = STR[language] || STR.en;

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadConversations = useCallback(async () => {
    try {
      const list = await base44.agents.listConversations({ agent_name: AGENT_NAME });
      const hidden = getHidden();
      const visible = (list || []).filter((c) => !hidden.has(c.id));
      setConversations(visible);
      if (visible.length && !activeId) setActiveId(visible[0].id);
    } catch (e) {
      toast({ title: s.loadErr, description: e.message, variant: "destructive" });
    }
  }, [activeId, toast, s.loadErr]);

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let unsub = () => {};
    (async () => {
      try {
        const conv = await base44.agents.getConversation(activeId);
        setMessages(conv?.messages || []);
        unsub = base44.agents.subscribeToConversation(activeId, (data) => setMessages(data.messages || []));
      } catch { /* ignore */ }
    })();
    return () => unsub();
  }, [activeId]);

  const handleNew = async () => {
    setCreating(true);
    try {
      const conv = await base44.agents.createConversation({ agent_name: AGENT_NAME, metadata: { name: `Session ${new Date().toLocaleString()}` } });
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
    } catch (e) {
      toast({ title: s.createErr, description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const hidden = getHidden();
    hidden.add(deletingId);
    saveHidden(hidden);
    setConversations((prev) => prev.filter((c) => c.id !== deletingId));
    if (activeId === deletingId) {
      setActiveId(null);
      setMessages([]);
    }
    setDeletingId(null);
  };

  const handleSend = async (text) => {
    setSending(true);
    try {
      const conv = await base44.agents.getConversation(activeId);
      await base44.agents.addMessage(conv, { role: "user", content: text });
    } catch (e) {
      toast({ title: s.createErr, description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{s.title}</h1>
        <p className="text-sm text-muted-foreground">{s.subtitle}</p>
      </div>
      <Card className="h-[calc(100vh-220px)] min-h-[480px] flex overflow-hidden">
        <div className="w-72 border-r border-border shrink-0 hidden md:block">
          <ConversationSidebar language={language} conversations={conversations} activeId={activeId} onSelect={setActiveId} onNew={handleNew} onDelete={setDeletingId} creating={creating} />
        </div>
        <div className="flex-1 min-w-0">
          {activeId ? (
            <ChatPanel language={language} conversation={activeId} messages={messages} onSend={handleSend} sending={sending} />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              <button onClick={handleNew} className="text-primary underline">{language === "pt" ? "Iniciar uma sessão" : "Start a session"}</button>
            </div>
          )}
        </div>
      </Card>
      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
        title={s.deleteTitle}
        description={s.deleteDesc}
        confirmLabel={s.deleteConfirm}
        cancelLabel={s.deleteCancel}
        onConfirm={handleDelete}
      />
    </div>
  );
}