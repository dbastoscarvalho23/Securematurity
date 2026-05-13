import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Mail, Phone, Globe, Users, Briefcase, Hash, Pencil, ExternalLink, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusStyles = {
  active: 'bg-accent/10 text-accent border-accent/20',
  inactive: 'bg-muted text-muted-foreground',
  onboarding: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
};

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0">
      <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export default function CustomerDetailDialog({ open, onOpenChange, customer, onEdit }) {
  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-lg font-bold flex-shrink-0">
              {customer.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-base leading-tight truncate">{customer.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={cn("text-xs border capitalize", statusStyles[customer.status])}>
                  {customer.status}
                </Badge>
                {customer.sector && (
                  <span className="text-xs text-muted-foreground capitalize">{customer.sector.replace(/_/g, ' ')}</span>
                )}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-0 mt-2">
          <InfoRow icon={Hash} label="NIF" value={customer.nif} />
          <InfoRow icon={ShieldCheck} label="Cybersecurity Manager" value={customer.cybersecurity_manager} />
          <InfoRow icon={Mail} label="Manager Email" value={customer.cybersecurity_manager_email} />
          <InfoRow icon={Phone} label="Manager Phone" value={customer.cybersecurity_manager_phone} />
          <InfoRow icon={Users} label="Contact Name" value={customer.contact_name} />
          <InfoRow icon={Mail} label="Contact Email" value={customer.contact_email} />
          <InfoRow icon={Phone} label="Contact Phone" value={customer.contact_phone} />
          <InfoRow icon={Briefcase} label="Employees" value={customer.num_employees} />
          <InfoRow icon={Building2} label="Sector" value={customer.sector?.replace(/_/g, ' ')} />
          {customer.website && (
            <div className="flex items-start gap-3 py-2.5 border-b last:border-0">
              <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Website</p>
                <a
                  href={customer.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                >
                  {customer.website} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
          {customer.notes && (
            <div className="pt-2.5">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-foreground bg-muted/30 rounded-lg px-3 py-2">{customer.notes}</p>
            </div>
          )}
          {customer.allowed_frameworks?.length > 0 && (
            <div className="pt-2.5">
              <p className="text-xs text-muted-foreground mb-1.5">Allowed Frameworks</p>
              <div className="flex flex-wrap gap-1.5">
                {customer.allowed_frameworks.map(f => (
                  <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={() => { onOpenChange(false); onEdit(customer); }} className="gap-2" size="sm">
            <Pencil className="w-3.5 h-3.5" /> Edit Customer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}