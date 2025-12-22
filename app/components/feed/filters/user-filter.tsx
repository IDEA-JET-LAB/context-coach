'use client';

import { useState } from 'react';
import { Users, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useTeamMembers } from '@/lib/hooks/use-team-members';
import { cn } from '@/lib/utils';

interface UserFilterProps {
  value: string[];
  onChange: (value: string[]) => void;
  teamId: string;
}

export function UserFilter({ value, onChange, teamId }: UserFilterProps) {
  const [open, setOpen] = useState(false);
  const { data: membersData } = useTeamMembers(teamId);
  const members = membersData?.members ?? [];

  const toggleUser = (userId: string) => {
    if (value.includes(userId)) {
      onChange(value.filter((id) => id !== userId));
    } else {
      onChange([...value, userId]);
    }
  };

  const clearAll = () => {
    onChange([]);
    setOpen(false);
  };

  const getLabel = () => {
    if (value.length === 0) return 'All users';
    if (value.length === 1) {
      const member = members.find((m) => m.user_id === value[0]);
      return member?.name ?? '1 user';
    }
    return `${value.length} users`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[160px] justify-start text-left font-normal bg-[#1a1a1a] border-[#2a2a2a]',
            value.length === 0 && 'text-muted-foreground'
          )}
          aria-label="Filter by user"
        >
          <Users className="mr-2 h-4 w-4" />
          {getLabel()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-2 bg-[#1a1a1a] border-[#2a2a2a]" align="start">
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start text-muted-foreground"
            onClick={clearAll}
          >
            All users
          </Button>
          {members.map((member) => (
            <Button
              key={member.user_id}
              variant="ghost"
              size="sm"
              className="justify-between"
              onClick={() => toggleUser(member.user_id)}
            >
              <span className="truncate">
                {member.name ?? member.user_id.slice(0, 8)}
              </span>
              {value.includes(member.user_id) && (
                <Check className="h-4 w-4 text-teal-500" />
              )}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
