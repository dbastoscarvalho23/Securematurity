import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ShieldCheck, Building2, BarChart3, Users } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import { useAuth } from '@/lib/AuthContext';

const COLORS = ['hsl(217,91%,60%)', 'hsl(173,58%,39%)', 'hsl(43,74%,66%)', 'hsl(27,87%,67%)', 'hsl(262,52%,56%)'];

export default function Admin() {
  const { user } = useAuth();
  const [filterSector, setFilterSector] = useState('all');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ['assessments'],
    queryFn: () => base44.entities.Assessment.list('-created_date', 200),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center space-y-2">
        <ShieldCheck className="w-10 h-10 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground">You don't have permission to view this page.</p>
      </div>
    );
  }

  const completed = assessments.filter(a => a.status === 'completed');
  const filteredCustomers = filterSector === 'all'
    ? customers
    : customers.filter(c => c.sector === filterSector);

  // Benchmark: avg score per sector
  const sectorBenchmark = {};
  completed.forEach(a => {
    const customer = customers.find(c => c.id === a.customer_id);
    if (!customer) return;
    const sector = customer.sector || 'unknown';
    if (!sectorBenchmark[sector]) sectorBenchmark[sector] = { scores: [], count: 0 };
    sectorBenchmark[sector].scores.push(a.overall_score || 0);
    sectorBenchmark[sector].count++;
  });

  const benchmarkData = Object.entries(sectorBenchmark).map(([sector, data]) => ({
    sector: sector.replace(/_/g, ' '),
    avg_score: Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10,
    count: data.count,
  })).sort((a, b) => b.avg_score - a.avg_score);

  // Customer rankings
  const customerRankings = filteredCustomers.map(c => {
    const customerAssessments = completed.filter(a => a.customer_id === c.id);
    const latest = customerAssessments[0];
    return {
      ...c,
      latestScore: latest?.overall_score || null,
      assessmentCount: customerAssessments.length,
      latestPeriod: latest?.period || '-',
    };
  }).sort((a, b) => (b.latestScore || 0) - (a.latestScore || 0));

  const sectors = [...new Set(customers.map(c => c.sector).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">Platform-wide benchmarking and analytics</p>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Customers" value={customers.length} icon={Building2} />
        <StatCard title="Total Users" value={users.length} icon={Users} />
        <StatCard title="Completed Assessments" value={completed.length} icon={ShieldCheck} />
        <StatCard
          title="Avg Maturity Score"
          value={completed.length > 0
            ? (completed.reduce((s, a) => s + (a.overall_score || 0), 0) / completed.length).toFixed(1)
            : '—'
          }
          icon={BarChart3}
        />
      </div>

      {/* Sector Benchmark */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Maturity by Sector</CardTitle>
        </CardHeader>
        <CardContent>
          {benchmarkData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={benchmarkData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="sector" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="avg_score" radius={[4, 4, 0, 0]}>
                  {benchmarkData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No benchmark data yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Customer Rankings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Customer Rankings</CardTitle>
            <Select value={filterSector} onValueChange={setFilterSector}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                {sectors.map(s => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Assessments</TableHead>
                <TableHead>Latest Period</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerRankings.map((c, i) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="capitalize text-sm">{c.sector?.replace(/_/g, ' ')}</TableCell>
                  <TableCell className="text-sm">{c.num_employees || '-'}</TableCell>
                  <TableCell className="text-sm">{c.assessmentCount}</TableCell>
                  <TableCell className="text-sm font-mono">{c.latestPeriod}</TableCell>
                  <TableCell>
                    {c.latestScore != null ? (
                      <span className="font-bold">{c.latestScore.toFixed(1)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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