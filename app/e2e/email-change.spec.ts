import { test, expect, Page } from "@playwright/test";
import {
  createTestUserDirect,
  deleteTestUser,
} from "./helpers/api";

const MAILPIT_API = "http://127.0.0.1:54324/api/v1";

// Helper to login a user
async function loginUser(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL(/\/(home|prompts)/, { timeout: 15000 });
}

// Helper to find the email card
function getEmailCard(page: Page) {
  return page.getByTestId("email-change-card");
}

// Helper to find the email card's Edit button
function getEmailEditButton(page: Page) {
  return getEmailCard(page).getByRole("button", { name: "Edit" });
}

// Helper to get latest email for an address from Mailpit
async function getLatestEmail(
  email: string,
  maxWait = 10000
): Promise<{ id: string; html: string; subject: string } | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const response = await fetch(`${MAILPIT_API}/messages`);
    const data = await response.json();

    for (const message of data.messages || []) {
      if (message.To?.some((to: { Address: string }) => to.Address === email)) {
        const fullMessage = await fetch(`${MAILPIT_API}/message/${message.ID}`);
        const messageData = await fullMessage.json();
        return {
          id: message.ID,
          html: messageData.HTML,
          subject: message.Subject || "",
        };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return null;
}

// Helper to extract confirmation link from email HTML
function extractConfirmationLink(html: string): string | null {
  // Supabase sends an email with a link to verify the email change
  const match = html.match(/href="(http[^"]*\/auth\/v1\/verify[^"]*)"/);
  if (match) {
    return match[1].replace(/&amp;/g, "&");
  }
  return null;
}

// Helper to delete emails
async function deleteEmail(id: string): Promise<void> {
  await fetch(`${MAILPIT_API}/messages`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [id] }),
  });
}

// Helper to delete all emails for an address
async function deleteEmailsForAddress(email: string): Promise<void> {
  const response = await fetch(`${MAILPIT_API}/messages`);
  const data = await response.json();

  const idsToDelete: string[] = [];
  for (const message of data.messages || []) {
    if (message.To?.some((to: { Address: string }) => to.Address === email)) {
      idsToDelete.push(message.ID);
    }
  }

  if (idsToDelete.length > 0) {
    await fetch(`${MAILPIT_API}/messages`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: idsToDelete }),
    });
  }
}

