'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';
import { FeedbackItem } from '@/lib/services/admin-feedback';
import { MessageSquare, Bug, Lightbulb, HelpCircle, MoreHorizontal } from 'lucide-react';

interface FeedbackTableProps {
  feedback: FeedbackItem[];
  onStatusUpdate?: () => void;
}

const CATEGORY_CONFIG = {
  suggestion: { icon: Lightbulb, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  question: { icon: HelpCircle, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  bug: { icon: Bug, color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  'feature-request': { icon: Lightbulb, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  other: { icon: MessageSquare, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

const STATUS_CONFIG = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  reviewed: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'in-progress': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
  archived: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export function FeedbackTable({ feedback, onStatusUpdate }: FeedbackTableProps) {
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  function formatDate(dateStr: string): string {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  }

  function truncateMessage(message: string, maxLength: number = 100): string {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  }

  function handleRowClick(item: FeedbackItem) {
    setSelectedFeedback(item);
    setNewStatus(item.status);
    setAdminNotes(item.admin_notes || '');
  }

  async function handleUpdateStatus() {
    if (!selectedFeedback || !newStatus) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/feedback/${selectedFeedback.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          adminNotes: adminNotes || undefined,
        }),
      });

      if (response.ok) {
        setSelectedFeedback(null);
        onStatusUpdate?.();
      }
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <>
      <div data-testid="feedback-table" className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Date</TableHead>
              <TableHead className="text-muted-foreground">User</TableHead>
              <TableHead className="text-muted-foreground">Category</TableHead>
              <TableHead className="text-muted-foreground">Message</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedback.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No feedback found.
                </TableCell>
              </TableRow>
            ) : (
              feedback.map((item) => {
                const CategoryIcon = CATEGORY_CONFIG[item.category]?.icon || MessageSquare;
                return (
                  <TableRow
                    key={item.id}
                    onClick={() => handleRowClick(item)}
                    className="cursor-pointer border-border hover:bg-card"
                  >
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDate(item.created_at)}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {item.user_email}
                    </TableCell>
                    <TableCell>
                      <Badge className={CATEGORY_CONFIG[item.category]?.color}>
                        <CategoryIcon className="h-3 w-3 mr-1" />
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-md">
                      {truncateMessage(item.message)}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_CONFIG[item.status]}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedFeedback} onOpenChange={() => setSelectedFeedback(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Feedback Details</DialogTitle>
          </DialogHeader>
          {selectedFeedback && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">From:</span>
                  <p className="font-medium">{selectedFeedback.user_email}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Category:</span>
                  <Badge className={CATEGORY_CONFIG[selectedFeedback.category]?.color + ' ml-2'}>
                    {selectedFeedback.category}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Extension:</span>
                  <p className="font-medium">{selectedFeedback.extension_version || 'N/A'}</p>
                </div>
              </div>

              <div>
                <span className="text-sm text-muted-foreground">Message:</span>
                <div className="mt-1 p-3 bg-muted rounded-lg whitespace-pre-wrap">
                  {selectedFeedback.message}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Status</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="reviewed">Reviewed</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Admin Notes</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this feedback..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedFeedback(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateStatus} disabled={isUpdating}>
                  {isUpdating ? 'Updating...' : 'Update Status'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
