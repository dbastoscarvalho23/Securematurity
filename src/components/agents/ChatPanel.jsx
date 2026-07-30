import React, { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import MessageBubble from "./MessageBubble";

const STR = {
  en: { placeholder: "Ask about a framework, or reply with your answer…", send: "Send", thinking: "Assistant is working…" },
  pt: { placeholder: "Pergunte sobre um framework ou responda com a sua avaliação…", send: "Enviar", thinking: "O assistente está a trabalhar…" },
};

export default function ChatPanel({ language, conversation, messages, onSend, sending }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const s = STR[language] || STR.en;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sending) return;
    onSend(text);
    setInput("");
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{s.thinking}</div>
        )}
        {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
      </div>
      <div className="border-t border-border p-3 flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={s.placeholder}
          rows={1}
          className="resize-none max-h-32"
        />
        <Button onClick={handleSend} disabled={!input.trim() || sending} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}