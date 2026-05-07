import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, Paperclip, Upload, X, FileText, FileImage, FileArchive, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

function fileIcon(name = '') {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return FileImage;
  if (['zip', 'tar', 'gz', 'rar'].includes(ext)) return FileArchive;
  return FileText;
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TaskAttachments({ attachments = [], onChange }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const uploadFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        const res = await base44.integrations.Core.UploadFile({ file });
        uploaded.push({
          name: file.name,
          url: res.file_url,
          size: file.size,
          uploaded_by: user?.email || '',
          uploaded_at: new Date().toISOString(),
        });
      }
      onChange([...attachments, ...uploaded]);
      toast.success(`${uploaded.length} file${uploaded.length !== 1 ? 's' : ''} attached`);
    } catch {
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index) => {
    onChange(attachments.filter((_, i) => i !== index));
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    uploadFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Paperclip className="w-3.5 h-3.5" />
          Attachments
          {attachments.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">({attachments.length})</span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          Upload
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => { uploadFiles(e.target.files); e.target.value = ''; }}
      />

      {/* Existing attachments */}
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((att, i) => {
            const Icon = fileIcon(att.name);
            return (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-muted/30 group hover:bg-muted/50 transition-colors">
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1 truncate"
                  >
                    <span className="truncate">{att.name}</span>
                    <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                  </a>
                  <p className="text-[10px] text-muted-foreground">
                    {att.uploaded_by && <span>{att.uploaded_by}</span>}
                    {att.size ? <span> · {formatBytes(att.size)}</span> : null}
                    {att.uploaded_at ? (
                      <span> · {formatDistanceToNow(new Date(att.uploaded_at), { addSuffix: true })}</span>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed text-xs text-muted-foreground cursor-pointer transition-colors',
          dragActive ? 'border-primary bg-primary/5 text-primary' : 'border-muted-foreground/20 hover:border-muted-foreground/40',
          uploading && 'opacity-50 pointer-events-none'
        )}
      >
        {uploading ? (
          <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</>
        ) : (
          <><Upload className="w-3 h-3" /> Drag & drop files or click to browse</>
        )}
      </div>
    </div>
  );
}