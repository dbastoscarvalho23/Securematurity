/**
 * ArticleEditorialPanel — editorial management of the knowledge catalogue.
 *
 * Every state change goes through the `transitionArticleStatus` backend
 * function: the panel only offers the moves that are legal for the current
 * status and never writes the entity directly.
 */
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2, Upload, ShieldCheck, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/lib/LanguageContext';
import { ARTICLE_ACTIONS_BY_STATUS, KB_FRAMEWORKS, getArticleFrameworkColor, getArticleFrameworkTint } from '@/lib/kbFrameworks';

const STATUS_STYLES = {
  draft: 'bg-muted text-muted-foreground',
  in_review: 'bg-chart-3/10 text-chart-3',
  published: 'bg-chart-2/10 text-chart-2',
  archived: 'bg-chart-4/10 text-chart-4',
};

export default function ArticleEditorialPanel({ articles = [] }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['knowledge-articles'] });

  const transitionMutation = useMutation({
    mutationFn: async ({ articleId, action, note }) => {
      await base44.functions.invoke('transitionArticleStatus', {
        action,
        article_id: articleId,
        note: note || '',
      });
    },
    onSuccess: () => {
      toast.success(t('kb_editorial_action_done'));
      invalidate();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || error?.data?.error || t('kb_editorial_action_error'));
    },
    onSettled: () => setPending(null),
  });

  const seedMutation = useMutation({
    mutationFn: () => base44.functions.invoke('seedKnowledgeBase', {}),
    onSuccess: (result) => {
      toast.success(`${result?.created ?? 0} · ${t('kb_editorial_seed')}`);
      invalidate();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || error?.data?.error || t('kb_editorial_action_error'));
    },
  });

  const runAction = (article, actionKey) => {
    let note = '';
    if (actionKey === 'reject') {
      note = window.prompt(t('kb_editorial_reject_prompt')) || '';
      if (!note.trim()) return;
    }
    setPending(`${article.id}:${actionKey}`);
    transitionMutation.mutate({ articleId: article.id, action: actionKey, note });
  };

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <FileText className="w-10 h-10 kb-text-muted" />
        <p className="kb-text-muted text-sm">{t('kb_editorial_empty')}</p>
        <Button
          size="sm"
          className="gap-2"
          disabled={seedMutation.isPending}
          onClick={() => seedMutation.mutate()}
        >
          {seedMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {seedMutation.isPending ? t('kb_editorial_seeding') : t('kb_editorial_seed')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 kb-text-muted" />
        <div>
          <h2 className="kb-title text-sm">{t('kb_editorial_title')}</h2>
          <p className="kb-text-muted text-xs">{t('kb_editorial_subtitle')}</p>
        </div>
      </div>

      <div className="space-y-2">
        {articles.map((article) => {
          const fwColor = getArticleFrameworkColor(article);
          const fw = KB_FRAMEWORKS[article.framework];
          const actions = ARTICLE_ACTIONS_BY_STATUS[article.status] || [];
          return (
            <div
              key={article.id}
              className="kb-bg-surface kb-border-c border rounded-xl p-3 flex flex-wrap items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="kb-card-title text-sm">{article.title}</p>
                  <Badge className={`text-[10px] border-0 ${STATUS_STYLES[article.status] || ''}`}>
                    {t(`kb_status_${article.status}`)}
                  </Badge>
                  {fw && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ backgroundColor: getArticleFrameworkTint(article), color: fwColor }}
                    >
                      {article.framework}
                    </span>
                  )}
                </div>
                <p className="kb-text-muted text-xs mt-1 line-clamp-1">{article.summary}</p>
                <p className="kb-text-muted text-[11px] mt-1">
                  {t('kb_editorial_version')} {article.version || 1}
                  {article.published_at
                    ? ` · ${t('kb_editorial_published_at')} ${new Date(article.published_at).toLocaleDateString()}`
                    : ''}
                  {article.review_note ? ` · "${article.review_note}"` : ''}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {actions.map((actionKey) => {
                  const isPending = pending === `${article.id}:${actionKey}`;
                  return (
                    <Button
                      key={actionKey}
                      size="sm"
                      variant={actionKey === 'publish' ? 'default' : 'outline'}
                      className="h-7 text-xs gap-1.5"
                      disabled={!!pending}
                      onClick={() => runAction(article, actionKey)}
                    >
                      {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                      {t(`kb_action_${actionKey}`)}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
