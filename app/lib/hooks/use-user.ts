'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export function useUser() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['user'],
    queryFn: async (): Promise<UserProfile | null> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return null;

      // Check if there's a profile with name/avatar
      const { data: profile } = await supabase
        .from('users')
        .select('name, avatar_url')
        .eq('id', user.id)
        .single();

      return {
        id: user.id,
        email: user.email ?? '',
        name: profile?.name ?? user.user_metadata?.name ?? null,
        avatarUrl: profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
