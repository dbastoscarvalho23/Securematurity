import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

const TYPE_ICONS = {
  task_completed: '✅',
  task_assigned: '📋',
  risk_status: '⚠️',
  document_approved: '✔️',
  document_review: '🔍',
  risk_due_soon: '🔔',
  task_due_soon: '⏰',
  general: '💬',
};

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user?.email) return;
    const data = await base44.entities.Notification.filter(
      { user_email: user.email },
      '-created_date',
      50
    );
    setNotifications(data);
  }, [user?.email]);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30s for new notifications
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsub = base44.entities.Notification.subscribe((event) => {
      if (event.type === 'create' && event.data?.user_email === user?.email) {
        setNotifications(prev => [event.data, ...prev].slice(0, 50));
      } else if (event.type === 'update') {
        setNotifications(prev => prev.map(n => n.id === event.id ? event.data : n));
      } else if (event.type === 'delete') {
        setNotifications(prev => prev.filter(n => n.id !== event.id));
      }
    });
    return unsub;
  }, [user?.email]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markRead = async (id) => {
    await base44.entities.Notification.update(id, { is_read: true });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    setLoading(true);
    const unread = notifications.filter(n => !n.is_read);
    await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setLoading(false);
  };

  const deleteNotification = async (id, e) => {
    e.stopPropagation();
    await base44.entities.Notification.delete(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) await markRead(notif.id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 text-[10px] px-1.5">{unreadCount}</Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={markAllRead}
              disabled={loading}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="h-[420px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
              <Bell className="w-8 h-8 opacity-20" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map(notif => (
                <NotificationItem
                  key={notif.id}
                  notif={notif}
                  onClick={() => handleNotificationClick(notif)}
                  onDelete={(e) => deleteNotification(notif.id, e)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function NotificationItem({ notif, onClick, onDelete }) {
  const icon = TYPE_ICONS[notif.type] || '💬';
  const timeAgo = notif.created_date
    ? formatDistanceToNow(new Date(notif.created_date), { addSuffix: true })
    : '';

  const content = (
    <div
      className={cn(
        'group flex items-start gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors relative',
        !notif.is_read && 'bg-primary/5'
      )}
      onClick={onClick}
    >
      {/* Unread dot */}
      {!notif.is_read && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
      )}

      <span className="text-base mt-0.5 flex-shrink-0">{icon}</span>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', !notif.is_read ? 'font-semibold' : 'font-medium')}>
          {notif.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
          {notif.message}
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo}</p>
      </div>

      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );

  if (notif.link) {
    return <Link to={notif.link} className="block">{content}</Link>;
  }
  return content;
}