import React from 'react';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendUp, className, href, onClick, clickable }) {
  const isInteractive = !!(href || onClick || clickable);
  const Wrapper = href ? Link : 'div';
  return (
    <Wrapper to={href} className={href ? "block" : undefined}>
      <Card
        className={cn(
          "p-6 relative overflow-hidden group transition-shadow",
          isInteractive ? "cursor-pointer hover:shadow-lg hover:ring-1 hover:ring-primary/20" : "hover:shadow-md",
          className
        )}
        onClick={onClick}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={cn("p-3 rounded-xl shrink-0", isInteractive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
            {Icon && <Icon className="w-5 h-5" />}
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            <span className={cn("font-medium", trendUp ? "text-accent" : "text-destructive")}>
              {trendUp ? '↑' : '↓'} {trend}
            </span>
            <span className="text-muted-foreground">vs last period</span>
          </div>
        )}
        {isInteractive && (
          <div className="absolute bottom-2 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="w-3.5 h-3.5 text-primary/50" />
          </div>
        )}
        <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors" />
      </Card>
    </Wrapper>
  );
}