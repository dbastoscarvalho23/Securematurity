import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, FileIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function TaskComments({ taskId }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      toast.success('Comment added');
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to add comment');
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    
    setIsSubmitting(true);
    await addCommentMutation.mutateAsync({
      task_id: taskId,
      content: content.trim(),
    });
    setIsSubmitting(false);
  };

  return (
    <div className="border-t pt-4 space-y-4">
      <h3 className="text-sm font-semibold">Comments</h3>
      
      {/* Comment List */}
      <div className="space-y-3 max-h-48 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No comments yet</p>
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
          placeholder="Add a comment..."
          rows={2}
          disabled={isSubmitting}
          className="text-xs resize-none"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || !content.trim()}
            className="gap-1.5"
          >
            {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Comment
          </Button>
        </div>
      </form>
    </div>
  );
}