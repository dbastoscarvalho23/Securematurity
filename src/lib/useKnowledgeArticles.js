import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Loads the persisted knowledge catalogue (KnowledgeArticle).
 *
 * @param {{ includeUnpublished?: boolean }} options
 *   includeUnpublished — also return drafts/archived articles (editorial view)
 * @returns {{ articles, allArticles, isLoading }}
 */
export function useKnowledgeArticles({ includeUnpublished = false } = {}) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['knowledge-articles'],
    queryFn: () => base44.entities.KnowledgeArticle.list('order_index', 500),
  });

  const active = data.filter(a => a.is_active !== false && (a.title || '').trim());

  return {
    articles: includeUnpublished ? active : active.filter(a => a.status === 'published'),
    allArticles: active,
    isLoading,
  };
}
