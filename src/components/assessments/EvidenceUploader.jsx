import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Paperclip, X, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EvidenceUploader({ attachments = [], onAttachmentsChange }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const updated = [...attachments, { name: file.name, url: file_url }];
    onAttachmentsChange(updated);
    setUploading(false);
    e.target.value = '';
  };

  const handleRemove = (index) => {
    const updated = attachments.filter((_, i) => i !== index);
    onAttachmentsChange(updated);
  };

  return (
    <div className="mt-2">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((att, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs text-muted-foreground border"
            >
              <FileText className="w-3 h-3 flex-shrink-0" />
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors max-w-[140px] truncate"
              >
                {att.name}
              </a>
              <button
                onClick={() => handleRemove(i)}
                className="ml-0.5 hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          "flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors",
          uploading && "opacity-50 cursor-not-allowed"
        )}
      >
        {uploading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Paperclip className="w-3.5 h-3.5" />
        )}
        {uploading ? 'Uploading...' : '+ Attach evidence file'}
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}