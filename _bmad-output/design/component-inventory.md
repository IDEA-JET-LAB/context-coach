# Component Inventory

**Date:** 2025-12-23
**Total Components:** 101

---

## UI Primitives (shadcn/ui)

**Location:** `app/components/ui/`
**Count:** 27

| Component | File | Type | Accessibility |
|-----------|------|------|---------------|
| Alert | `alert.tsx` | Standard | Good |
| AlertDialog | `alert-dialog.tsx` | Standard | Good |
| Avatar | `avatar.tsx` | Standard | Good |
| Badge | `badge.tsx` | Standard | Good |
| Breadcrumb | `breadcrumb.tsx` | Standard | Good (5 ARIA) |
| Button | `button.tsx` | Standard | Good (focus states) |
| Card | `card.tsx` | Standard | Good |
| Checkbox | `checkbox.tsx` | Standard | Good (focus states) |
| Dialog | `dialog.tsx` | Standard | Good |
| DropdownMenu | `dropdown-menu.tsx` | Standard | Good |
| EmptyState | `empty-state.tsx` | Custom | Needs improvement |
| Form | `form.tsx` | Standard | Good |
| Input | `input.tsx` | Standard | Good (focus states) |
| Label | `label.tsx` | Standard | Good |
| Popover | `popover.tsx` | Standard | Good |
| Progress | `progress.tsx` | Standard | Good |
| Select | `select.tsx` | Standard | Good (focus states) |
| Separator | `separator.tsx` | Standard | Good |
| Sheet | `sheet.tsx` | Standard | Good |
| Skeleton | `skeleton.tsx` | Standard | Good |
| Slider | `slider.tsx` | Standard | Good (focus states) |
| Sonner | `sonner.tsx` | Standard | Good |
| Switch | `switch.tsx` | Standard | Good (focus states) |
| Table | `table.tsx` | Standard | Good (2 ARIA) |
| Tabs | `tabs.tsx` | Standard | Good (focus states) |
| Textarea | `textarea.tsx` | Standard | Good (focus states) |
| Tooltip | `tooltip.tsx` | Standard | Good |

---

## Dashboard Components

**Location:** `app/components/dashboard/`
**Count:** 4

| Component | File | Purpose | Hardcoded Colors |
|-----------|------|---------|------------------|
| Header | `header.tsx` | Top navigation bar | 3 |
| Sidebar | `sidebar.tsx` | Icon-only navigation | 7 |
| StatCard | `stat-card.tsx` | Metric display card | 5 |

---

## Feed Components

**Location:** `app/components/feed/`
**Count:** 15

| Component | File | Purpose | Hardcoded Colors |
|-----------|------|---------|------------------|
| ActiveFilters | `active-filters.tsx` | Filter chips display | 2 |
| AnalysisFailed | `analysis-failed.tsx` | Error state | 1 |
| AnalyzingState | `analyzing-state.tsx` | Loading state | 0 |
| ComparisonIndicator | `comparison-indicator.tsx` | Score trend arrow | 0 |
| EmptyFeed | `empty-feed.tsx` | No prompts state | 0 |
| EmptyPromptFeed | `empty-prompt-feed.tsx` | Empty state | 4 |
| FilterBar | `filter-bar.tsx` | Filter controls | 2 |
| FilteredEmptyState | `filtered-empty-state.tsx` | Filtered empty | 1 |
| PromptFeed | `prompt-feed.tsx` | Main feed container | 0 |
| PromptFeedSkeleton | `prompt-feed-skeleton.tsx` | Loading skeleton | 4 |
| PromptRow | `prompt-row.tsx` | Individual prompt | 5 |
| ScoreBadge | `score-badge.tsx` | Score circle | 2 |
| ScoreComparison | `score-comparison.tsx` | Score vs team | 1 |
| TeamAverageBadge | `team-average-badge.tsx` | Team avg display | 0 |

### Filter Components (`feed/filters/`)

| Component | File | Hardcoded Colors |
|-----------|------|------------------|
| DateFilter | `date-filter.tsx` | 2 |
| ProjectFilter | `project-filter.tsx` | 2 |
| ScoreFilter | `score-filter.tsx` | 3 |
| UserFilter | `user-filter.tsx` | 2 |

---

## Analytics Components

**Location:** `app/components/analytics/`
**Count:** 12

