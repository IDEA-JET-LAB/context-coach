import { Page, expect } from '@playwright/test';

const MAILPIT_API = 'http://127.0.0.1:54324/api/v1';

export async function createTestUser(page: Page, email: string, password: string) {
  // Navigate to signup
  await page.goto('/signup');

  // Wait for form to be ready
  await page.waitForLoadState('networkidle');

  // Fill form fields with explicit waits to avoid race conditions
  const emailField = page.getByLabel('Email');
  await emailField.waitFor({ state: 'visible' });
  await emailField.fill(email);

  const passwordField = page.getByLabel('Password', { exact: true });
  await passwordField.waitFor({ state: 'visible' });
  await passwordField.fill(password);

  const confirmPasswordField = page.getByLabel('Confirm Password');
  await confirmPasswordField.waitFor({ state: 'visible' });
  await confirmPasswordField.fill(password);

  await page.getByRole('button', { name: 'Create account' }).click();

  // Wait for redirect - could be dashboard (if auto-confirmed) or verify-email
  await page.waitForURL(url =>
    url.pathname === '/' || url.pathname === '/home' || url.pathname.includes('/verify-email'),
    { timeout: 30000 }
  );

  // If redirected to verify-email, complete email verification
  if (page.url().includes('/verify-email')) {
    const verificationLink = await getVerificationLink(email);
    if (verificationLink) {
      await page.goto(verificationLink);
      await page.waitForURL(url => url.pathname === '/' || url.pathname === '/home', { timeout: 15000 });
    } else {
      // Fallback: email confirmation disabled but old code still redirected
      await page.goto('/login');
      await page.getByLabel('Email').fill(email);
      await page.locator('input[autocomplete="current-password"]').fill(password);
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
    }
  }
  // If at dashboard, user was auto-confirmed - nothing more to do
}

export async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();

  // Wait for dashboard or team creation
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
}

export async function getVerificationLink(email: string): Promise<string | null> {
  // Wait a bit for the email to arrive
  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    const response = await fetch(`${MAILPIT_API}/messages`);
    const data = await response.json();

    for (const message of data.messages || []) {
      // Check if this email is for our test user
      const toAddress = message.To?.[0]?.Address;
      if (toAddress === email) {
        // Get the full message
        const msgResponse = await fetch(`${MAILPIT_API}/message/${message.ID}`);
        const msgData = await msgResponse.json();

        // Extract link from HTML body
        const htmlBody = msgData.HTML || '';
        const linkMatch = htmlBody.match(/href="([^"]*confirm[^"]*)"/);
        if (linkMatch) {
          let link = linkMatch[1];
          // Convert localhost to 127.0.0.1 for cookie consistency
          link = link.replace('localhost', '127.0.0.1');
          return link;
        }
      }
    }
  } catch (error) {
    console.error('Error fetching verification link:', error);
  }

  return null;
}

export async function deleteMailpitMessages() {
  try {
    await fetch(`${MAILPIT_API}/messages`, { method: 'DELETE' });
  } catch (error) {
    console.error('Error deleting mailpit messages:', error);
  }
}

export function generateTestEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

export async function createTeam(page: Page, teamName: string, description?: string) {
  // Navigate to create team page
  await page.goto('/teams/new');

  // Fill form
  await page.getByLabel('Team Name').fill(teamName);
  if (description) {
    await page.getByRole('textbox', { name: /description/i }).fill(description);
  }

  // Submit
  await page.getByRole('button', { name: 'Create Team' }).click();

  // Wait for dashboard with team heading (page reload happens after team creation)
  await expect(page.getByRole('heading', { name: teamName })).toBeVisible({ timeout: 15000 });
}

export async function createUserWithTeam(page: Page, email: string, password: string, teamName: string) {
  await createTestUser(page, email, password);

  // Wait for page to stabilize after redirect
  await page.waitForLoadState('networkidle');

  // User should now be on dashboard showing team creation form
  const teamNameField = page.getByLabel('Team Name');
  await teamNameField.waitFor({ state: 'visible', timeout: 10000 });
  await teamNameField.fill(teamName);

  await page.getByRole('button', { name: 'Create Team' }).click();

  // Wait for team to be created and dashboard to show (page does a full reload)
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: teamName })).toBeVisible({ timeout: 15000 });
}

/**
 * Gets the current user ID from the page context by evaluating the Supabase client.
 */
export async function getCurrentUserId(page: Page): Promise<string | null> {
  // Try to get user ID from Supabase session
  const userId = await page.evaluate(async () => {
    // @ts-expect-error - accessing window object
    const supabase = window.__SUPABASE_CLIENT__;
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    }
    return null;
  });

  return userId;
}

/**
 * Gets the current team ID from localStorage.
 */
export async function getCurrentTeamId(page: Page): Promise<string | null> {
  const teamId = await page.evaluate(() => {
    return localStorage.getItem('currentTeamId');
  });

  return teamId;
}

/**
 * Sets the current team ID in localStorage.
 */
export async function setCurrentTeamId(page: Page, teamId: string): Promise<void> {
  await page.evaluate((id) => {
    localStorage.setItem('currentTeamId', id);
  }, teamId);
}

/**
 * Switches to a specific team by calling the API.
 */
export async function switchToTeam(page: Page, teamId: string): Promise<void> {
  // Call the switch team API
  const response = await page.request.post('/api/teams/switch', {
    data: { teamId },
  });

  if (!response.ok()) {
    throw new Error(`Failed to switch team: ${response.status()}`);
  }

  // Reload to apply the team switch (JWT gets updated)
  await page.reload();
  await page.waitForLoadState('networkidle');
}

/**
 * Makes a user a super admin using the admin API.
 * This bypasses RLS and directly updates the users table.
 */
export async function makeUserSuperAdmin(userId: string): Promise<void> {
  const response = await fetch(`http://127.0.0.1:3050/api/admin/make-super-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, secret: process.env.ADMIN_SECRET || 'test-admin-secret' }),
  });

  if (!response.ok) {
    throw new Error(`Failed to make user super admin: ${response.status}`);
  }
}

/**
 * Removes super admin status from a user.
 */
export async function removeSuperAdmin(userId: string): Promise<void> {
  const response = await fetch(`http://127.0.0.1:3050/api/admin/remove-super-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, secret: process.env.ADMIN_SECRET || 'test-admin-secret' }),
  });

  if (!response.ok) {
    throw new Error(`Failed to remove super admin: ${response.status}`);
  }
}

/**
 * Creates a test user via API and returns the user ID.
 * Uses Supabase admin client directly to create user.
 * Includes retry logic for transient failures.
 */
export async function createTestUserViaApi(emailPrefix: string): Promise<{ email: string; password: string; id: string }> {
  // Use more unique email to avoid conflicts with leftover test users
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const email = `${emailPrefix}-${uniqueId}@example.com`;
  const password = 'TestPassword123!';

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:3050/api/test/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Failed to create test user: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return { email, password, id: data.userId };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError || new Error('Failed to create test user after retries');
}

/**
 * Deletes a test user via API.
 */
export async function deleteTestUserViaApi(email: string): Promise<void> {
  const response = await fetch(`http://127.0.0.1:3050/api/test/delete-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    console.error(`Failed to delete test user ${email}: ${response.status}`);
  }
}
