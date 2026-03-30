import React from 'react';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendUp, className, href }) {
  const Wrapper = href ? Link : 'div';
  return (
    <Wrapper to={href} className={href ? "block" : undefined}>
    <Card className={cn("p-6 relative overflow-hidden group hover:shadow-lg transition-shadow", href && "cursor-pointer", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <span className={cn("font-medium", trendUp ? "text-accent" : "text-destructive")}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
          <span className="text-muted-foreground">vs last period</span>
        </div>
      )}
      <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors" />
    </Card>
    </Wrapper>
  );
}