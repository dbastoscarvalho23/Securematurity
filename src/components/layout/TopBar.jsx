import React, { useState, useEffect } from 'react';
import { User, LogOut, Settings, Building2, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/customers': 'Customers',
  '/assessments': 'Assessments',
  '/question-bank': 'Question DB',
  '/recommendations': 'Recommendations',
  '/tasks': 'Tasks',
  '/task-analytics': 'Task Analytics',
  '/action-plan': 'Action Plan',
  '/reports': 'Reports & Analytics',
  '/admin': 'Admin Dashboard',
  '/audit-log': 'Audit Log',
  '/settings': 'Settings',
  '/risk-assessment': 'Risk Assessment',
  '/security-documents': 'Security Documents',
  '/document-audit-trail': 'Document Audit Trail',
};

export default function TopBar() {
  const { user, refreshUser } = useAuth();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const pageTitle = Object.entries(PAGE_TITLES).find(([path]) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  )?.[1] || 'CyberMaturity';

  const displayName = user?.display_name || user?.full_name || user?.email || 'User';
  const initials = displayName
    ? displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdmin = user?.role === 'admin';
  const roleLabel = { admin: 'Platform Admin', customer_admin: 'Customer Admin', user: 'User' }[user?.role] || 'User';
  const customerName = user?.customer_name;

  const openProfile = () => {
    setName(user?.display_name || user?.full_name || user?.email || '');
    setProfileOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.auth.updateMe({ display_name: name });
      await refreshUser();
      toast.success('Profile updated');
      setProfileOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">{pageTitle}</h2>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2.5 text-sm font-medium h-9 px-3">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  {initials}
                </div>
                <div className="hidden md:flex flex-col items-start leading-tight">
                  <span className="text-sm font-medium">{displayName}</span>
                  {!isAdmin && customerName && (
                    <span className="text-xs text-muted-foreground">{customerName}</span>
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  <p className="text-xs text-primary font-medium">{roleLabel}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground font-mono">
                      {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  </div>
                  {!isAdmin && customerName && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground truncate">{customerName}</p>
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openProfile}>
                <User className="w-4 h-4 mr-2" />
                My Profile
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => base44.auth.logout()}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>My Profile</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled className="bg-muted/50 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Input value={roleLabel} disabled className="bg-muted/50 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label>Local Time</Label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-muted/50">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-mono text-muted-foreground">
                  {currentTime.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
            {!isAdmin && customerName && (
              <div className="space-y-1.5">
                <Label>Customer</Label>
                <Input value={customerName} disabled className="bg-muted/50 text-muted-foreground" />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProfileOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}