'use client';

import { useState, useEffect, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const REFRESH_INTERVAL = 30; // 30 seconds minimum

interface AutoRefreshControlsProps {
  onRefresh: () => void;
  lastUpdated: Date;
  isRefreshing?: boolean;
}

export function AutoRefreshControls({
  onRefresh,
  lastUpdated,
  isRefreshing = false,
}: AutoRefreshControlsProps) {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [isTabVisible, setIsTabVisible] = useState(true);

  const handleRefresh = useCallback(() => {
    onRefresh();
    setCountdown(REFRESH_INTERVAL);
  }, [onRefresh]);

  // Handle tab visibility
  useEffect(() => {
    const handleVisibility = () => {
      setIsTabVisible(!document.hidden);
      if (!document.hidden) {
        // When tab becomes visible, do an immediate refresh
        handleRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [handleRefresh]);

  // Auto-refresh countdown
  useEffect(() => {
    if (!autoRefresh || !isTabVisible) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleRefresh();
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh, isTabVisible, handleRefresh]);

  // Reset countdown when auto-refresh is toggled on
  useEffect(() => {
    if (autoRefresh) {
      setCountdown(REFRESH_INTERVAL);
    }
  }, [autoRefresh]);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Switch
          id="auto-refresh"
          checked={autoRefresh}
          onCheckedChange={setAutoRefresh}
          data-testid="auto-refresh-toggle"
        />
        <Label htmlFor="auto-refresh" className="text-sm text-muted-foreground">
          Auto-refresh
        </Label>
      </div>

      {autoRefresh && isTabVisible && (
        <span
          className="text-sm text-muted-foreground"
          data-testid="refresh-countdown"
        >
          Refreshing in {countdown}s
        </span>
      )}

      {autoRefresh && !isTabVisible && (
        <span className="text-sm text-yellow-500">Paused (tab hidden)</span>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={isRefreshing}
        data-testid="refresh-button"
      >
        <RefreshCw
          className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
        Refresh Now
      </Button>

      <span className="text-xs text-muted-foreground" data-testid="last-updated">
        Last updated:{' '}
        {formatDistanceToNow(lastUpdated, { addSuffix: true })}
      </span>
    </div>
  );
}