test.describe("Email Change Flow", () => {
  const testPassword = "TestPassword123!";
  let testUserId: string;
  let testEmail: string;
  let newEmail: string;

  test.beforeEach(async () => {
    // Create a unique test user for each test
    testEmail = `email-change-test-${Date.now()}@example.com`;
    newEmail = `new-email-${Date.now()}@example.com`;

    const user = await createTestUserDirect(testEmail, testPassword);
    testUserId = user.id;

    // Clean up any existing emails
    await deleteEmailsForAddress(testEmail);
    await deleteEmailsForAddress(newEmail);
  });

  test.afterEach(async () => {
    // Clean up test user
    if (testUserId) {
      await deleteTestUser(testUserId);
    }
    // Clean up emails
    await deleteEmailsForAddress(testEmail);
    await deleteEmailsForAddress(newEmail);
  });

  test("shows current email with Edit button on settings page", async ({
    page,
  }) => {
    // Login as test user
    await loginUser(page, testEmail, testPassword);
    await page.goto("/settings");

    // Should see email section with Edit button
    const emailCard = getEmailCard(page);
    await expect(emailCard).toBeVisible();
    await expect(emailCard.getByText("Email Address", { exact: true })).toBeVisible();
    await expect(emailCard.getByText(testEmail)).toBeVisible();
    await expect(getEmailEditButton(page)).toBeVisible();
  });

  test("opens email change dialog when Edit is clicked", async ({ page }) => {
    // Login
    await loginUser(page, testEmail, testPassword);
    await page.goto("/settings");

    // Click Edit button on email card
    await getEmailEditButton(page).click();

    // Dialog should open
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Change Email Address")).toBeVisible();
    await expect(dialog.getByLabel("New Email Address")).toBeVisible();
    await expect(dialog.getByLabel("Current Password")).toBeVisible();
  });

  test("validates email format with browser validation", async ({ page }) => {
    // Login
    await loginUser(page, testEmail, testPassword);
    await page.goto("/settings");

    // Open dialog
    await getEmailEditButton(page).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Fill invalid email - browser will show native validation tooltip
    await dialog.getByLabel("New Email Address").fill("invalid-email");
    await dialog.getByLabel("Current Password").fill(testPassword);

    // The email input should have invalid state due to HTML5 validation
    const emailInput = dialog.getByLabel("New Email Address");
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isInvalid).toBe(true);
  });

  test("validates password is required", async ({ page }) => {
    // Login
    await loginUser(page, testEmail, testPassword);
    await page.goto("/settings");

    // Open dialog
    await getEmailEditButton(page).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Submit with empty password
    await dialog.getByLabel("New Email Address").fill(newEmail);
    await dialog.getByRole("button", { name: "Send Confirmation" }).click();

    // Should show validation error
    await expect(dialog.getByText("password is required")).toBeVisible();
  });

  test("shows error for incorrect password", async ({ page }) => {
    // Login
    await loginUser(page, testEmail, testPassword);
    await page.goto("/settings");

    // Open dialog
    await getEmailEditButton(page).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Submit with wrong password
    await dialog.getByLabel("New Email Address").fill(newEmail);
    await dialog.getByLabel("Current Password").fill("WrongPassword123!");
    await dialog.getByRole("button", { name: "Send Confirmation" }).click();

    // Should show error
    await expect(dialog.getByText("Incorrect password")).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows error for already registered email", async ({ page }) => {
    // Create a second user with the "new" email
    const secondUser = await createTestUserDirect(newEmail, testPassword);

    try {
      // Login as first user
      await loginUser(page, testEmail, testPassword);
      await page.goto("/settings");

      // Open dialog
      await getEmailEditButton(page).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Try to change to already registered email
      await dialog.getByLabel("New Email Address").fill(newEmail);
      await dialog.getByLabel("Current Password").fill(testPassword);
      await dialog.getByRole("button", { name: "Send Confirmation" }).click();

      // Should show error about email being in use
      await expect(
        dialog.getByText(/already registered|already in use/i)
      ).toBeVisible({ timeout: 10000 });
    } finally {
      // Clean up second user
      await deleteTestUser(secondUser.id);
    }
  });

  // Skip: Supabase local development has email sending issues with email change
  // This test works in production where email sending is properly configured
  test.skip("successfully sends confirmation email for valid request", async ({
    page,
  }) => {
    // Login
    await loginUser(page, testEmail, testPassword);
    await page.goto("/settings");

    // Open dialog
    await getEmailEditButton(page).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Submit valid request
    await dialog.getByLabel("New Email Address").fill(newEmail);
    await dialog.getByLabel("Current Password").fill(testPassword);
    await dialog.getByRole("button", { name: "Send Confirmation" }).click();

    // Should show success message in dialog
    await expect(
      dialog.getByText(/We have sent a confirmation link/i)
    ).toBeVisible({ timeout: 15000 });

    // Verify email was sent to the new address
    const email = await getLatestEmail(newEmail);
    expect(email).not.toBeNull();
    expect(email!.html).toContain("confirm");
  });

  test("closes dialog with Cancel button", async ({ page }) => {
    // Login
    await loginUser(page, testEmail, testPassword);
    await page.goto("/settings");

    // Open dialog
    await getEmailEditButton(page).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Click Cancel
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // Dialog should be closed
    await expect(dialog).not.toBeVisible();
  });

  // Skip: Supabase local development has email sending issues with email change
  // This test works in production where email sending is properly configured
  test.skip("complete email change flow with confirmation link", async ({
    page,
  }) => {
    // Login
    await loginUser(page, testEmail, testPassword);
    await page.goto("/settings");

    // Initiate email change
    await getEmailEditButton(page).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("New Email Address").fill(newEmail);
    await dialog.getByLabel("Current Password").fill(testPassword);
    await dialog.getByRole("button", { name: "Send Confirmation" }).click();

    // Wait for success message
    await expect(
      page.getByText(/We have sent a confirmation link/i)
    ).toBeVisible({ timeout: 15000 });

    // Get the confirmation email
    const email = await getLatestEmail(newEmail);
    expect(email).not.toBeNull();

    const confirmLink = extractConfirmationLink(email!.html);
    expect(confirmLink).not.toBeNull();

    // Click the confirmation link
    await page.goto(confirmLink!);

    // Should be redirected to settings with success message
    await expect(page).toHaveURL(/\/settings/, { timeout: 15000 });

    // The email should now be updated on the page
    await expect(page.getByText(newEmail)).toBeVisible({ timeout: 10000 });
  });
});