| Component | File | Purpose | Hardcoded Colors |
|-----------|------|---------|------------------|
| AnalyticsDashboard | `analytics-dashboard.tsx` | Main dashboard | 11 |
| AnalyticsEmptyState | `analytics-empty-state.tsx` | No data state | 2 |
| DimensionBreakdown | `dimension-breakdown.tsx` | 5-dimension bars | 3 |
| EmptyAnalytics | `empty-analytics.tsx` | Empty state | 0 |
| MemberBreakdown | `member-breakdown.tsx` | Per-member stats | 9 |
| MemberDetail | `member-detail.tsx` | Member detail view | 13 |
| MemberDimensionBreakdown | `member-dimension-breakdown.tsx` | Member dimensions | 1 |
| ScoreTrendChart | `score-trend-chart.tsx` | Line chart | 6 |
| SummaryStats | `summary-stats.tsx` | Summary cards | 0 |
| TeamAdminAnalytics | `team-admin-analytics.tsx` | Admin view | 18 |
| TeamSummary | `team-summary.tsx` | Team overview | 13 |
| TeamTrendChart | `team-trend-chart.tsx` | Team line chart | 10 |
| TimeRangeSelector | `time-range-selector.tsx` | Date range picker | 2 |

---

## Admin Components

**Location:** `app/components/admin/`
**Count:** 18

| Component | File | Purpose | Hardcoded Colors |
|-----------|------|---------|------------------|
| AdminSidebar | `admin-sidebar.tsx` | Admin navigation | 4 |
| AnalysisConfigForm | `analysis-config-form.tsx` | Config editor | 5 |
| AnalysisQueueStatus | `analysis-queue-status.tsx` | Queue status | 2 |
| ConfigDetailView | `config-detail-view.tsx` | Config details | 9 |
| ConfigVersionCard | `config-version-card.tsx` | Version card | 1 |
| DashboardContent | `dashboard-content.tsx` | Admin dashboard | 4 |
| DeadLetterQueue | `dead-letter-queue.tsx` | Failed jobs | 3 |
| DimensionEditor | `dimension-editor.tsx` | Dimension config | 7 |
| HealthIndicator | `health-indicator.tsx` | Health status | 3 |
| RealTimeStats | `real-time-stats.tsx` | Live metrics | 0 |
| StatCard | `stat-card.tsx` | Admin stat card | 3 |
| SystemMetricCard | `system-metric-card.tsx` | System metrics | 1 |
| TeamActivitySummary | `team-activity-summary.tsx` | Activity summary | 2 |
| TeamMembersList | `team-members-list.tsx` | Team members | 2 |
| TeamProjectsList | `team-projects-list.tsx` | Team projects | 3 |
| TeamSettingsReadonly | `team-settings-readonly.tsx` | Settings view | 1 |
| TeamsTable | `teams-table.tsx` | Teams list | 9 |
| UserActions | `user-actions.tsx` | User actions | 1 |
| UserTable | `user-table.tsx` | Users list | 3 |
| UsersPagination | `users-pagination.tsx` | Pagination | 1 |
| UsersFilters | `users-filters.tsx` | User filters | 2 |

---

## Onboarding Components

**Location:** `app/components/onboarding/`
**Count:** 9

| Component | File | Purpose | Hardcoded Colors |
|-----------|------|---------|------------------|
| CelebrationMessage | `celebration-message.tsx` | Success state | 0 |
| CliInstructions | `cli-instructions.tsx` | CLI setup guide | 4 |
| CreateFirstTeam | `create-first-team.tsx` | Team creation | 0 |
| InstallCliModal | `install-cli-modal.tsx` | CLI modal | 3 |
| OnboardingChecklist | `onboarding-checklist.tsx` | Progress checklist | 2 |
| OnboardingChecklistSkeleton | `onboarding-checklist-skeleton.tsx` | Loading state | 8 |
| OnboardingChecklistWrapper | `onboarding-checklist-wrapper.tsx` | Wrapper | 0 |
| ProgressIndicator | `progress-indicator.tsx` | Progress bar | 1 |
| StepItem | `step-item.tsx` | Checklist item | 2 |

---

## Prompt Detail Components

**Location:** `app/components/prompt-detail/`
**Count:** 4

