# Story 23-5: Register Project Flow

Status: Completed

## Story

**As a** VS Code extension user,
**I want** to register my project with Contextor directly from the extension,
**So that** I can start capturing prompts without leaving my IDE.

## Acceptance Criteria

1. **Given** Contextor is not installed in my workspace
   **When** I click "Register Project" button
   **Then** I see a Quick Pick list of my teams

2. **Given** I have multiple teams
   **When** the team picker appears
   **Then** I see all my teams listed with role indicators (Admin/Member)

3. **Given** I don't have a suitable team
   **When** I see the team picker
   **Then** I can select "Create New Team..." which opens the web app

4. **Given** I have no teams
   **When** I click "Register Project"
   **Then** I see a message directing me to create a team in the web app

5. **Given** I select a team
   **When** the project name input appears
   **Then** I can enter a name or accept the default (workspace folder name)

6. **Given** I complete the registration flow
   **When** the API returns success
   **Then** I see a success message with the project name
   **And** the workspace status is refreshed

## Dependencies

- **Story 23-4**: Workspace Installation Detection
- **Story 19-2**: OAuth Authentication Flow

## Technical Notes

- Uses vscode.window.showQuickPick for team selection
- Uses vscode.window.showInputBox for project name
- API endpoint: POST /api/extension/register-project
- Opens web app in browser for team creation

## Implementation

**Files Created/Modified:**
- `src/services/api.ts` - Added `getMyTeams()` and updated `registerProject()` with teamId
- `src/providers/analyticsPanel.ts` - Added `handleRegisterProject()` with team selection flow
- `app/app/api/extension/register-project/route.ts` - New API endpoint

**Key Implementation Details:**
```typescript
interface TeamInfo {
  id: string;
  name: string;
  role: string;
}

// Team selection flow
const teams = await api.getMyTeams();
const teamItems = teams.map(t => ({
  label: t.name,
  description: t.role === "admin" ? "Admin" : "Member",
  teamId: t.id
}));
teamItems.push({
  label: "$(add) Create New Team...",
  description: "Open web app to create a new team",
  teamId: "__create_new__"
});
const selected = await vscode.window.showQuickPick(teamItems);
```

## Tasks / Subtasks

- [x] **Task 1: Add getMyTeams API method**
  - [x] Add TeamInfo interface
  - [x] Implement getMyTeams() in api.ts
  - [x] Use /teams endpoint with authenticated fetch

- [x] **Task 2: Update registerProject with teamId**
  - [x] Add optional teamId parameter
  - [x] Pass teamId in request body
  - [x] Update API endpoint to accept teamId

- [x] **Task 3: Create API endpoint**
  - [x] Create /api/extension/register-project route
  - [x] Validate request with zod schema
  - [x] Use provided teamId or fall back to session team
  - [x] Create project and generate API key

- [x] **Task 4: Implement team selection UI**
  - [x] Fetch teams on Register Project click
  - [x] Create QuickPickItem array with team info
  - [x] Add "Create New Team" option
  - [x] Handle selection and proceed to project name input

- [x] **Task 5: Handle edge cases**
  - [x] No teams - show info message with web link
  - [x] Create New Team - open web app in browser
  - [x] User cancellation at any step

## Dev Estimate

4 hours (Completed)
