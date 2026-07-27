import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { validators } from '@/lib/validation';

const STATUS_STYLES = {
  draft: 'bg-muted text-muted-foreground',
  under_review: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  approved: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  deprecated: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function ApprovalDialog({ open, onOpenChange, doc, approverName, approverEmail, onConfirm }) {
  const [signature, setSignature] = useState('');
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const signatureValid = signature.trim().toLowerCase() === approverEmail?.toLowerCase() ||
    signature.trim().toLowerCase() === approverName?.toLowerCase();
  const commentsError = validators.maxLength(comments, 2000);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formErrors = {};
    if (validators.required(signature)) formErrors.signature = 'Signature is required.';
    else if (!signatureValid) formErrors.signature = 'Signature must match your name or email address.';
    if (commentsError) formErrors.comments = commentsError;
    setErrors(formErrors);
    if (Object.keys(formErrors).length > 0) return;
    setSaving(true);
    await onConfirm({ comments, signature: signature.trim() });
    setSaving(false);
    setSignature('');
    setComments('');
    setErrors({});
  };

  const handleClose = () => {
    setSignature('');
    setComments('');
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-chart-2" />
            Formal Document Approval
          </DialogTitle>
          <DialogDescription>
            By signing off, you confirm this document has been reviewed and meets all requirements.
          </DialogDescription>
        </DialogHeader>

        {doc && (
          <div className="rounded-lg border bg-muted/20 px-4 py-3 space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <p className="text-sm font-medium">{doc.title}</p>
              {doc.version && <span className="text-xs text-muted-foreground">v{doc.version}</span>}
            </div>
            <div className="flex items-center gap-2 flex-wrap pl-6">
              <Badge variant="outline" className={`text-xs ${STATUS_STYLES[doc.status]}`}>
                {doc.status?.replace('_', ' ')}
              </Badge>
              <span className="text-xs text-muted-foreground capitalize">{doc.level}</span>
              {doc.customer_name && <span className="text-xs text-muted-foreground">· {doc.customer_name}</span>}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Approval Comments <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={comments}
              onChange={e => { setComments(e.target.value); if (errors.comments) setErrors(p => ({ ...p, comments: null })); }}
              placeholder="Add any notes about this approval decision..."
              rows={2}
              className={errors.comments ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {errors.comments && <p className="text-xs text-destructive">{errors.comments}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>
              Electronic Signature <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Type your full name or email address (<span className="font-medium">{approverEmail}</span>) to sign off.
            </p>
            <Input
              value={signature}
              onChange={e => setSignature(e.target.value)}
              placeholder="Type your name or email to confirm..."
              className={signature && !signatureValid ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {signature && !signatureValid && (
              <p className="text-xs text-destructive">Signature must match your name or email address.</p>
            )}
            {signature && signatureValid && (
              <p className="text-xs text-chart-2 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Signature verified
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={!signatureValid || saving}
              className="gap-2 bg-chart-2 hover:bg-chart-2/90 text-white"
            >
              {saving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <ShieldCheck className="w-4 h-4" />
              }
              Approve &amp; Sign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}