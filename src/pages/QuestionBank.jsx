import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Pencil, Trash2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import QuestionFormDialog from '@/components/questions/QuestionFormDialog';

const FRAMEWORKS = [
  { code: 'NIS2', name: 'NIS2' },
  { code: 'ISO27001', name: 'ISO 27001' },
  { code: 'NIST_CSF', name: 'NIST CSF' },
  { code: 'CIS_V8', name: 'CIS v8' },
];

const FRAMEWORK_COLORS = {
  NIS2: 'bg-chart-1/10 text-chart-1 border-chart-1/20',
  ISO27001: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  NIST_CSF: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  CIS_V8: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
};

export default function QuestionBank() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterFramework, setFilterFramework] = useState('all');
  const [filterDomain, setFilterDomain] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['questions'],
    queryFn: () => base44.entities.Question.list('order_index', 500),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Question.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions'] }),
  });

  const domains = useMemo(() => {
    const filtered = filterFramework !== 'all'
      ? questions.filter(q => q.framework_code === filterFramework)
      : questions;
    return [...new Set(filtered.map(q => q.domain).filter(Boolean))].sort();
  }, [questions, filterFramework]);

  const filtered = useMemo(() => {
    return questions.filter(q => {
      const matchFw = filterFramework === 'all' || q.framework_code === filterFramework;
      const matchDomain = filterDomain === 'all' || q.domain === filterDomain;
      const matchSearch = !search || q.question_text?.toLowerCase().includes(search.toLowerCase())
        || q.control_id?.toLowerCase().includes(search.toLowerCase())
        || q.domain?.toLowerCase().includes(search.toLowerCase());
      return matchFw && matchDomain && matchSearch;
    });
  }, [questions, filterFramework, filterDomain, search]);

  const handleEdit = (q) => {
    setEditingQuestion(q);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingQuestion(null);
    setDialogOpen(true);
  };

  const handleDelete = (q) => {
    if (confirm(`Delete question "${q.question_text.substring(0, 60)}..."?`)) {
      deleteMutation.mutate(q.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Question Bank</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage assessment questions across all frameworks
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" /> New Question
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search questions..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterFramework} onValueChange={v => { setFilterFramework(v); setFilterDomain('all'); }}>
              <SelectTrigger className="w-44">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue placeholder="All Frameworks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Frameworks</SelectItem>
                {FRAMEWORKS.map(fw => <SelectItem key={fw.code} value={fw.code}>{fw.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDomain} onValueChange={setFilterDomain}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Domains" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Domains</SelectItem>
                {domains.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>Showing <strong className="text-foreground">{filtered.length}</strong> of {questions.length} questions</span>
        {FRAMEWORKS.map(fw => {
          const count = questions.filter(q => q.framework_code === fw.code).length;
          return count > 0 ? (
            <span key={fw.code}>
              <Badge variant="outline" className={`text-xs ${FRAMEWORK_COLORS[fw.code]}`}>{fw.name}</Badge>
              {' '}{count}
            </span>
          ) : null;
        })}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
              <p>No questions found.</p>
              <Button variant="outline" size="sm" onClick={handleNew}>Create your first question</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead className="w-32">Framework</TableHead>
                  <TableHead className="w-40">Domain</TableHead>
                  <TableHead className="w-28">Control ID</TableHead>
                  <TableHead className="w-16">Weight</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q, i) => (
                  <TableRow key={q.id} className="group">
                    <TableCell className="text-muted-foreground text-xs font-mono">{i + 1}</TableCell>
                    <TableCell>
                      <p className="text-sm line-clamp-2">{q.question_text}</p>
                      {q.guidance && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{q.guidance}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${FRAMEWORK_COLORS[q.framework_code] || ''}`}>
                        {q.framework_code}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{q.domain}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{q.control_id || '—'}</TableCell>
                    <TableCell className="text-sm text-center">{q.weight || 1}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(q)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(q)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <QuestionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        question={editingQuestion}
      />
    </div>
  );
}