import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, FileIcon, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function TaskComments({ taskId }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: comments = [] } = useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: () => taskId ? base44.entities.Comment.filter({ task_id: taskId }, '-created_date', 100) : Promise.resolve([]),
    enabled: !!taskId,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (commentData) => {
      const res = await base44.entities.Comment.create(commentData);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
      setContent('');
      toast.success(t('tc_added'));
    },
    onError: (err) => {
      toast.error(err?.message || t('tc_add_failed'));
    },
  });

  const uploadFiles = async (files) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    try {
      const uploaded = [];
      for (const file of files) {
        const res = await base44.integrations.Core.UploadFile({ file });
        uploaded.push({
          name: file.name,
          url: res.file_url,
        });
      }
      setAttachments(prev => [...prev, ...uploaded]);
      toast.success(t('tc_files_uploaded', { n: uploaded.length }));
    } catch (err) {
      toast.error(err?.message || t('tc_upload_failed'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e) => {
    uploadFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    uploadFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && attachments.length === 0) return;

    setIsSubmitting(true);
    await addCommentMutation.mutateAsync({
      task_id: taskId,
      content: content.trim(),
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    setAttachments([]);
    setIsSubmitting(false);
  };

  return (
    <div className="border-t pt-4 space-y-4">
      <h3 className="text-sm font-semibold">{t('tc_title')}</h3>

      {/* Comment List */}
      <div className="space-y-3 max-h-48 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">{t('tc_no_comments')}</p>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="p-2.5 rounded-lg bg-muted/50 border text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium">{comment.created_by}</span>
                <span className="text-muted-foreground text-xs">
                  {comment.created_date ? formatDistanceToNow(new Date(comment.created_date), { addSuffix: true }) : ''}
                </span>
              </div>
              <p className="text-foreground/90">{comment.content}</p>
              {comment.attachments && comment.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {comment.attachments.map((att, i) => (
                    <a
                      key={i}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline text-xs"
                    >
                      <FileIcon className="w-3 h-3" />
                      {att.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('tc_placeholder')}
          rows={2}
          disabled={isSubmitting || isUploading}
          className="text-xs resize-none"
        />

        {/* Attachments List */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 rounded-lg bg-muted/30 border">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-card rounded-md text-xs border">
                <FileIcon className="w-3 h-3 text-muted-foreground" />
                <span className="truncate max-w-[120px]">{att.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                  className="ml-1 hover:text-destructive transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* File Upload Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative p-3 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
            dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-muted-foreground/40'
          } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
          />
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            {isUploading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                {t('common_uploading')}
              </>
            ) : (
              <>
                <Upload className="w-3 h-3" />
                {t('tc_drag_hint')}
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || isUploading || (!content.trim() && attachments.length === 0)}
            className="gap-1.5"
          >
            {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            {t('tc_comment')}
          </Button>
        </div>
      </form>
    </div>
  );
}