| Component | File | Purpose | Hardcoded Colors |
|-----------|------|---------|------------------|
| DimensionBar | `dimension-bar.tsx` | Score bar | 1 |
| DimensionCard | `dimension-card.tsx` | Dimension details | 2 |
| PromptDetailSkeleton | `prompt-detail-skeleton.tsx` | Loading state | 2 |
| PromptDetailView | `prompt-detail-view.tsx` | Full detail view | 3 |

---

## Project Components

**Location:** `app/components/projects/`
**Count:** 7

| Component | File | Purpose | Hardcoded Colors |
|-----------|------|---------|------------------|
| ArchiveProjectDialog | `archive-project-dialog.tsx` | Archive confirm | 0 |
| EmptyProjects | `empty-projects.tsx` | No projects state | 0 |
| NewProjectForm | `new-project-form.tsx` | Project creation | 0 |
| ProjectCard | `project-card.tsx` | Project display | 0 |
| ProjectSettingsForm | `project-settings-form.tsx` | Project settings | 0 |
| ProjectSuccessContent | `project-success-content.tsx` | Success state | 0 |
| ProjectsList | `projects-list.tsx` | Project list | 0 |
| RegenerateKeyDialog | `regenerate-key-dialog.tsx` | API key regenerate | 0 |

---

## Team Components

**Location:** `app/components/team/`
**Count:** 5

| Component | File | Purpose | Hardcoded Colors |
|-----------|------|---------|------------------|
| CreateTeamForm | `create-team-form.tsx` | Team creation | 0 |
| EmptyTeam | `empty-team.tsx` | No team state | 0 |
| LeaveTeamDialog | `leave-team-dialog.tsx` | Leave confirm | 0 |
| TeamMembersList | `team-members-list.tsx` | Member list | 0 |
| TeamSettingsForm | `team-settings-form.tsx` | Team settings | 0 |

---

## Marketing Components

**Location:** `app/components/marketing/`
**Count:** 4

| Component | File | Purpose | Hardcoded Colors |
|-----------|------|---------|------------------|
| Features | `features.tsx` | Feature section | 9 |
| Footer | `footer.tsx` | Page footer | 1 |
| Hero | `hero.tsx` | Hero section | 7 |
| Navbar | `navbar.tsx` | Marketing nav | 6 |

---

## Other Components

| Component | Location | Purpose |
|-----------|----------|---------|
| AuthButton | `components/` | Auth actions |
| AuthErrorToast | `components/auth/` | Error display |
| DeployButton | `components/` | Deploy CTA |
| EnvVarWarning | `components/` | Dev warning |
| Hero | `components/` | Landing hero |
| LogoutButton | `components/` | Logout action |
| NextLogo | `components/` | Logo display |
| SupabaseLogo | `components/` | Logo display |
| ThemeSwitcher | `components/` | Theme toggle |
| QueryProvider | `components/providers/` | React Query |
| TeamSwitcher | `components/layout/` | Team dropdown |
| ProfileForm | `components/settings/` | Profile editor |
| InviteMemberForm | `components/team-settings/` | Invite form |
| PendingInvitationsList | `components/team-settings/` | Pending list |
| AccessDeniedHandler | `components/auth/` | Access denied |

---

## Summary by Hardcoding Severity

### High Hardcoding (5+ instances)

- `analytics/team-admin-analytics.tsx` (18)
- `analytics/team-summary.tsx` (13)
- `analytics/member-detail.tsx` (13)
- `analytics/analytics-dashboard.tsx` (11)
- `analytics/team-trend-chart.tsx` (10)
- `admin/teams-table.tsx` (9)
- `admin/config-detail-view.tsx` (9)
- `analytics/member-breakdown.tsx` (9)
- `marketing/features.tsx` (9)
- `onboarding/onboarding-checklist-skeleton.tsx` (8)
- `dashboard/sidebar.tsx` (7)
- `admin/dimension-editor.tsx` (7)
- `marketing/hero.tsx` (7)

### Medium Hardcoding (3-4 instances)

- `analytics/score-trend-chart.tsx` (6)
- `dashboard/stat-card.tsx` (5)
- `feed/prompt-row.tsx` (5)
- `admin/analysis-config-form.tsx` (5)
- `marketing/navbar.tsx` (6)

### Low Hardcoding (1-2 instances)

- Most remaining components

---

*Generated as part of Story D-1: Design System Audit*
