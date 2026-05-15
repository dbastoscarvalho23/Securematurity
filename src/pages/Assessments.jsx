import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, Search, ClipboardCheck, MoreHorizontal, Trash2, Eye, Play, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import NewAssessmentDialog from '@/components/assessments/NewAssessmentDialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { exportReportPdf } from '@/lib/exportReportPdf';

const statusStyles = {
  draft: 'bg-muted text-muted-foreground',
  in_progress: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  completed: 'bg-accent/10 text-accent border-accent/20',
  archived: 'bg-muted text-muted-foreground',
};

export default function Assessments() {
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [exportingId, setExportingId] = useState(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const customerId = user?.customer_id;

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ['assessments', user?.email, customerId],
    queryFn: () => isAdmin
      ? base44.entities.Assessment.list('-created_date')
      : base44.entities.Assessment.filter({ customer_id: customerId }, '-created_date'),
    enabled: isAdmin || !!customerId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Assessment.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assessments'] }),
  });

  const handleExport = async (a) => {
    setExportingId(a.id);
    const [recs, tasks] = await Promise.all([
      base44.entities.Recommendation.filter({ assessment_id: a.id }, '-created_date', 200),
      base44.entities.Task.filter({ customer_id: a.customer_id }, '-created_date', 200),
    ]);
    exportReportPdf(a, recs, tasks);
    setExportingId(null);
  };

  const filtered = assessments.filter(a =>
    a.title?.toLowerCase().includes(search.toLowerCase()) ||
    a.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{t('assessments_subtitle')}</p>
        {isAdmin && (
          <Button onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="w-4 h-4" /> {t('assessments_new')}
          </Button>
        )}
      </div>

      {isAdmin && <NewAssessmentDialog open={showNew} onOpenChange={setShowNew} />}

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('assessments_search_placeholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('assessments_col_assessment')}</TableHead>
                <TableHead>{t('assessments_col_customer')}</TableHead>
                <TableHead>{t('assessments_col_period')}</TableHead>
                <TableHead>{t('assessments_col_frameworks')}</TableHead>
                <TableHead>{t('assessments_col_score')}</TableHead>
                <TableHead>{t('assessments_col_status')}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t('common_loading')}</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {search ? t('assessments_no_results') : t('assessments_empty')}
                  </TableCell>
                </TableRow>
              ) : filtered.map(a => (
                <TableRow key={a.id} className="group cursor-pointer hover:bg-muted/30">
                  <TableCell>
                    <Link to={`/assessments/${a.id}`} className="font-medium text-sm hover:text-primary transition-colors">
                      {a.title}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.created_date ? format(new Date(a.created_date), 'MMM d, yyyy') : ''}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{a.customer_name}</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">{a.period}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(a.frameworks || []).map(f => (
                        <Badge key={f} variant="outline" className="text-xs">{f.replace(/_/g, ' ')}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {a.overall_score != null ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm">{a.overall_score.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">/5</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs border capitalize", statusStyles[a.status])}>
                      {a.status?.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/assessments/${a.id}`}>
                            {a.status === 'completed' ? <Eye className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                            {a.status === 'completed' ? t('assessments_view_results') : t('assessments_continue')}
                          </Link>
                        </DropdownMenuItem>
                        {a.status === 'completed' && (
                          <DropdownMenuItem
                            onClick={() => handleExport(a)}
                            disabled={exportingId === a.id}
                          >
                            {exportingId === a.id
                              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              : <FileDown className="w-4 h-4 mr-2" />}
                            {t('assessments_export_pdf')}
                          </DropdownMenuItem>
                        )}
                        {isAdmin && (
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(a.id)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}