import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollText } from 'lucide-react';
import { format } from 'date-fns';

const actionColors = {
  assessment_created: 'bg-chart-1/10 text-chart-1',
  assessment_completed: 'bg-accent/10 text-accent',
  assessment_deleted: 'bg-destructive/10 text-destructive',
  customer_created: 'bg-chart-2/10 text-chart-2',
  customer_updated: 'bg-chart-3/10 text-chart-3',
  customer_deleted: 'bg-destructive/10 text-destructive',
  recommendation_generated: 'bg-chart-5/10 text-chart-5',
  report_exported: 'bg-muted text-muted-foreground',
  user_login: 'bg-muted text-muted-foreground',
  settings_changed: 'bg-chart-4/10 text-chart-4',
};

export default function AuditLog() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 200),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Track all platform activity and changes · <span className="text-foreground font-medium">{logs.length}</span> entries</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <ScrollText className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    No audit entries yet.
                  </TableCell>
                </TableRow>
              ) : logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {log.created_date ? format(new Date(log.created_date), 'MMM d, yyyy HH:mm') : ''}
                  </TableCell>
                  <TableCell>
                    <Badge className={actionColors[log.action] || 'bg-muted text-muted-foreground'}>
                      {log.action?.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.user_email}</TableCell>
                  <TableCell className="text-sm">{log.entity_type}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{log.details}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}