# Phase 2 Security Architecture

## Table of Contents

- [Overview](#overview) (Line 30)
- [1. Data Protection Layers](#1-data-protection-layers) (Line 50)
  - [Extended 5-Layer Privacy Model](#extended-5-layer-privacy-model) (Line 52)
  - [Layer Implementation Details](#layer-implementation-details) (Line 90)
- [2. Multi-Tenant Isolation](#2-multi-tenant-isolation) (Line 180)
  - [Isolation Architecture](#isolation-architecture) (Line 182)
  - [Cross-Team Analytics Anonymization](#cross-team-analytics-anonymization) (Line 230)
- [3. Admin Access Control](#3-admin-access-control) (Line 280)
  - [Permission Model](#permission-model) (Line 282)
  - [Admin API Guards](#admin-api-guards) (Line 340)
  - [Two-Factor Authentication](#two-factor-authentication) (Line 400)
- [4. Configuration Security](#4-configuration-security) (Line 450)
  - [Prompt Injection Prevention](#prompt-injection-prevention) (Line 452)
  - [ReDoS Protection](#redos-protection) (Line 520)
  - [Configuration Signing](#configuration-signing) (Line 570)
- [5. Comprehensive Audit Logging](#5-comprehensive-audit-logging) (Line 620)
  - [Audit Event Schema](#audit-event-schema) (Line 622)
  - [Audit Categories](#audit-categories) (Line 700)
  - [Audit Queries](#audit-queries) (Line 780)
- [6. Rate Limiting Strategy](#6-rate-limiting-strategy) (Line 850)
  - [Phase 2 Rate Limits](#phase-2-rate-limits) (Line 852)
  - [Implementation](#rate-limiting-implementation) (Line 920)
- [7. Data Retention & Deletion](#7-data-retention--deletion) (Line 1000)
  - [Retention Architecture](#retention-architecture) (Line 1002)
  - [Cascading Deletion](#cascading-deletion) (Line 1060)
  - [GDPR Compliance](#gdpr-compliance) (Line 1120)
- [8. API Security](#8-api-security) (Line 1180)
  - [JWT & API Key Scoping](#jwt--api-key-scoping) (Line 1182)
  - [Request Signing](#request-signing) (Line 1240)
  - [CORS Configuration](#cors-configuration) (Line 1300)
- [9. Database Security & RLS Policies](#9-database-security--rls-policies) (Line 1350)
  - [Complete RLS Policy SQL](#complete-rls-policy-sql) (Line 1352)
- [10. Incident Response](#10-incident-response) (Line 1600)
  - [Anomaly Detection](#anomaly-detection) (Line 1602)
  - [Breach Notification Workflow](#breach-notification-workflow) (Line 1680)
- [Implementation Checklist](#implementation-checklist) (Line 1750)

---

## Overview

This document defines the comprehensive security architecture for Contextor Phase 2. Phase 2 introduces sensitive features including full transcript mining, response capture, session tracking, and configurable analysis engines. Users will upload complete Claude Code transcripts containing source code, file paths, database schemas, and potentially secrets that escaped local redaction.

**Security Principles:**

1. **Defense in Depth** - Multiple layers of protection at every level
2. **Zero Trust** - Verify everything, trust nothing by default
3. **Privacy by Design** - Data minimization and user control built-in
4. **Fail Secure** - System fails to secure state when errors occur
5. **Audit Everything** - Complete trail of all sensitive operations

**Trust Foundation:** Users must feel completely safe uploading their development transcripts. Every security decision prioritizes user trust.

---

## 1. Data Protection Layers

### Extended 5-Layer Privacy Model

Phase 2 extends the existing privacy model with additional protections for response data and session context:

| Layer | Phase 1 | Phase 2 Extension |
|-------|---------|-------------------|
| **1. Local Redaction** | Secret patterns (API keys, tokens, passwords) | Extended patterns: DB queries, connection strings, file paths, code snippets |
| **2. Transparency** | Basic consent dialog | Granular consent per data type (prompts, responses, sessions, analytics) |
| **3. User Control** | Delete/export all data | Selective deletion by date/project/type, audit trail access, retention controls |
| **4. Encryption** | Column-level encryption | Key rotation support, optional per-team encryption keys |
| **5. Minimization** | Basic redaction | Response summarization, file path hashing, tool input truncation |

### Layer Implementation Details

#### Layer 1: Enhanced Local Redaction

```typescript
// lib/capture/redact-enhanced.ts

/**
 * Extended redaction patterns for Phase 2
 * These patterns protect sensitive data BEFORE it leaves the user's machine
 */
export const ENHANCED_REDACTION_PATTERNS = {
  // Existing patterns (from Phase 1)
  secrets: {
    apiKeys: /(?:api[_-]?key|apikey|api_secret)[\s]*[:=][\s]*["']?([a-zA-Z0-9_\-]{16,})["']?/gi,
    awsKeys: /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g,
    jwtTokens: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    privateKeys: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    githubTokens: /(?:ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[a-zA-Z0-9]{36,}/g,
    gitlabTokens: /glpat-[a-zA-Z0-9\-_]{20,}/g,
    googleApiKeys: /AIza[0-9A-Za-z\-_]{35}/g,
  },

  // Phase 2: Database patterns
  database: {
    connectionStrings: /(?:postgres|postgresql|mysql|mongodb|redis|amqp):\/\/[^\s"'<>]+/gi,
    sqlQueries: /(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\s+[\s\S]{0,500}?(?:FROM|INTO|TABLE|DATABASE)\s+[`"']?(\w+)[`"']?/gi,
    dbCredentials: /(?:password|passwd|pwd|secret)[\s]*[:=][\s]*["']([^"']+)["']/gi,
  },

  // Phase 2: File system patterns
  filesystem: {
    homeDirectories: /\/(?:Users|home)\/[a-zA-Z0-9_-]+/g,
    sensitiveConfigs: /\/(?:\.env|\.aws|\.ssh|\.gnupg|\.config)\/[^\s"'<>]*/g,
    absolutePaths: /(?:\/[a-zA-Z0-9_.-]+){4,}/g, // Paths with 4+ segments
  },

  // Phase 2: Code patterns
  code: {
    envVariables: /process\.env\.([A-Z_][A-Z0-9_]*)/g,
    configObjects: /(?:config|settings|credentials)[\s]*[:=][\s]*\{[\s\S]{0,1000}?\}/gi,
  }
};

/**
 * Redaction result with audit trail
 */
export interface RedactionResult {
  redactedText: string;
  redactionLog: RedactionEntry[];
  stats: {
    totalRedactions: number;
    byCategory: Record<string, number>;
  };
}

export interface RedactionEntry {
  category: string;
  pattern: string;
  originalLength: number;
  position: number;
}

/**
 * Performs comprehensive redaction on text
 * Returns both redacted text and audit log of what was removed
 */
export function redactSensitiveData(
  text: string,
  options: {
    redactFilePaths: boolean;
    redactDbQueries: boolean;
    customPatterns: string[];
  }
): RedactionResult {
  const redactionLog: RedactionEntry[] = [];
  let result = text;
  let offset = 0;

  // Process each category
  for (const [category, patterns] of Object.entries(ENHANCED_REDACTION_PATTERNS)) {
    // Skip filesystem if user opted out
    if (category === 'filesystem' && !options.redactFilePaths) continue;
    if (category === 'database' && !options.redactDbQueries) continue;

    for (const [patternName, regex] of Object.entries(patterns)) {
      const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');

      let match;
      while ((match = globalRegex.exec(result)) !== null) {
        const replacement = `[REDACTED:${category.toUpperCase()}]`;

        redactionLog.push({
          category,
          pattern: patternName,
          originalLength: match[0].length,
          position: match.index,
        });

        result = result.slice(0, match.index) + replacement + result.slice(match.index + match[0].length);
        globalRegex.lastIndex = match.index + replacement.length;
      }
    }
  }

  // Process custom patterns
  for (const pattern of options.customPatterns) {
    try {
      const customRegex = new RegExp(pattern, 'g');
      result = result.replace(customRegex, '[REDACTED:CUSTOM]');
    } catch {
      // Invalid regex, skip
    }
  }

  return {
    redactedText: result,
    redactionLog,
    stats: {
      totalRedactions: redactionLog.length,
      byCategory: redactionLog.reduce((acc, entry) => {
        acc[entry.category] = (acc[entry.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    },
  };
}
```

#### Layer 2: Granular Consent

```typescript
// lib/privacy/consent.ts

/**
 * Granular consent types for Phase 2
 */
export interface DataConsentPreferences {
  // Core data types
  capturePrompts: boolean;        // User prompts to Claude
  captureResponses: boolean;      // Claude's responses (new in Phase 2)
  captureSessions: boolean;       // Session metadata (new in Phase 2)
  captureToolUsage: boolean;      // Which tools were called

  // Analysis types
  enableScoring: boolean;         // AI-powered scoring
  enablePatternAnalysis: boolean; // Pattern detection across prompts
  enableTeamComparison: boolean;  // Compare with team members

  // Data sharing
  shareWithTeam: boolean;         // Team can see prompts
  includeInBenchmarks: boolean;   // Anonymized benchmarks
  allowAITraining: boolean;       // Use for model improvement (always false by default)

  // Timestamps
  consentGivenAt: string | null;
  lastReviewedAt: string | null;
}

/**
 * Default consent settings (privacy-first)
 */
export const DEFAULT_CONSENT: DataConsentPreferences = {
  capturePrompts: true,
  captureResponses: false,  // Opt-in for responses
  captureSessions: true,
  captureToolUsage: true,
  enableScoring: true,
  enablePatternAnalysis: true,
  enableTeamComparison: true,
  shareWithTeam: true,
  includeInBenchmarks: false,
  allowAITraining: false,  // Always false by default
  consentGivenAt: null,
  lastReviewedAt: null,
};
```

#### Layer 4: Key Rotation Support

```sql
-- Migration: 20251223000000_encryption_key_rotation.sql

-- Table to track encryption key versions
CREATE TABLE encryption_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_version INTEGER NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'rotating', 'retired')),
  -- Key is stored in Vault, not here
  vault_secret_name TEXT NOT NULL
);

-- Track which key version encrypted each record
ALTER TABLE prompts ADD COLUMN encryption_key_version INTEGER DEFAULT 1;
ALTER TABLE prompt_responses ADD COLUMN encryption_key_version INTEGER DEFAULT 1;

-- Function to get current active key
CREATE OR REPLACE FUNCTION get_active_encryption_key()
RETURNS TEXT AS $$
DECLARE
  key_name TEXT;
  key_value TEXT;
BEGIN
  SELECT vault_secret_name INTO key_name
  FROM encryption_keys
  WHERE status = 'active'
  ORDER BY key_version DESC
  LIMIT 1;

  IF key_name IS NULL THEN
    RAISE EXCEPTION 'No active encryption key found';
  END IF;

  SELECT decrypted_secret INTO key_value
  FROM vault.decrypted_secrets
  WHERE name = key_name;

  RETURN key_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to rotate encryption key
-- This creates a new key version and marks old one for rotation
CREATE OR REPLACE FUNCTION rotate_encryption_key(new_vault_secret_name TEXT)
RETURNS INTEGER AS $$
DECLARE
  new_version INTEGER;
BEGIN
  -- Mark current active key as rotating
  UPDATE encryption_keys
  SET status = 'rotating', rotated_at = NOW()
  WHERE status = 'active';

  -- Get next version number
  SELECT COALESCE(MAX(key_version), 0) + 1 INTO new_version
  FROM encryption_keys;

  -- Insert new key
  INSERT INTO encryption_keys (key_version, vault_secret_name, status)
  VALUES (new_version, new_vault_secret_name, 'active');

  RETURN new_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 2. Multi-Tenant Isolation

### Isolation Architecture

Phase 2 introduces new data types that require strict tenant isolation:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TENANT BOUNDARY                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                         TEAM A                               │   │
│  │  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐   │   │
│  │  │ Projects │  │ Team Members │  │ Team Analytics      │   │   │
│  │  └────┬─────┘  └──────────────┘  └─────────────────────┘   │   │
│  │       │                                                      │   │
│  │  ┌────▼───────────────────────────────────────────────────┐ │   │
│  │  │ Sessions │ Prompts │ Responses │ User Daily Analytics  │ │   │
│  │  └────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                         TEAM B                               │   │
│  │              (Completely Isolated from Team A)               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     SHARED (READ-ONLY COPIES)                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Global Analysis Config │ Default Scoring Weights │ Templates│   │
│  │      (Copied to team on first access, then isolated)        │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Isolation Enforcement

```typescript
// lib/security/tenant-isolation.ts

/**
 * Verifies that a resource belongs to the specified team
 * Throws if access is not allowed
 */
export async function verifyTeamAccess(
  supabase: SupabaseClient,
  resourceType: 'prompt' | 'session' | 'project' | 'analytics',
  resourceId: string,
  teamId: string
): Promise<void> {
  const tableMap: Record<string, string> = {
    prompt: 'prompts',
    session: 'sessions',
    project: 'projects',
    analytics: 'team_daily_analytics',
  };

  const { data, error } = await supabase
    .from(tableMap[resourceType])
    .select('team_id')
    .eq('id', resourceId)
    .single();

  if (error || !data) {
    throw new TenantAccessError('Resource not found');
  }

  if (data.team_id !== teamId) {
    // Log potential breach attempt
    console.error(`[SECURITY] Cross-tenant access attempt: ${resourceType}/${resourceId} by team ${teamId}`);
    throw new TenantAccessError('Access denied');
  }
}

/**
 * Error thrown on tenant boundary violations
 */
export class TenantAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantAccessError';
  }
}
```

### Cross-Team Analytics Anonymization

```typescript
// lib/analytics/anonymize.ts

/**
 * Anonymization levels for cross-team analytics
 */
export type AnonymizationLevel = 'none' | 'partial' | 'full';

/**
 * Anonymized analytics data structure
 */
export interface AnonymizedAnalytics {
  // Identifiable (only with 'none' level)
  teamId?: string;
  userId?: string;

  // Always included (aggregate only)
  promptCount: number;
  averageScore: number;
  scoreDistribution: number[];
  dimensionAverages: Record<string, number>;

  // Time-based (bucketed)
  periodStart: string;
  periodEnd: string;

  // Metadata
  anonymizationLevel: AnonymizationLevel;
  sampleSize: number;
}

/**
 * Anonymizes analytics data based on the specified level
 *
 * - 'none': No anonymization (team internal use)
 * - 'partial': Remove user IDs, keep team aggregates
 * - 'full': Remove all identifiers, suitable for public benchmarks
 */
export function anonymizeAnalytics(
  data: RawAnalyticsData,
  level: AnonymizationLevel
): AnonymizedAnalytics {
  // Minimum sample size for anonymized data
  const MIN_SAMPLE_SIZE = 10;

  if (level !== 'none' && data.sampleSize < MIN_SAMPLE_SIZE) {
    throw new Error(
      `Cannot anonymize data with sample size < ${MIN_SAMPLE_SIZE} (got ${data.sampleSize})`
    );
  }

  const result: AnonymizedAnalytics = {
    promptCount: data.promptCount,
    averageScore: roundToDecimal(data.averageScore, 1),
    scoreDistribution: data.scoreDistribution.map(v => roundToDecimal(v, 2)),
    dimensionAverages: Object.fromEntries(
      Object.entries(data.dimensionAverages).map(([k, v]) => [k, roundToDecimal(v, 1)])
    ),
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    anonymizationLevel: level,
    sampleSize: data.sampleSize,
  };

  if (level === 'none') {
    result.teamId = data.teamId;
    result.userId = data.userId;
  } else if (level === 'partial') {
    result.teamId = data.teamId;
    // userId explicitly omitted
  }
  // 'full' omits both teamId and userId

  return result;
}

function roundToDecimal(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
```

---

## 3. Admin Access Control

### Permission Model

```typescript
// lib/auth/permissions.ts

/**
 * Role hierarchy for Contextor Phase 2
 */
export enum Role {
  SUPER_ADMIN = 'super_admin',
  TEAM_ADMIN = 'team_admin',
  MEMBER = 'member',
}

/**
 * Permission definitions
 */
export const PERMISSIONS = {
  // Global (Super Admin only)
  'global.config.read': [Role.SUPER_ADMIN],
  'global.config.write': [Role.SUPER_ADMIN],
  'global.users.manage': [Role.SUPER_ADMIN],
  'global.teams.manage': [Role.SUPER_ADMIN],
  'global.audit.read': [Role.SUPER_ADMIN],
  'global.experiments.manage': [Role.SUPER_ADMIN],

  // Team-level
  'team.settings.read': [Role.SUPER_ADMIN, Role.TEAM_ADMIN],
  'team.settings.write': [Role.SUPER_ADMIN, Role.TEAM_ADMIN],
  'team.members.manage': [Role.SUPER_ADMIN, Role.TEAM_ADMIN],
  'team.analytics.read': [Role.SUPER_ADMIN, Role.TEAM_ADMIN],
  'team.scoring.customize': [Role.SUPER_ADMIN, Role.TEAM_ADMIN],

  // User-level (self + team visibility)
  'user.prompts.read.own': [Role.SUPER_ADMIN, Role.TEAM_ADMIN, Role.MEMBER],
  'user.prompts.read.team': [Role.SUPER_ADMIN, Role.TEAM_ADMIN],
  'user.analytics.read.own': [Role.SUPER_ADMIN, Role.TEAM_ADMIN, Role.MEMBER],
  'user.analytics.read.team.anonymized': [Role.SUPER_ADMIN, Role.TEAM_ADMIN, Role.MEMBER],
  'user.data.export': [Role.SUPER_ADMIN, Role.TEAM_ADMIN, Role.MEMBER],
  'user.data.delete': [Role.SUPER_ADMIN, Role.TEAM_ADMIN, Role.MEMBER],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Checks if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSIONS[permission]?.includes(role) ?? false;
}

/**
 * Permission check result with audit context
 */
export interface PermissionCheckResult {
  allowed: boolean;
  role: Role;
  permission: Permission;
  scope?: {
    teamId?: string;
    userId?: string;
  };
  reason?: string;
}

/**
 * Comprehensive permission check with scope validation
 */
export async function checkPermission(
  userId: string,
  permission: Permission,
  scope?: { teamId?: string; targetUserId?: string }
): Promise<PermissionCheckResult> {
  // Get user's role (global role or team-specific)
  const userRole = await getUserRole(userId, scope?.teamId);

  const baseResult: PermissionCheckResult = {
    allowed: false,
    role: userRole,
    permission,
    scope,
  };

  // Check basic permission
  if (!hasPermission(userRole, permission)) {
    return { ...baseResult, reason: 'Insufficient role permissions' };
  }

  // Additional scope checks for team-level permissions
  if (permission.startsWith('team.') && scope?.teamId) {
    const isMember = await isTeamMember(userId, scope.teamId);
    if (!isMember && userRole !== Role.SUPER_ADMIN) {
      return { ...baseResult, reason: 'Not a member of this team' };
    }
  }

  // Additional scope checks for user-level permissions
  if (permission.includes('.own') && scope?.targetUserId) {
    if (scope.targetUserId !== userId && userRole === Role.MEMBER) {
      return { ...baseResult, reason: 'Can only access own data' };
    }
  }

  return { ...baseResult, allowed: true };
}
```

### Admin API Guards

```typescript
// lib/api/guards.ts

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isUserSuperAdmin } from '@/lib/auth/admin';
import { checkRateLimit, adminSingleRateLimit, adminBulkRateLimit } from '@/lib/rate-limit';
import { logAdminAction } from '@/lib/services/admin-users';
import { isValidUuid } from '@/lib/utils/uuid';

/**
 * Admin API guard result
 */
export interface AdminGuardResult {
  authorized: true;
  adminId: string;
  request: Request;
}

export interface AdminGuardError {
  authorized: false;
  response: NextResponse;
}

export type AdminGuard = AdminGuardResult | AdminGuardError;

/**
 * Options for admin guard
 */
interface AdminGuardOptions {
  /** Type of rate limit to apply */
  rateLimit?: 'single' | 'bulk' | 'none';
  /** Permission required (defaults to super admin check) */
  permission?: string;
  /** Log this action to audit trail */
  auditAction?: string;
  /** Additional audit details */
  auditDetails?: Record<string, unknown>;
}

/**
 * Comprehensive admin API guard
 *
 * Use at the start of every admin API route handler:
 *
 * ```typescript
 * export async function POST(request: Request) {
 *   const guard = await adminGuard(request, {
 *     rateLimit: 'single',
 *     auditAction: 'config_update',
 *   });
 *   if (!guard.authorized) return guard.response;
 *
 *   // guard.adminId is now available
 *   const data = await updateConfig();
 *   return NextResponse.json({ data });
 * }
 * ```
 */
export async function adminGuard(
  request: Request,
  options: AdminGuardOptions = {}
): Promise<AdminGuard> {
  const { rateLimit = 'single', auditAction, auditDetails } = options;

  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
          { status: 401 }
        ),
      };
    }

    // 2. Verify super admin status
    const isAdmin = await isUserSuperAdmin(user.id);

    if (!isAdmin) {
      console.warn(`[Admin] Non-admin access attempt by user ${user.id}`);
      return {
        authorized: false,
        response: NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Super admin access required' } },
          { status: 403 }
        ),
      };
    }

    // 3. Apply rate limiting
    if (rateLimit !== 'none') {
      const limiter = rateLimit === 'bulk' ? adminBulkRateLimit : adminSingleRateLimit;
      const rateLimitResult = await checkRateLimit(limiter, user.id);

      if (!rateLimitResult.success) {
        return {
          authorized: false,
          response: NextResponse.json(
            { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
            {
              status: 429,
              headers: { 'Retry-After': String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)) }
            }
          ),
        };
      }
    }

    // 4. Log audit event if specified
    if (auditAction) {
      await logAdminAction(user.id, auditAction as any, auditDetails);
    }

    return {
      authorized: true,
      adminId: user.id,
      request,
    };
  } catch (error) {
    console.error('[Admin Guard] Error:', error);
    return {
      authorized: false,
      response: NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Authorization check failed' } },
        { status: 500 }
      ),
    };
  }
}

/**
 * Team admin guard - for team-level admin operations
 */
export async function teamAdminGuard(
  request: Request,
  teamId: string,
  options: Omit<AdminGuardOptions, 'permission'> = {}
): Promise<AdminGuard> {
  // Validate team ID format
  if (!isValidUuid(teamId)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: { code: 'INVALID_TEAM_ID', message: 'Invalid team ID format' } },
        { status: 400 }
      ),
    };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
          { status: 401 }
        ),
      };
    }

    // Check if user is super admin (bypasses team check)
    const isSuperAdmin = await isUserSuperAdmin(user.id);

    if (!isSuperAdmin) {
      // Check if user is team admin
      const { data: membership } = await supabase
        .from('team_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('team_id', teamId)
        .single();

      if (!membership || membership.role !== 'admin') {
        return {
          authorized: false,
          response: NextResponse.json(
            { error: { code: 'FORBIDDEN', message: 'Team admin access required' } },
            { status: 403 }
          ),
        };
      }
    }

    // Apply rate limiting
    if (options.rateLimit !== 'none') {
      const limiter = options.rateLimit === 'bulk' ? adminBulkRateLimit : adminSingleRateLimit;
      const rateLimitResult = await checkRateLimit(limiter, user.id);

      if (!rateLimitResult.success) {
        return {
          authorized: false,
          response: NextResponse.json(
            { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
            { status: 429 }
          ),
        };
      }
    }

    // Log audit event if specified
    if (options.auditAction) {
      await logAdminAction(user.id, options.auditAction as any, {
        ...options.auditDetails,
        teamId,
      });
    }

    return {
      authorized: true,
      adminId: user.id,
      request,
    };
  } catch (error) {
    console.error('[Team Admin Guard] Error:', error);
    return {
      authorized: false,
      response: NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Authorization check failed' } },
        { status: 500 }
      ),
    };
  }
}
```

### Two-Factor Authentication

```typescript
// lib/auth/2fa.ts

/**
 * 2FA enforcement for super admins
 *
 * Super admins MUST have 2FA enabled to perform sensitive operations.
 * This is enforced at the application level since Supabase Auth doesn't
 * have built-in 2FA enforcement by role.
 */
export interface TwoFactorStatus {
  enabled: boolean;
  method: '2fa_totp' | '2fa_phone' | null;
  verifiedAt: string | null;
}

/**
 * Checks if user has 2FA enabled
 */
export async function get2FAStatus(userId: string): Promise<TwoFactorStatus> {
  // Check Supabase auth factors
  const supabase = createAdminClient();
  const { data: factors } = await supabase.auth.admin.mfa.listFactors({ userId });

  if (!factors || factors.length === 0) {
    return { enabled: false, method: null, verifiedAt: null };
  }

  const verifiedFactor = factors.find(f => f.status === 'verified');

  if (!verifiedFactor) {
    return { enabled: false, method: null, verifiedAt: null };
  }

  return {
    enabled: true,
    method: verifiedFactor.factor_type as '2fa_totp' | '2fa_phone',
    verifiedAt: verifiedFactor.created_at,
  };
}

/**
 * Requires 2FA for super admin operations
 * Returns error response if 2FA is not enabled
 */
export async function require2FA(userId: string): Promise<NextResponse | null> {
  const status = await get2FAStatus(userId);

  if (!status.enabled) {
    return NextResponse.json(
      {
        error: {
          code: '2FA_REQUIRED',
          message: 'Two-factor authentication is required for super admin operations. Please enable 2FA in your account settings.',
        }
      },
      { status: 403 }
    );
  }

  return null; // 2FA is enabled, proceed
}

/**
 * Sensitive operations that require 2FA for super admins
 */
export const SENSITIVE_OPERATIONS = [
  'grant_super_admin',
  'revoke_super_admin',
  'delete_user',
  'bulk_delete',
  'config_update_global',
  'encryption_key_rotate',
  'export_all_data',
] as const;

export type SensitiveOperation = typeof SENSITIVE_OPERATIONS[number];

/**
 * Guard for sensitive operations
 */
export async function sensitiveOperationGuard(
  adminId: string,
  operation: SensitiveOperation
): Promise<NextResponse | null> {
  // Check if this is a sensitive operation
  if (!SENSITIVE_OPERATIONS.includes(operation)) {
    return null; // Not sensitive, proceed
  }

  // Require 2FA
  return require2FA(adminId);
}
```

---

## 4. Configuration Security

### Prompt Injection Prevention

Building on the existing `sanitizeUserPrompt` function, Phase 2 extends protection to all configurable templates:

```typescript
// lib/security/template-sanitizer.ts

/**
 * Sanitizes LLM template configurations to prevent prompt injection
 *
 * Templates can contain placeholders like {{user_prompt}} that get replaced
 * with user content. This function ensures templates don't contain malicious
 * instructions that could override the system prompt.
 */
export interface TemplateSanitizationResult {
  sanitized: string;
  warnings: TemplateSanitizationWarning[];
  blocked: boolean;
  blockReason?: string;
}

export interface TemplateSanitizationWarning {
  type: 'instruction_override' | 'role_injection' | 'delimiter_escape' | 'suspicious_pattern';
  position: number;
  original: string;
  replacement: string;
}

/**
 * Patterns that could be used for prompt injection in templates
 */
const DANGEROUS_PATTERNS = [
  // Role injection attempts
  { pattern: /\b(system|assistant|user):\s*/gi, type: 'role_injection' as const },

  // Instruction override attempts
  { pattern: /ignore\s+(all\s+)?(previous|above|prior|system)\s+(instructions?|prompts?|messages?)/gi, type: 'instruction_override' as const },
  { pattern: /disregard\s+(all\s+)?(previous|above|prior|system)/gi, type: 'instruction_override' as const },
  { pattern: /forget\s+(everything|all|previous)/gi, type: 'instruction_override' as const },
  { pattern: /you\s+are\s+now\s+a/gi, type: 'role_injection' as const },
  { pattern: /pretend\s+(you\s+are|to\s+be)/gi, type: 'role_injection' as const },

  // Delimiter escape attempts
  { pattern: /```\s*(system|assistant)/gi, type: 'delimiter_escape' as const },
  { pattern: /---\s*\n\s*(system|role)/gi, type: 'delimiter_escape' as const },

  // Score manipulation (specific to analysis templates)
  { pattern: /return\s+(all\s+)?scores?\s+(as|of)\s+\d+/gi, type: 'suspicious_pattern' as const },
  { pattern: /give\s+(all\s+)?scores?\s+\d+/gi, type: 'suspicious_pattern' as const },
  { pattern: /always\s+(give|return|output)\s+\d+/gi, type: 'suspicious_pattern' as const },
];

/**
 * Patterns that should BLOCK the template entirely (not just sanitize)
 */
const BLOCKING_PATTERNS = [
  // Direct code execution attempts
  /\{\{.*exec\s*\(.*\)\s*\}\}/gi,
  /\{\{.*eval\s*\(.*\)\s*\}\}/gi,
  // Template injection attempts
  /\{\{\{.*\}\}\}/g, // Triple braces (Handlebars unescaped)
];

/**
 * Sanitizes a template configuration
 */
export function sanitizeTemplate(template: string): TemplateSanitizationResult {
  const warnings: TemplateSanitizationWarning[] = [];
  let sanitized = template;

  // Check for blocking patterns first
  for (const blockPattern of BLOCKING_PATTERNS) {
    if (blockPattern.test(template)) {
      return {
        sanitized: '',
        warnings: [],
        blocked: true,
        blockReason: `Template contains blocked pattern: ${blockPattern.source}`,
      };
    }
  }

  // Sanitize dangerous patterns
  for (const { pattern, type } of DANGEROUS_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(sanitized)) !== null) {
      const replacement = '[FILTERED]';
      warnings.push({
        type,
        position: match.index,
        original: match[0],
        replacement,
      });

      sanitized = sanitized.slice(0, match.index) + replacement + sanitized.slice(match.index + match[0].length);
      regex.lastIndex = match.index + replacement.length;
    }
  }

  return {
    sanitized,
    warnings,
    blocked: false,
  };
}

/**
 * Validates a complete analysis configuration
 */
export function validateAnalysisConfig(config: {
  systemPrompt: string;
  dimensions: Array<{ promptTemplate: string; scoringCriteria: string }>;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate system prompt
  const systemResult = sanitizeTemplate(config.systemPrompt);
  if (systemResult.blocked) {
    errors.push(`System prompt blocked: ${systemResult.blockReason}`);
  } else if (systemResult.warnings.length > 0) {
    errors.push(`System prompt contains ${systemResult.warnings.length} sanitized patterns`);
  }

  // Validate each dimension
  for (let i = 0; i < config.dimensions.length; i++) {
    const dim = config.dimensions[i];

    const templateResult = sanitizeTemplate(dim.promptTemplate);
    if (templateResult.blocked) {
      errors.push(`Dimension ${i + 1} template blocked: ${templateResult.blockReason}`);
    }

    const criteriaResult = sanitizeTemplate(dim.scoringCriteria);
    if (criteriaResult.blocked) {
      errors.push(`Dimension ${i + 1} criteria blocked: ${criteriaResult.blockReason}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
```

### ReDoS Protection

```typescript
// lib/security/regex-validator.ts

/**
 * Validates regex patterns for ReDoS (Regular Expression Denial of Service) vulnerabilities
 *
 * ReDoS occurs when a regex can be made to take exponential time with
 * specially crafted input. This is a concern for user-defined patterns.
 */

/**
 * Maximum allowed quantifier repetition
 */
const MAX_QUANTIFIER = 100;

/**
 * Maximum allowed pattern length
 */
const MAX_PATTERN_LENGTH = 500;

/**
 * Maximum allowed groups
 */
const MAX_GROUPS = 10;

/**
 * Patterns that indicate potential ReDoS vulnerability
 */
const REDOS_INDICATORS = [
  // Nested quantifiers (e.g., (a+)+)
  /\([^)]*[+*]+[^)]*\)[+*]+/,
  // Overlapping alternatives with quantifiers (e.g., (a|a)+)
  /\([^|)]*\|[^)]*\)[+*]+/,
  // Multiple adjacent quantifiers
  /[+*]{2,}/,
  // Exponential backtracking patterns
  /\([^)]*[+*][^)]*\)\1/,
];

export interface RegexValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  safePattern?: string;
}

/**
 * Validates a regex pattern for safety
 */
export function validateRegexPattern(pattern: string): RegexValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check pattern length
  if (pattern.length > MAX_PATTERN_LENGTH) {
    errors.push(`Pattern too long (${pattern.length} > ${MAX_PATTERN_LENGTH})`);
    return { valid: false, errors, warnings };
  }

  // Try to compile the regex
  try {
    new RegExp(pattern);
  } catch (e) {
    errors.push(`Invalid regex syntax: ${(e as Error).message}`);
    return { valid: false, errors, warnings };
  }

  // Check for ReDoS indicators
  for (const indicator of REDOS_INDICATORS) {
    if (indicator.test(pattern)) {
      errors.push(`Pattern may be vulnerable to ReDoS: ${indicator.source}`);
    }
  }

  // Check quantifier bounds
  const unboundedQuantifiers = pattern.match(/[+*]\??\b/g);
  if (unboundedQuantifiers && unboundedQuantifiers.length > 3) {
    warnings.push('Multiple unbounded quantifiers may cause performance issues');
  }

  // Check group count
  const groups = pattern.match(/\(/g);
  if (groups && groups.length > MAX_GROUPS) {
    warnings.push(`Many groups (${groups.length}) may impact performance`);
  }

  // Check for large bounded quantifiers
  const boundedQuantifiers = pattern.match(/\{(\d+)(?:,(\d+))?\}/g);
  if (boundedQuantifiers) {
    for (const q of boundedQuantifiers) {
      const match = q.match(/\{(\d+)(?:,(\d+))?\}/);
      if (match) {
        const min = parseInt(match[1], 10);
        const max = match[2] ? parseInt(match[2], 10) : min;
        if (max > MAX_QUANTIFIER) {
          errors.push(`Quantifier bound too large: ${q} (max ${MAX_QUANTIFIER})`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    safePattern: errors.length === 0 ? pattern : undefined,
  };
}

/**
 * Creates a safe regex with timeout wrapper
 */
export function createSafeRegex(pattern: string, flags: string = 'g'): RegExp | null {
  const validation = validateRegexPattern(pattern);
  if (!validation.valid) {
    console.warn('[Regex] Invalid pattern:', validation.errors);
    return null;
  }
  return new RegExp(pattern, flags);
}

/**
 * Executes a regex with timeout protection
 * Returns null if execution takes too long
 */
export function safeRegexExec(
  regex: RegExp,
  text: string,
  timeoutMs: number = 1000
): RegExpExecArray | null {
  // For very long texts, use chunking
  if (text.length > 10000) {
    console.warn('[Regex] Text too long for safe execution, truncating');
    text = text.slice(0, 10000);
  }

  const start = Date.now();
  const result = regex.exec(text);
  const duration = Date.now() - start;

  if (duration > timeoutMs) {
    console.warn(`[Regex] Execution took ${duration}ms (limit: ${timeoutMs}ms)`);
    // In production, we'd use a worker thread with actual timeout
    return null;
  }

  return result;
}
```

### Configuration Signing

```typescript
// lib/security/config-signing.ts

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signs configuration to detect tampering
 *
 * All admin configurations are signed before storage and verified on load.
 * This provides integrity protection and audit trail.
 */

const SIGNING_KEY_ENV = 'CONFIG_SIGNING_KEY';

interface SignedConfig<T> {
  data: T;
  signature: string;
  signedAt: string;
  signedBy: string;
  version: number;
}

/**
 * Signs a configuration object
 */
export function signConfig<T>(
  config: T,
  adminId: string,
  version: number
): SignedConfig<T> {
  const signingKey = process.env[SIGNING_KEY_ENV];
  if (!signingKey) {
    throw new Error('CONFIG_SIGNING_KEY not configured');
  }

  const signedAt = new Date().toISOString();
  const dataToSign = JSON.stringify({ data: config, signedAt, signedBy: adminId, version });

  const hmac = createHmac('sha256', signingKey);
  hmac.update(dataToSign);
  const signature = hmac.digest('hex');

  return {
    data: config,
    signature,
    signedAt,
    signedBy: adminId,
    version,
  };
}

/**
 * Verifies a signed configuration
 */
export function verifyConfigSignature<T>(signedConfig: SignedConfig<T>): boolean {
  const signingKey = process.env[SIGNING_KEY_ENV];
  if (!signingKey) {
    console.error('[Config] Signing key not configured');
    return false;
  }

  const dataToSign = JSON.stringify({
    data: signedConfig.data,
    signedAt: signedConfig.signedAt,
    signedBy: signedConfig.signedBy,
    version: signedConfig.version,
  });

  const hmac = createHmac('sha256', signingKey);
  hmac.update(dataToSign);
  const expectedSignature = hmac.digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(
      Buffer.from(signedConfig.signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Size limits for configurations (DoS prevention)
 */
export const CONFIG_SIZE_LIMITS = {
  systemPrompt: 10000,         // 10KB
  dimensionTemplate: 5000,     // 5KB per dimension
  scoringCriteria: 2000,       // 2KB per dimension
  customPatterns: 100,         // Max 100 custom regex patterns
  patternLength: 500,          // Max 500 chars per pattern
  totalConfigSize: 100000,     // 100KB total
} as const;

/**
 * Validates configuration size limits
 */
export function validateConfigSize(config: {
  systemPrompt?: string;
  dimensions?: Array<{ promptTemplate: string; scoringCriteria: string }>;
  customPatterns?: string[];
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check system prompt
  if (config.systemPrompt && config.systemPrompt.length > CONFIG_SIZE_LIMITS.systemPrompt) {
    errors.push(`System prompt exceeds ${CONFIG_SIZE_LIMITS.systemPrompt} characters`);
  }

  // Check dimensions
  if (config.dimensions) {
    for (let i = 0; i < config.dimensions.length; i++) {
      const dim = config.dimensions[i];
      if (dim.promptTemplate.length > CONFIG_SIZE_LIMITS.dimensionTemplate) {
        errors.push(`Dimension ${i + 1} template exceeds ${CONFIG_SIZE_LIMITS.dimensionTemplate} characters`);
      }
      if (dim.scoringCriteria.length > CONFIG_SIZE_LIMITS.scoringCriteria) {
        errors.push(`Dimension ${i + 1} criteria exceeds ${CONFIG_SIZE_LIMITS.scoringCriteria} characters`);
      }
    }
  }

  // Check custom patterns
  if (config.customPatterns) {
    if (config.customPatterns.length > CONFIG_SIZE_LIMITS.customPatterns) {
      errors.push(`Too many custom patterns (${config.customPatterns.length} > ${CONFIG_SIZE_LIMITS.customPatterns})`);
    }
    for (let i = 0; i < config.customPatterns.length; i++) {
      if (config.customPatterns[i].length > CONFIG_SIZE_LIMITS.patternLength) {
        errors.push(`Pattern ${i + 1} exceeds ${CONFIG_SIZE_LIMITS.patternLength} characters`);
      }
    }
  }

  // Check total size
  const totalSize = JSON.stringify(config).length;
  if (totalSize > CONFIG_SIZE_LIMITS.totalConfigSize) {
    errors.push(`Total configuration exceeds ${CONFIG_SIZE_LIMITS.totalConfigSize} bytes`);
  }

  return { valid: errors.length === 0, errors };
}
```

---

## 5. Comprehensive Audit Logging

### Audit Event Schema

```typescript
// lib/audit/types.ts

/**
 * Comprehensive audit event for Phase 2
 * Extends the existing admin_audit_logs table
 */
export interface AuditEvent {
  id: string;
  timestamp: string;

  // Actor information
  actor_id: string;
  actor_type: 'user' | 'admin' | 'super_admin' | 'system' | 'api_key';
  actor_ip: string | null;
  actor_user_agent: string | null;

  // Action details
  action: AuditAction;
  action_category: AuditCategory;

  // Resource affected
  resource_type: ResourceType;
  resource_id: string | null;
  resource_team_id: string | null;

  // Change tracking
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;

  // Result
  result: 'success' | 'failure' | 'partial';
  failure_reason: string | null;

  // Metadata
  request_id: string | null;
  session_id: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * All auditable actions in Phase 2
 */
export type AuditAction =
  // Authentication
  | 'auth.login'
  | 'auth.logout'
  | 'auth.password_reset'
  | 'auth.2fa_enable'
  | 'auth.2fa_disable'
  | 'auth.session_revoke'

  // Configuration (super admin)
  | 'config.analysis.create'
  | 'config.analysis.update'
  | 'config.analysis.delete'
  | 'config.dimension.create'
  | 'config.dimension.update'
  | 'config.dimension.delete'
  | 'config.template.update'
  | 'config.experiment.create'
  | 'config.experiment.activate'
  | 'config.experiment.deactivate'

  // User management
  | 'user.create'
  | 'user.update'
  | 'user.disable'
  | 'user.enable'
  | 'user.delete'
  | 'user.grant_admin'
  | 'user.revoke_admin'

  // Team management
  | 'team.create'
  | 'team.update'
  | 'team.delete'
  | 'team.member.add'
  | 'team.member.remove'
  | 'team.member.role_change'
  | 'team.settings.update'

  // Data access
  | 'data.prompt.view'
  | 'data.prompt.export'
  | 'data.session.view'
  | 'data.analytics.view'
  | 'data.export.request'
  | 'data.export.download'
  | 'data.delete.request'
  | 'data.delete.execute'

  // API operations
  | 'api.key.create'
  | 'api.key.regenerate'
  | 'api.key.revoke'
  | 'api.capture.submit'
  | 'api.analysis.trigger'

  // System
  | 'system.maintenance'
  | 'system.backup'
  | 'system.restore';

export type AuditCategory =
  | 'authentication'
  | 'configuration'
  | 'user_management'
  | 'team_management'
  | 'data_access'
  | 'api_operation'
  | 'system';

export type ResourceType =
  | 'user'
  | 'team'
  | 'project'
  | 'prompt'
  | 'session'
  | 'analysis_config'
  | 'dimension'
  | 'experiment'
  | 'api_key'
  | 'export'
  | 'system';
```

### Audit Categories

```sql
-- Migration: 20251223100000_comprehensive_audit_logging.sql

-- Drop and recreate audit table with comprehensive schema
DROP TABLE IF EXISTS public.admin_audit_logs;

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Actor
  actor_id UUID REFERENCES public.users(id),
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('user', 'admin', 'super_admin', 'system', 'api_key')),
  actor_ip VARCHAR(45),
  actor_user_agent TEXT,

  -- Action
  action VARCHAR(50) NOT NULL,
  action_category VARCHAR(30) NOT NULL CHECK (action_category IN (
    'authentication', 'configuration', 'user_management',
    'team_management', 'data_access', 'api_operation', 'system'
  )),

  -- Resource
  resource_type VARCHAR(30),
  resource_id UUID,
  resource_team_id UUID REFERENCES public.teams(id),

  -- Changes
  old_value JSONB,
  new_value JSONB,

  -- Result
  result VARCHAR(10) NOT NULL DEFAULT 'success' CHECK (result IN ('success', 'failure', 'partial')),
  failure_reason TEXT,

  -- Metadata
  request_id UUID,
  session_id UUID,
  metadata JSONB
);

-- Indexes for common query patterns
CREATE INDEX idx_audit_actor ON public.audit_logs(actor_id, timestamp DESC);
CREATE INDEX idx_audit_action ON public.audit_logs(action, timestamp DESC);
CREATE INDEX idx_audit_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_team ON public.audit_logs(resource_team_id, timestamp DESC);
CREATE INDEX idx_audit_category ON public.audit_logs(action_category, timestamp DESC);
CREATE INDEX idx_audit_result ON public.audit_logs(result, timestamp DESC) WHERE result = 'failure';

-- Partitioning for performance (partition by month)
-- Note: This creates a template; actual partitions should be created by a maintenance job
CREATE TABLE public.audit_logs_template (LIKE public.audit_logs INCLUDING ALL);

-- RLS Policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can read all audit logs
CREATE POLICY audit_read_super_admin ON public.audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = TRUE)
  );

-- Team admins can read audit logs for their team
CREATE POLICY audit_read_team_admin ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE user_id = auth.uid()
        AND team_id = resource_team_id
        AND role = 'admin'
    )
  );

-- Users can read audit logs about their own actions
CREATE POLICY audit_read_own ON public.audit_logs
  FOR SELECT USING (actor_id = auth.uid());

-- Insert is done via service role (bypasses RLS)
-- No direct insert policy for regular users

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION log_audit_event(
  p_actor_id UUID,
  p_actor_type VARCHAR(20),
  p_action VARCHAR(50),
  p_action_category VARCHAR(30),
  p_resource_type VARCHAR(30) DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_resource_team_id UUID DEFAULT NULL,
  p_old_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL,
  p_result VARCHAR(10) DEFAULT 'success',
  p_failure_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_ip VARCHAR(45) DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    actor_id, actor_type, actor_ip, actor_user_agent,
    action, action_category,
    resource_type, resource_id, resource_team_id,
    old_value, new_value,
    result, failure_reason,
    metadata
  ) VALUES (
    p_actor_id, p_actor_type, p_ip, p_user_agent,
    p_action, p_action_category,
    p_resource_type, p_resource_id, p_resource_team_id,
    p_old_value, p_new_value,
    p_result, p_failure_reason,
    p_metadata
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retention policy: Archive logs older than 2 years
-- This should be run as a scheduled job
CREATE OR REPLACE FUNCTION archive_old_audit_logs()
RETURNS void AS $$
BEGIN
  -- Move old logs to archive table
  INSERT INTO public.audit_logs_archive
  SELECT * FROM public.audit_logs
  WHERE timestamp < NOW() - INTERVAL '2 years';

  -- Delete archived logs from main table
  DELETE FROM public.audit_logs
  WHERE timestamp < NOW() - INTERVAL '2 years';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Audit Queries

```typescript
// lib/audit/queries.ts

/**
 * Common audit log queries for Phase 2
 */

/**
 * Get audit trail for a specific user
 */
export async function getUserAuditTrail(
  supabase: SupabaseClient,
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    actions?: AuditAction[];
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<AuditEvent[]> {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .eq('actor_id', userId)
    .order('timestamp', { ascending: false });

  if (options.actions?.length) {
    query = query.in('action', options.actions);
  }
  if (options.startDate) {
    query = query.gte('timestamp', options.startDate.toISOString());
  }
  if (options.endDate) {
    query = query.lte('timestamp', options.endDate.toISOString());
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }
  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as AuditEvent[];
}

/**
 * Get audit trail for a team
 */
export async function getTeamAuditTrail(
  supabase: SupabaseClient,
  teamId: string,
  options: {
    limit?: number;
    categories?: AuditCategory[];
  } = {}
): Promise<AuditEvent[]> {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .eq('resource_team_id', teamId)
    .order('timestamp', { ascending: false });

  if (options.categories?.length) {
    query = query.in('action_category', options.categories);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as AuditEvent[];
}

/**
 * Get failed authentication attempts (security monitoring)
 */
export async function getFailedAuthAttempts(
  supabase: SupabaseClient,
  options: {
    hours?: number;
    minAttempts?: number;
  } = {}
): Promise<Array<{ ip: string; attempts: number; lastAttempt: string }>> {
  const hours = options.hours || 24;
  const minAttempts = options.minAttempts || 5;

  const { data, error } = await supabase
    .from('audit_logs')
    .select('actor_ip, timestamp')
    .eq('action', 'auth.login')
    .eq('result', 'failure')
    .gte('timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString());

  if (error) throw error;

  // Group by IP
  const byIp = new Map<string, { count: number; lastAttempt: string }>();
  for (const record of data) {
    const ip = record.actor_ip || 'unknown';
    const current = byIp.get(ip) || { count: 0, lastAttempt: '' };
    current.count++;
    if (record.timestamp > current.lastAttempt) {
      current.lastAttempt = record.timestamp;
    }
    byIp.set(ip, current);
  }

  // Filter and format
  return Array.from(byIp.entries())
    .filter(([, v]) => v.count >= minAttempts)
    .map(([ip, v]) => ({
      ip,
      attempts: v.count,
      lastAttempt: v.lastAttempt,
    }))
    .sort((a, b) => b.attempts - a.attempts);
}

/**
 * Get configuration change history
 */
export async function getConfigChangeHistory(
  supabase: SupabaseClient,
  configId: string,
  limit: number = 50
): Promise<AuditEvent[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('resource_type', 'analysis_config')
    .eq('resource_id', configId)
    .in('action', ['config.analysis.update', 'config.dimension.update', 'config.template.update'])
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as AuditEvent[];
}
```

---

## 6. Rate Limiting Strategy

### Phase 2 Rate Limits

| Endpoint Category | Limit | Window | Identifier | Rationale |
|-------------------|-------|--------|------------|-----------|
| Prompt capture | 100/min | Per API key | project_id | Normal dev activity |
| Batch capture | 500/hour | Per API key | project_id | Historical import |
| Analysis API | 60/min | Per user | user_id | Prevent abuse |
| Session API | 100/min | Per user | user_id | High frequency during dev |
| Admin config changes | 10/min | Per admin | admin_id | Prevent rapid changes |
| Bulk admin operations | 5/hour | Per admin | admin_id | Resource intensive |
| Export requests | 1/hour | Per user | user_id | Expensive operation |
| Data deletion | 3/day | Per user | user_id | Prevent accidents |
| Invitation tokens | 5/min | Per IP | ip_address | Prevent brute force |
| VS Code extension sync | 30/min | Per user | user_id | Background updates |
| Coaching suggestions | 10/min | Per user | user_id | Per-prompt coaching |

### Rate Limiting Implementation

```typescript
// lib/rate-limit/phase2.ts

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Phase 2 rate limiters extending the existing rate limit module
 */

// Get existing Redis client
const redis = process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    })
  : null;

/**
 * Batch capture rate limiter (historical import)
 * 500 requests per hour per API key
 */
export const batchCaptureRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(500, "1 h"),
      prefix: "ratelimit:batch-capture",
    })
  : null;

/**
 * Session API rate limiter
 * 100 requests per minute per user
 */
export const sessionRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      prefix: "ratelimit:session",
    })
  : null;

/**
 * Export request rate limiter
 * 1 request per hour per user
 */
export const exportRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(1, "1 h"),
      prefix: "ratelimit:export",
    })
  : null;

/**
 * Data deletion rate limiter
 * 3 requests per day per user
 */
export const deletionRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "24 h"),
      prefix: "ratelimit:deletion",
    })
  : null;

/**
 * VS Code extension sync rate limiter
 * 30 requests per minute per user
 */
export const extensionSyncRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      prefix: "ratelimit:extension-sync",
    })
  : null;

/**
 * Coaching suggestions rate limiter
 * 10 requests per minute per user
 */
export const coachingRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "ratelimit:coaching",
    })
  : null;

/**
 * Admin config change rate limiter
 * 10 changes per minute per admin
 */
export const adminConfigRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "ratelimit:admin-config",
    })
  : null;

/**
 * Rate limit middleware factory for API routes
 */
export function createRateLimitMiddleware(
  limiter: Ratelimit | null,
  identifierExtractor: (request: Request) => string
) {
  return async function rateLimitMiddleware(
    request: Request
  ): Promise<{ allowed: boolean; response?: Response }> {
    if (!limiter) {
      // Fail closed if configured
      if (process.env.RATE_LIMIT_FAIL_CLOSED === 'true') {
        return {
          allowed: false,
          response: new Response(
            JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Rate limiting unavailable' } }),
            { status: 503 }
          ),
        };
      }
      return { allowed: true };
    }

    const identifier = identifierExtractor(request);
    const result = await limiter.limit(identifier);

    if (!result.success) {
      const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
      return {
        allowed: false,
        response: new Response(
          JSON.stringify({
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests',
              retryAfter,
            }
          }),
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfter),
              'X-RateLimit-Limit': String(result.limit),
              'X-RateLimit-Remaining': String(result.remaining),
              'X-RateLimit-Reset': String(result.reset),
            },
          }
        ),
      };
    }

    return { allowed: true };
  };
}
```

---

## 7. Data Retention & Deletion

### Retention Architecture

```typescript
// lib/retention/types.ts

/**
 * User-configurable retention options
 */
export type RetentionPeriod = 30 | 90 | 365 | -1; // -1 = forever

/**
 * Retention settings per data type
 */
export interface RetentionSettings {
  prompts: RetentionPeriod;
  responses: RetentionPeriod;
  sessions: RetentionPeriod;
  analytics: RetentionPeriod;
}

/**
 * Default retention (privacy-first)
 */
export const DEFAULT_RETENTION: RetentionSettings = {
  prompts: 90,
  responses: 90,
  sessions: 365,
  analytics: -1, // Keep aggregated analytics forever
};

/**
 * Deletion request tracking
 */
export interface DeletionRequest {
  id: string;
  userId: string;
  requestType: 'selective' | 'full' | 'gdpr';
  scope: {
    dataTypes: ('prompts' | 'responses' | 'sessions' | 'analytics' | 'account')[];
    dateRange?: { start: string; end: string };
    projectIds?: string[];
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduledFor: string;
  completedAt: string | null;
  auditLogId: string;
}
```

### Cascading Deletion

```sql
-- Migration: 20251223200000_data_retention.sql

-- Retention settings table
CREATE TABLE data_retention_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prompts_days INTEGER DEFAULT 90,
  responses_days INTEGER DEFAULT 90,
  sessions_days INTEGER DEFAULT 365,
  analytics_days INTEGER DEFAULT -1, -- -1 = forever
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deletion request tracking
CREATE TABLE deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('selective', 'full', 'gdpr')),
  scope JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  audit_log_id UUID REFERENCES audit_logs(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Soft delete support for recovery window
ALTER TABLE prompts ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE prompt_responses ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN deleted_at TIMESTAMPTZ;

-- Indexes for soft delete queries
CREATE INDEX idx_prompts_deleted ON prompts(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_responses_deleted ON prompt_responses(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_sessions_deleted ON sessions(deleted_at) WHERE deleted_at IS NOT NULL;

-- Function to soft delete user data
CREATE OR REPLACE FUNCTION soft_delete_user_data(
  p_user_id UUID,
  p_data_types TEXT[],
  p_date_start TIMESTAMPTZ DEFAULT NULL,
  p_date_end TIMESTAMPTZ DEFAULT NULL,
  p_project_ids UUID[] DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB := '{}';
  v_count INTEGER;
BEGIN
  -- Soft delete prompts
  IF 'prompts' = ANY(p_data_types) THEN
    UPDATE prompts
    SET deleted_at = NOW()
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
      AND (p_date_start IS NULL OR created_at >= p_date_start)
      AND (p_date_end IS NULL OR created_at <= p_date_end)
      AND (p_project_ids IS NULL OR project_id = ANY(p_project_ids));
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('prompts_deleted', v_count);
  END IF;

  -- Soft delete responses (cascade from prompts)
  IF 'responses' = ANY(p_data_types) THEN
    UPDATE prompt_responses pr
    SET deleted_at = NOW()
    FROM prompts p
    WHERE pr.prompt_id = p.id
      AND p.user_id = p_user_id
      AND pr.deleted_at IS NULL
      AND (p_date_start IS NULL OR pr.created_at >= p_date_start)
      AND (p_date_end IS NULL OR pr.created_at <= p_date_end);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('responses_deleted', v_count);
  END IF;

  -- Soft delete sessions
  IF 'sessions' = ANY(p_data_types) THEN
    UPDATE sessions
    SET deleted_at = NOW()
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
      AND (p_date_start IS NULL OR started_at >= p_date_start)
      AND (p_date_end IS NULL OR started_at <= p_date_end)
      AND (p_project_ids IS NULL OR project_id = ANY(p_project_ids));
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('sessions_deleted', v_count);
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to permanently delete soft-deleted data after recovery window
CREATE OR REPLACE FUNCTION purge_deleted_data(p_recovery_days INTEGER DEFAULT 7)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB := '{}';
  v_count INTEGER;
  v_cutoff TIMESTAMPTZ := NOW() - (p_recovery_days || ' days')::INTERVAL;
BEGIN
  -- Delete old soft-deleted prompts and cascade to responses
  DELETE FROM prompts WHERE deleted_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('prompts_purged', v_count);

  -- Delete orphaned responses
  DELETE FROM prompt_responses WHERE deleted_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('responses_purged', v_count);

  -- Delete old soft-deleted sessions
  DELETE FROM sessions WHERE deleted_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('sessions_purged', v_count);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to apply retention policy
CREATE OR REPLACE FUNCTION apply_retention_policy()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB := '{}';
  v_user RECORD;
  v_user_result JSONB;
BEGIN
  FOR v_user IN
    SELECT u.id, r.prompts_days, r.responses_days, r.sessions_days
    FROM auth.users u
    LEFT JOIN data_retention_settings r ON u.id = r.user_id
  LOOP
    -- Calculate cutoff dates based on retention settings
    IF COALESCE(v_user.prompts_days, 90) > 0 THEN
      UPDATE prompts
      SET deleted_at = NOW()
      WHERE user_id = v_user.id
        AND deleted_at IS NULL
        AND created_at < NOW() - (COALESCE(v_user.prompts_days, 90) || ' days')::INTERVAL;
    END IF;

    IF COALESCE(v_user.sessions_days, 365) > 0 THEN
      UPDATE sessions
      SET deleted_at = NOW()
      WHERE user_id = v_user.id
        AND deleted_at IS NULL
        AND started_at < NOW() - (COALESCE(v_user.sessions_days, 365) || ' days')::INTERVAL;
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### GDPR Compliance

```typescript
// lib/gdpr/compliance.ts

/**
 * GDPR-compliant data handling for Contextor
 */

export interface GDPRExportData {
  user: {
    id: string;
    email: string;
    name: string;
    createdAt: string;
  };
  teams: Array<{
    id: string;
    name: string;
    role: string;
    joinedAt: string;
  }>;
  prompts: Array<{
    id: string;
    text: string;
    createdAt: string;
    projectName: string;
    analysis: Record<string, unknown> | null;
  }>;
  sessions: Array<{
    id: string;
    startedAt: string;
    endedAt: string | null;
    promptCount: number;
  }>;
  privacySettings: Record<string, unknown>;
  exportedAt: string;
}

/**
 * Generates GDPR data export for a user
 */
export async function generateGDPRExport(
  userId: string
): Promise<GDPRExportData> {
  const supabase = createAdminClient();

  // Fetch all user data
  const [
    userResult,
    teamsResult,
    promptsResult,
    sessionsResult,
    privacyResult,
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('team_members').select(`
      team_id,
      role,
      created_at,
      teams(id, name)
    `).eq('user_id', userId),
    supabase.from('prompts').select(`
      id,
      text,
      created_at,
      projects(name),
      prompt_analyses(*)
    `).eq('user_id', userId).is('deleted_at', null),
    supabase.from('sessions').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('privacy_preferences').select('*').eq('user_id', userId).single(),
  ]);

  return {
    user: {
      id: userResult.data?.id,
      email: userResult.data?.email,
      name: userResult.data?.name,
      createdAt: userResult.data?.created_at,
    },
    teams: (teamsResult.data || []).map(tm => ({
      id: (tm.teams as any)?.id,
      name: (tm.teams as any)?.name,
      role: tm.role,
      joinedAt: tm.created_at,
    })),
    prompts: (promptsResult.data || []).map(p => ({
      id: p.id,
      text: p.text,
      createdAt: p.created_at,
      projectName: (p.projects as any)?.name || 'Unknown',
      analysis: (p.prompt_analyses as any[])?.[0] || null,
    })),
    sessions: (sessionsResult.data || []).map(s => ({
      id: s.id,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      promptCount: s.total_prompts,
    })),
    privacySettings: privacyResult.data || {},
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Processes GDPR deletion request ("right to be forgotten")
 */
export async function processGDPRDeletion(
  userId: string,
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    // Start transaction-like operation
    // Note: Supabase doesn't support true transactions in JS client,
    // so we use careful ordering and error handling

    // 1. Anonymize user data
    const hash = createHash('md5').update(userId).digest('hex').slice(0, 8);
    await supabase
      .from('users')
      .update({
        email: `gdpr_deleted_${hash}@anonymized.local`,
        name: 'GDPR Deleted User',
        avatar_url: null,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // 2. Hard delete all prompts and responses
    await supabase.from('prompts').delete().eq('user_id', userId);

    // 3. Hard delete all sessions
    await supabase.from('sessions').delete().eq('user_id', userId);

    // 4. Delete privacy preferences
    await supabase.from('privacy_preferences').delete().eq('user_id', userId);

    // 5. Delete from Supabase Auth
    await supabase.auth.admin.deleteUser(userId);

    // 6. Update deletion request status
    await supabase
      .from('deletion_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    // 7. Log completion
    await logAuditEvent({
      actorId: userId,
      actorType: 'system',
      action: 'data.delete.execute',
      actionCategory: 'data_access',
      resourceType: 'user',
      resourceId: userId,
      result: 'success',
      metadata: { requestId, type: 'gdpr' },
    });

    return { success: true };
  } catch (error) {
    console.error('[GDPR] Deletion failed:', error);

    // Update request with error
    await supabase
      .from('deletion_requests')
      .update({
        status: 'failed',
        error_message: (error as Error).message,
      })
      .eq('id', requestId);

    return { success: false, error: (error as Error).message };
  }
}

/**
 * Anonymization function for keeping analytics while removing PII
 */
export async function anonymizeUserData(
  userId: string
): Promise<void> {
  const supabase = createAdminClient();

  // 1. Anonymize prompts (keep for analytics, remove text)
  await supabase
    .from('prompts')
    .update({
      text: '[ANONYMIZED]',
      // Keep: project_id, team_id, created_at, analysis scores
    })
    .eq('user_id', userId);

  // 2. Anonymize responses
  await supabase
    .from('prompt_responses')
    .update({
      response_text_encrypted: null, // Remove encrypted response
    })
    .in('prompt_id',
      supabase.from('prompts').select('id').eq('user_id', userId)
    );

  // 3. Update user record
  const hash = createHash('md5').update(userId).digest('hex').slice(0, 8);
  await supabase
    .from('users')
    .update({
      email: `anonymized_${hash}@anon.local`,
      name: 'Anonymized User',
      avatar_url: null,
    })
    .eq('id', userId);
}
```

---

## 8. API Security

### JWT & API Key Scoping

```typescript
// lib/api/auth.ts

/**
 * API Key scopes for Phase 2
 */
export enum APIKeyScope {
  READ_ONLY = 'read_only',
  READ_WRITE = 'read_write',
  CAPTURE_ONLY = 'capture_only',
}

/**
 * API Key validation result
 */
export interface APIKeyValidation {
  valid: boolean;
  projectId?: string;
  teamId?: string;
  scope?: APIKeyScope;
  error?: string;
}

/**
 * Validates API key and returns associated project/team info
 */
export async function validateAPIKey(
  apiKey: string
): Promise<APIKeyValidation> {
  if (!apiKey || !apiKey.startsWith('ctx_')) {
    return { valid: false, error: 'Invalid API key format' };
  }

  const supabase = createAdminClient();
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      id,
      team_id,
      api_key,
      api_key_scope,
      archived_at
    `)
    .eq('api_key', apiKey)
    .is('archived_at', null)
    .single();

  if (error || !project) {
    return { valid: false, error: 'API key not found or project archived' };
  }

  return {
    valid: true,
    projectId: project.id,
    teamId: project.team_id,
    scope: project.api_key_scope || APIKeyScope.READ_WRITE,
  };
}

/**
 * Middleware to validate API key and check scope
 */
export async function requireAPIKey(
  request: Request,
  requiredScope: APIKeyScope = APIKeyScope.READ_WRITE
): Promise<{ valid: true; projectId: string; teamId: string } | { valid: false; response: Response }> {
  const authHeader = request.headers.get('authorization');
  const apiKey = authHeader?.replace('Bearer ', '');

  if (!apiKey) {
    return {
      valid: false,
      response: new Response(
        JSON.stringify({ error: { code: 'MISSING_API_KEY', message: 'API key required' } }),
        { status: 401 }
      ),
    };
  }

  const validation = await validateAPIKey(apiKey);

  if (!validation.valid) {
    return {
      valid: false,
      response: new Response(
        JSON.stringify({ error: { code: 'INVALID_API_KEY', message: validation.error } }),
        { status: 401 }
      ),
    };
  }

  // Check scope
  const scopeHierarchy: Record<APIKeyScope, APIKeyScope[]> = {
    [APIKeyScope.READ_WRITE]: [APIKeyScope.READ_WRITE, APIKeyScope.READ_ONLY, APIKeyScope.CAPTURE_ONLY],
    [APIKeyScope.READ_ONLY]: [APIKeyScope.READ_ONLY],
    [APIKeyScope.CAPTURE_ONLY]: [APIKeyScope.CAPTURE_ONLY],
  };

  const allowedScopes = scopeHierarchy[validation.scope!];
  if (!allowedScopes.includes(requiredScope)) {
    return {
      valid: false,
      response: new Response(
        JSON.stringify({ error: { code: 'INSUFFICIENT_SCOPE', message: `Requires ${requiredScope} scope` } }),
        { status: 403 }
      ),
    };
  }

  return {
    valid: true,
    projectId: validation.projectId!,
    teamId: validation.teamId!,
  };
}
```

### Request Signing

```typescript
// lib/api/signing.ts

import { createHmac } from 'crypto';

/**
 * Request signing for sensitive operations
 *
 * Used for webhook verification and VS Code extension communication
 */

/**
 * Signs a request body with the project's API key
 */
export function signRequest(
  body: string,
  apiKey: string,
  timestamp: number
): string {
  const payload = `${timestamp}.${body}`;
  const hmac = createHmac('sha256', apiKey);
  hmac.update(payload);
  return hmac.digest('hex');
}

/**
 * Verifies a signed request
 */
export function verifyRequestSignature(
  body: string,
  signature: string,
  apiKey: string,
  timestamp: number,
  maxAgeSeconds: number = 300
): boolean {
  // Check timestamp freshness
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > maxAgeSeconds) {
    console.warn('[Signing] Request timestamp too old or in future');
    return false;
  }

  // Calculate expected signature
  const expectedSignature = signRequest(body, apiKey, timestamp);

  // Timing-safe comparison
  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Extracts signature from request headers
 */
export function extractSignature(
  request: Request
): { signature: string; timestamp: number } | null {
  const signatureHeader = request.headers.get('x-contextor-signature');
  const timestampHeader = request.headers.get('x-contextor-timestamp');

  if (!signatureHeader || !timestampHeader) {
    return null;
  }

  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp)) {
    return null;
  }

  return { signature: signatureHeader, timestamp };
}

/**
 * Middleware for signature verification
 */
export async function requireSignedRequest(
  request: Request,
  apiKey: string
): Promise<{ verified: true } | { verified: false; response: Response }> {
  const sig = extractSignature(request);

  if (!sig) {
    return {
      verified: false,
      response: new Response(
        JSON.stringify({ error: { code: 'MISSING_SIGNATURE', message: 'Request signature required' } }),
        { status: 401 }
      ),
    };
  }

  const body = await request.text();
  const verified = verifyRequestSignature(body, sig.signature, apiKey, sig.timestamp);

  if (!verified) {
    return {
      verified: false,
      response: new Response(
        JSON.stringify({ error: { code: 'INVALID_SIGNATURE', message: 'Request signature invalid' } }),
        { status: 401 }
      ),
    };
  }

  return { verified: true };
}
```

### CORS Configuration

```typescript
// lib/api/cors.ts

/**
 * CORS configuration for Phase 2
 *
 * Supports VS Code extension and CLI access
 */

const ALLOWED_ORIGINS = [
  // Production
  'https://contextor.co',
  'https://www.contextor.co',

  // VS Code extension (uses custom protocol)
  'vscode-webview://*',

  // Local development
  ...(process.env.NODE_ENV === 'development'
    ? ['http://127.0.0.1:3050', 'http://localhost:3050']
    : []
  ),
];

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];

const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Contextor-Signature',
  'X-Contextor-Timestamp',
  'X-Request-ID',
];

const EXPOSED_HEADERS = [
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'Retry-After',
];

/**
 * Generates CORS headers for a request
 */
export function getCORSHeaders(request: Request): Headers {
  const origin = request.headers.get('origin') || '';
  const headers = new Headers();

  // Check if origin is allowed
  const isAllowed = ALLOWED_ORIGINS.some(allowed => {
    if (allowed.includes('*')) {
      const pattern = new RegExp('^' + allowed.replace('*', '.*') + '$');
      return pattern.test(origin);
    }
    return allowed === origin;
  });

  if (isAllowed) {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
  headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
  headers.set('Access-Control-Expose-Headers', EXPOSED_HEADERS.join(', '));
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Max-Age', '86400'); // 24 hours

  return headers;
}

/**
 * Handles OPTIONS preflight requests
 */
export function handlePreflight(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCORSHeaders(request),
  });
}
```

---

## 9. Database Security & RLS Policies

### Complete RLS Policy SQL

```sql
-- Migration: 20251223300000_phase2_rls_policies.sql

-- ============================================
-- HELPER FUNCTIONS (extend existing)
-- ============================================

-- Check if user is team admin
CREATE OR REPLACE FUNCTION public.is_team_admin(p_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = auth.uid()
      AND team_id = p_team_id
      AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is team member
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = auth.uid()
      AND team_id = p_team_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- ANALYSIS CONFIGURATION TABLES (Super Admin Only)
-- ============================================

-- analysis_prompts: Super admin read/write only
ALTER TABLE analysis_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY analysis_prompts_super_admin_read ON analysis_prompts
  FOR SELECT USING (public.is_super_admin());

CREATE POLICY analysis_prompts_super_admin_write ON analysis_prompts
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- classification_rules: Super admin only
ALTER TABLE classification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY classification_rules_super_admin ON classification_rules
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- feedback_templates: Super admin only
ALTER TABLE feedback_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_templates_super_admin ON feedback_templates
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ab_experiments: Super admin only
ALTER TABLE ab_experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY ab_experiments_super_admin ON ab_experiments
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================
-- SCORING WEIGHTS (Global + Team Override)
-- ============================================

-- scoring_weights: Super admin for global, team admin for team-level
ALTER TABLE scoring_weights ENABLE ROW LEVEL SECURITY;

-- Super admin can manage all
CREATE POLICY scoring_weights_super_admin ON scoring_weights
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Team admin can read global weights
CREATE POLICY scoring_weights_team_read_global ON scoring_weights
  FOR SELECT USING (
    team_id IS NULL  -- Global weights
    AND EXISTS (
      SELECT 1 FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- Team admin can manage their team's weights
CREATE POLICY scoring_weights_team_admin ON scoring_weights
  FOR ALL USING (
    team_id IS NOT NULL
    AND public.is_team_admin(team_id)
  )
  WITH CHECK (
    team_id IS NOT NULL
    AND public.is_team_admin(team_id)
  );

-- ============================================
-- USER ANALYTICS (User owns, team admin can view team)
-- ============================================

-- user_daily_analytics: User owns their data
ALTER TABLE user_daily_analytics ENABLE ROW LEVEL SECURITY;

-- Users can view their own analytics
CREATE POLICY user_analytics_own ON user_daily_analytics
  FOR SELECT USING (user_id = auth.uid());

-- Team admins can view team members' analytics
CREATE POLICY user_analytics_team_admin ON user_daily_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm1
      JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid()
        AND tm1.role = 'admin'
        AND tm2.user_id = user_daily_analytics.user_id
    )
  );

-- Super admin can view all
CREATE POLICY user_analytics_super_admin ON user_daily_analytics
  FOR SELECT USING (public.is_super_admin());

-- System can insert (via service role)
-- Insert done via service role client which bypasses RLS

-- ============================================
-- TEAM ANALYTICS (Team admin only)
-- ============================================

ALTER TABLE team_daily_analytics ENABLE ROW LEVEL SECURITY;

-- Team admins can view their team's analytics
CREATE POLICY team_analytics_admin ON team_daily_analytics
  FOR SELECT USING (public.is_team_admin(team_id));

-- Super admin can view all
CREATE POLICY team_analytics_super_admin ON team_daily_analytics
  FOR SELECT USING (public.is_super_admin());

-- ============================================
-- CONFIG AUDIT LOG (Super admin only)
-- ============================================

ALTER TABLE config_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY config_audit_super_admin ON config_audit_log
  FOR SELECT USING (public.is_super_admin());

-- Insert done via service role

-- ============================================
-- SESSIONS TABLE
-- ============================================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY sessions_own ON sessions
  FOR SELECT USING (user_id = auth.uid());

-- Team members can view sessions in their team
CREATE POLICY sessions_team ON sessions
  FOR SELECT USING (public.is_team_member(team_id));

-- Super admin can view all
CREATE POLICY sessions_super_admin ON sessions
  FOR SELECT USING (public.is_super_admin());

-- Users can insert their own sessions
CREATE POLICY sessions_insert ON sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own sessions
CREATE POLICY sessions_update ON sessions
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- PROMPT RESPONSES TABLE
-- ============================================

ALTER TABLE prompt_responses ENABLE ROW LEVEL SECURITY;

-- Access via prompts table relationship
CREATE POLICY responses_via_prompts ON prompt_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM prompts p
      WHERE p.id = prompt_responses.prompt_id
        AND (
          p.user_id = auth.uid()
          OR public.is_team_member(p.team_id)
          OR public.is_super_admin()
        )
    )
  );

-- Insert via service role only

-- ============================================
-- PRIVACY PREFERENCES
-- ============================================

ALTER TABLE privacy_preferences ENABLE ROW LEVEL SECURITY;

-- Users can manage their own preferences
CREATE POLICY privacy_own ON privacy_preferences
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Super admin can view all (for compliance)
CREATE POLICY privacy_super_admin_read ON privacy_preferences
  FOR SELECT USING (public.is_super_admin());

-- ============================================
-- DATA RETENTION SETTINGS
-- ============================================

ALTER TABLE data_retention_settings ENABLE ROW LEVEL SECURITY;

-- Users can manage their own retention settings
CREATE POLICY retention_own ON data_retention_settings
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- DELETION REQUESTS
-- ============================================

ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;

-- Users can view and create their own deletion requests
CREATE POLICY deletion_own ON deletion_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY deletion_insert ON deletion_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Super admin can view all
CREATE POLICY deletion_super_admin ON deletion_requests
  FOR SELECT USING (public.is_super_admin());

-- ============================================
-- HISTORICAL IMPORTS
-- ============================================

ALTER TABLE historical_imports ENABLE ROW LEVEL SECURITY;

-- Users can manage their own imports
CREATE POLICY imports_own ON historical_imports
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- PROMPT IMPROVEMENTS (Coaching)
-- ============================================

ALTER TABLE prompt_improvements ENABLE ROW LEVEL SECURITY;

-- Users can manage their own improvement data
CREATE POLICY improvements_own ON prompt_improvements
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Super admin can view for analysis
CREATE POLICY improvements_super_admin ON prompt_improvements
  FOR SELECT USING (public.is_super_admin());

-- ============================================
-- ENCRYPTION KEYS (Super admin only)
-- ============================================

ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY encryption_keys_super_admin ON encryption_keys
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================
-- AUDIT LOGS (Comprehensive)
-- ============================================

-- (Already defined in audit section)
-- Super admin: all logs
-- Team admin: team logs
-- User: own activity logs
```

---

## 10. Incident Response

### Anomaly Detection

```typescript
// lib/security/anomaly-detection.ts

/**
 * Anomaly detection for security monitoring
 */

export interface AnomalyAlert {
  id: string;
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, unknown>;
  detectedAt: string;
  resolved: boolean;
}

export type AnomalyType =
  | 'excessive_data_access'
  | 'unusual_export_pattern'
  | 'brute_force_attempt'
  | 'cross_tenant_attempt'
  | 'admin_abuse'
  | 'api_key_abuse'
  | 'unusual_time_access';

/**
 * Thresholds for anomaly detection
 */
const ANOMALY_THRESHOLDS = {
  // Data access
  maxPromptsPerHour: 1000,
  maxExportsPerDay: 5,
  maxBulkOperationsPerHour: 10,

  // Authentication
  maxFailedLoginsPerHour: 10,
  maxPasswordResetsPerDay: 3,

  // API usage
  maxApiCallsPerMinute: 500,
  maxErrorRatePercent: 10,

  // Admin operations
  maxAdminActionsPerHour: 50,
  maxUserDisablesPerDay: 10,
};

/**
 * Checks for data access anomalies
 */
export async function checkDataAccessAnomalies(
  userId: string
): Promise<AnomalyAlert | null> {
  const supabase = createAdminClient();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Count data access events
  const { count } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('actor_id', userId)
    .eq('action_category', 'data_access')
    .gte('timestamp', hourAgo.toISOString());

  if (count && count > ANOMALY_THRESHOLDS.maxPromptsPerHour) {
    return {
      id: crypto.randomUUID(),
      type: 'excessive_data_access',
      severity: count > ANOMALY_THRESHOLDS.maxPromptsPerHour * 2 ? 'high' : 'medium',
      details: {
        userId,
        accessCount: count,
        threshold: ANOMALY_THRESHOLDS.maxPromptsPerHour,
        period: '1 hour',
      },
      detectedAt: new Date().toISOString(),
      resolved: false,
    };
  }

  return null;
}

/**
 * Checks for brute force attempts
 */
export async function checkBruteForceAttempts(
  ipAddress: string
): Promise<AnomalyAlert | null> {
  const supabase = createAdminClient();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const { count } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('actor_ip', ipAddress)
    .eq('action', 'auth.login')
    .eq('result', 'failure')
    .gte('timestamp', hourAgo.toISOString());

  if (count && count > ANOMALY_THRESHOLDS.maxFailedLoginsPerHour) {
    return {
      id: crypto.randomUUID(),
      type: 'brute_force_attempt',
      severity: 'critical',
      details: {
        ipAddress,
        failedAttempts: count,
        threshold: ANOMALY_THRESHOLDS.maxFailedLoginsPerHour,
        period: '1 hour',
      },
      detectedAt: new Date().toISOString(),
      resolved: false,
    };
  }

  return null;
}

/**
 * Checks for admin abuse patterns
 */
export async function checkAdminAbuse(
  adminId: string
): Promise<AnomalyAlert | null> {
  const supabase = createAdminClient();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const { count } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('actor_id', adminId)
    .eq('actor_type', 'super_admin')
    .gte('timestamp', hourAgo.toISOString());

  if (count && count > ANOMALY_THRESHOLDS.maxAdminActionsPerHour) {
    return {
      id: crypto.randomUUID(),
      type: 'admin_abuse',
      severity: 'high',
      details: {
        adminId,
        actionCount: count,
        threshold: ANOMALY_THRESHOLDS.maxAdminActionsPerHour,
        period: '1 hour',
      },
      detectedAt: new Date().toISOString(),
      resolved: false,
    };
  }

  return null;
}

/**
 * Automatic lockout after excessive failed attempts
 */
export async function enforceAutomaticLockout(
  identifier: string,
  type: 'ip' | 'user'
): Promise<boolean> {
  const supabase = createAdminClient();

  if (type === 'user') {
    // Disable user account
    await supabase
      .from('users')
      .update({ is_disabled: true })
      .eq('id', identifier);

    // Log the lockout
    await logAuditEvent({
      actorId: identifier,
      actorType: 'system',
      action: 'user.disable',
      actionCategory: 'user_management',
      resourceType: 'user',
      resourceId: identifier,
      metadata: { reason: 'automatic_lockout', trigger: 'brute_force_detection' },
    });

    return true;
  }

  // For IP-based lockouts, we use rate limiting
  // The IP will naturally be blocked by rate limits
  return false;
}
```

### Breach Notification Workflow

```typescript
// lib/security/breach-notification.ts

/**
 * Data breach notification workflow
 * GDPR requires notification within 72 hours
 */

export interface BreachIncident {
  id: string;
  detectedAt: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedUsers: string[];
  affectedData: string[];
  containmentStatus: 'detected' | 'contained' | 'resolved';
  notificationStatus: 'pending' | 'sent' | 'not_required';
  timeline: BreachTimelineEvent[];
}

export interface BreachTimelineEvent {
  timestamp: string;
  action: string;
  actor: string;
  details: string;
}

/**
 * Creates a new breach incident
 */
export async function createBreachIncident(
  details: Omit<BreachIncident, 'id' | 'timeline' | 'containmentStatus' | 'notificationStatus'>
): Promise<BreachIncident> {
  const incident: BreachIncident = {
    ...details,
    id: crypto.randomUUID(),
    containmentStatus: 'detected',
    notificationStatus: 'pending',
    timeline: [{
      timestamp: new Date().toISOString(),
      action: 'Incident detected',
      actor: 'system',
      details: details.description,
    }],
  };

  // Store in database
  const supabase = createAdminClient();
  await supabase.from('breach_incidents').insert(incident);

  // Immediately notify super admins
  await notifySuperAdmins(incident);

  // For critical breaches, start 72-hour countdown
  if (incident.severity === 'critical' || incident.severity === 'high') {
    await scheduleGDPRNotification(incident);
  }

  return incident;
}

/**
 * Notifies all super admins of a breach
 */
async function notifySuperAdmins(incident: BreachIncident): Promise<void> {
  const supabase = createAdminClient();

  // Get all super admins
  const { data: admins } = await supabase
    .from('users')
    .select('id, email')
    .eq('is_super_admin', true);

  if (!admins?.length) return;

  // Send email notification (implementation depends on email service)
  for (const admin of admins) {
    await sendBreachNotificationEmail(admin.email, incident);
  }

  // Create audit log
  await logAuditEvent({
    actorId: 'system',
    actorType: 'system',
    action: 'system.breach_detected',
    actionCategory: 'system',
    metadata: { incidentId: incident.id, severity: incident.severity },
  });
}

/**
 * Schedules GDPR notification if required
 */
async function scheduleGDPRNotification(incident: BreachIncident): Promise<void> {
  // GDPR requires notification within 72 hours if breach affects personal data
  const notificationDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000);

  // Store deadline
  const supabase = createAdminClient();
  await supabase
    .from('breach_incidents')
    .update({
      gdpr_notification_deadline: notificationDeadline.toISOString(),
    })
    .eq('id', incident.id);

  // Schedule reminder at 48 hours if not resolved
  // This would typically use a job queue like BullMQ or Supabase Edge Functions
}

/**
 * Updates breach incident status
 */
export async function updateBreachStatus(
  incidentId: string,
  update: {
    containmentStatus?: BreachIncident['containmentStatus'];
    notificationStatus?: BreachIncident['notificationStatus'];
    action: string;
    actor: string;
    details: string;
  }
): Promise<void> {
  const supabase = createAdminClient();

  // Get current incident
  const { data: incident } = await supabase
    .from('breach_incidents')
    .select('*')
    .eq('id', incidentId)
    .single();

  if (!incident) throw new Error('Incident not found');

  // Add timeline event
  const timeline = incident.timeline as BreachTimelineEvent[];
  timeline.push({
    timestamp: new Date().toISOString(),
    action: update.action,
    actor: update.actor,
    details: update.details,
  });

  // Update incident
  await supabase
    .from('breach_incidents')
    .update({
      containment_status: update.containmentStatus || incident.containment_status,
      notification_status: update.notificationStatus || incident.notification_status,
      timeline,
    })
    .eq('id', incidentId);
}

/**
 * Generates affected user notification
 */
export async function generateUserNotification(
  incident: BreachIncident,
  userId: string
): Promise<{
  subject: string;
  body: string;
}> {
  return {
    subject: 'Important Security Notice from Contextor',
    body: `
Dear User,

We are writing to inform you of a security incident that may have affected your data.

**What Happened:**
${incident.description}

**What Information Was Involved:**
${incident.affectedData.join(', ')}

**What We Are Doing:**
Our security team has taken immediate action to contain this incident and prevent future occurrences.

**What You Can Do:**
- Review your recent activity in Contextor
- Consider updating your password
- Monitor your accounts for suspicious activity

**Contact Us:**
If you have any questions, please contact our security team at security@contextor.co

We sincerely apologize for any inconvenience this may cause.

The Contextor Security Team
    `.trim(),
  };
}
```

---

## Implementation Checklist

### Phase 2 Security Implementation Order

#### Sprint 1: Foundation (Epic 14.5)
- [ ] Enhanced redaction patterns
- [ ] Granular consent UI
- [ ] Privacy preferences table and RLS
- [ ] Basic audit logging extension

#### Sprint 2: Data Protection
- [ ] Key rotation infrastructure
- [ ] Column encryption for responses
- [ ] Retention settings UI
- [ ] Soft delete implementation

#### Sprint 3: Access Control
- [ ] Team admin permission model
- [ ] API key scoping
- [ ] Rate limiting extension
- [ ] Admin guards for all new endpoints

#### Sprint 4: Configuration Security
- [ ] Template sanitization
- [ ] ReDoS validation
- [ ] Configuration signing
- [ ] Size limit enforcement

#### Sprint 5: Audit & Compliance
- [ ] Comprehensive audit logging
- [ ] GDPR export implementation
- [ ] Deletion request workflow
- [ ] Audit query UI for admins

#### Sprint 6: Monitoring & Response
- [ ] Anomaly detection rules
- [ ] Automatic lockout
- [ ] Breach notification workflow
- [ ] Security dashboard for super admins

### Security Review Gates

Before each Phase 2 epic deployment:
1. [ ] All new tables have RLS policies
2. [ ] All new endpoints have rate limiting
3. [ ] All admin operations are audited
4. [ ] Input validation covers edge cases
5. [ ] Error messages don't leak sensitive info
6. [ ] E2E tests cover security scenarios

---

**Document Status:** READY FOR IMPLEMENTATION
**Author:** Security Architecture Team
**Date:** 2025-12-23
**Version:** 1.0
