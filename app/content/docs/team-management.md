# Team Management

Teams are the foundation of Contextor. They allow you to organize members, share insights, and track collective improvement. This guide covers creating teams, managing members, and configuring team settings.

## Creating a Team

### During Onboarding

When you first sign up, the onboarding flow guides you through creating your first team:

1. After verifying your email, you will see the "Create Your Team" screen
2. Enter a team name (e.g., "Engineering Team" or your company name)
3. Click **Create Team**

### Creating Additional Teams

You can create additional teams from the team switcher:

1. Click your current team name in the top navigation
2. Select **Create New Team** from the dropdown
3. Enter the new team name
4. Click **Create Team**

You will automatically become the admin of any team you create.

## Inviting Team Members

Team admins can invite new members via email.

### Sending Invitations

1. Navigate to **Team Settings** (gear icon in top navigation)
2. Click the **Members** tab
3. Enter the email address of the person you want to invite
4. Select a role: **Admin** or **Member**
5. Click **Send Invitation**

The invitee will receive an email with a link to join your team.

### Invitation Status

Pending invitations appear in the Members list with a "Pending" badge. You can:

- **Resend** - Send another invitation email
- **Revoke** - Cancel the invitation before it is accepted

### Invitation Expiry

Invitations expire after 7 days. If an invitation expires, you can send a new one.

## Roles and Permissions

Contextor has two team roles with different permissions:

| Permission | Admin | Member |
|------------|:-----:|:------:|
| View team prompts and analytics | Yes | Yes |
| Create and manage projects | Yes | Yes |
| View personal analytics | Yes | Yes |
| Install CLI and capture prompts | Yes | Yes |
| Invite new members | Yes | No |
| Remove members | Yes | No |
| Change member roles | Yes | No |
| Modify team settings | Yes | No |
| Delete team | Yes | No |

### Changing a Member's Role

Only admins can change roles:

1. Go to **Team Settings** > **Members**
2. Find the member in the list
3. Click the role dropdown next to their name
4. Select the new role

**Note:** There must always be at least one admin. You cannot demote yourself if you are the only admin.

### Removing a Member

1. Go to **Team Settings** > **Members**
2. Find the member in the list
3. Click the **Remove** button (trash icon)
4. Confirm the removal

Removed members lose access to team prompts and analytics immediately. Their historical prompts remain in the team's data.

## Switching Between Teams

If you belong to multiple teams, you can switch between them:

1. Click your current team name in the top navigation
2. Select a different team from the dropdown

The dashboard, projects, and analytics will update to show data for the selected team.

## Team Settings

Access team settings by clicking the gear icon in the top navigation while a team is selected.

### General Settings

- **Team Name** - Update your team's display name
- **Team Slug** - URL-friendly identifier (auto-generated, cannot be changed)

### Danger Zone

- **Delete Team** - Permanently delete the team and all associated data (projects, prompts, analytics)

**Warning:** Deleting a team is irreversible. All prompts and analytics will be permanently lost.

## Projects Within Teams

Each team can have multiple projects to organize prompts by codebase, initiative, or workflow.

### Project Hierarchy

```
Team: Engineering Team
├── Project: Backend API
│   └── Prompts from backend developers
├── Project: Mobile App
│   └── Prompts from mobile developers
└── Project: Infrastructure
    └── Prompts from DevOps team
```

### Creating a Project

1. From the dashboard, click **New Project** in the sidebar
2. Enter a project name
3. Optionally add a description
4. Click **Create Project**

### Project Settings

Each project has its own settings, including:

- **Name and Description** - Update project metadata
- **Installation** - Get install tokens for team members
- **API Key** - Regenerate the project API key if compromised
- **Archive** - Archive inactive projects (can be restored)

See the [CLI Installation](/docs/cli-installation) guide for details on project installation tokens.

## Team Analytics

Team admins and members can view aggregated analytics:

### Team Overview

- **Total Prompts** - Count of all prompts captured by team members
- **Average Score** - Team-wide average across all dimensions
- **Active Members** - How many members have captured prompts recently

### Member Comparison

- View individual member statistics
- Identify who is prompting frequently
- See score trends by member (anonymized if configured)

### Dimension Insights

- Which dimensions score lowest across the team?
- Use this to identify team-wide training opportunities

## Best Practices

### Team Structure

- **Small teams (2-5 people):** One team is usually sufficient
- **Medium teams (6-20 people):** Consider separate teams for distinct groups (e.g., frontend/backend)
- **Large organizations:** Use teams to mirror your organizational structure

### Project Organization

- Create separate projects for distinct codebases
- Use projects to track prompts for specific initiatives
- Archive completed projects to keep the dashboard clean

### Role Assignment

- Keep the number of admins small (1-3 per team)
- Admins should be team leads or managers
- Members can still create projects and view all team data

## Leaving a Team

To leave a team you are a member of:

1. Go to **Team Settings** > **Members**
2. Find your own entry in the list
3. Click **Leave Team**
4. Confirm that you want to leave

**Note:** Admins cannot leave if they are the only admin. Either promote another member to admin first, or delete the team.

## Next Steps

- **[CLI Installation](/docs/cli-installation)** - Set up prompt capture for your team
- **[Understanding Scores](/docs/understanding-scores)** - Learn how prompts are analyzed
- **[FAQ](/docs/faq)** - Common team management questions
