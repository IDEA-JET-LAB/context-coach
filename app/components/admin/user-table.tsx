'use client';

import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  is_disabled: boolean;
  is_super_admin: boolean;
  last_active_at: string | null;
  created_at: string;
}

interface UserTableProps {
  users: AdminUser[];
}

export function UserTable({ users }: UserTableProps) {
  const router = useRouter();

  function handleRowClick(userId: string) {
    router.push(`/admin/users/${userId}`);
  }

  function formatLastActive(lastActiveAt: string | null): string {
    if (!lastActiveAt) {
      return 'Never';
    }
    try {
      return formatDistanceToNow(new Date(lastActiveAt), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  }

  return (
    <div data-testid="users-table" className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">Email</TableHead>
            <TableHead className="text-muted-foreground">Name</TableHead>
            <TableHead className="text-muted-foreground">Status</TableHead>
            <TableHead className="text-muted-foreground">Last Active</TableHead>
            <TableHead className="text-muted-foreground">Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                No users found.
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow
                key={user.id}
                onClick={() => handleRowClick(user.id)}
                className="cursor-pointer border-border hover:bg-card"
              >
                <TableCell className="font-medium text-foreground">
                  {user.email}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.name || '-'}
                </TableCell>
                <TableCell>
                  {user.is_disabled ? (
                    <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">
                      Disabled
                    </Badge>
                  ) : (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      Active
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatLastActive(user.last_active_at)}
                </TableCell>
                <TableCell>
                  {user.is_super_admin && (
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                      Super Admin
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
