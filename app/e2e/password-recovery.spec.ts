import { test, expect } from "@playwright/test";

const MAILPIT_API = "http://127.0.0.1:54324/api/v1";
const testEmail = `recovery-test-${Date.now()}@example.com`;
const originalPassword = "OriginalPass123!";
const newPassword = "NewPassword456!";

// Helper to get latest email for an address from Mailpit
async function getLatestEmail(email: string, maxWait = 10000): Promise<{ id: string; html: string } | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const response = await fetch(`${MAILPIT_API}/messages`);
    const data = await response.json();

    for (const message of data.messages || []) {
      if (message.To?.some((to: { Address: string }) => to.Address === email)) {
        const fullMessage = await fetch(`${MAILPIT_API}/message/${message.ID}`);
        const messageData = await fullMessage.json();
        return { id: message.ID, html: messageData.HTML };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return null;
}

// Helper to extract reset link from email HTML
function extractResetLink(html: string): string | null {
  // The link goes through Supabase auth server first
  const match = html.match(/href="(http[^"]*\/auth\/v1\/verify[^"]*)"/);
  if (match) {
    // Decode HTML entities
    return match[1].replace(/&amp;/g, "&");
  }
  return null;
}

// Helper to delete emails for cleanup
async function deleteEmail(id: string): Promise<void> {
  await fetch(`${MAILPIT_API}/messages`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [id] }),
  });
}

test.describe("Password Recovery Flow", () => {
  test.beforeAll(async ({ request }) => {
    // Create a test account first
    const supabaseUrl = "http://127.0.0.1:54321";
    const supabaseKey = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

    await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: {
        apikey: supabaseKey,
        "Content-Type": "application/json",
      },
      data: {
        email: testEmail,
        password: originalPassword,
      },
    });

    // Wait for the signup email and delete it
    const signupEmail = await getLatestEmail(testEmail);
    if (signupEmail) {
      await deleteEmail(signupEmail.id);
    }
  });

  test("complete password recovery flow", async ({ page }) => {
    // Step 1: Request password reset
    await page.goto("/reset-password");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByRole("button", { name: "Send reset link" }).click();

    // Should show success message
    await expect(page.getByText("Check your email")).toBeVisible({ timeout: 10000 });

    // Step 2: Get the reset email from Mailpit
    const email = await getLatestEmail(testEmail);
    expect(email).not.toBeNull();

    const resetLink = extractResetLink(email!.html);
    expect(resetLink).not.toBeNull();
    console.log("Reset link:", resetLink);

    // Step 3: Click the reset link (goes through Supabase auth server)
    await page.goto(resetLink!);

    // Step 4: Should be redirected to password update page
    await expect(page).toHaveURL(/\/reset-password\/update/, { timeout: 15000 });
    await expect(page.getByText("Set new password")).toBeVisible();

    // Step 5: Update the password
    const passwordInputs = page.locator('input[autocomplete="new-password"]');
    await passwordInputs.first().fill(newPassword);
    await passwordInputs.last().fill(newPassword);
    await page.getByRole("button", { name: "Update password" }).click();

    // Wait a moment for the password update to complete
    await page.waitForTimeout(2000);

    // After successful password update, user is authenticated and redirected to home
    await expect(page).toHaveURL("/", { timeout: 10000 });

    // Cleanup: delete the reset email
    if (email) {
      await deleteEmail(email.id);
    }
  });

  test("shows error for expired/invalid reset link", async ({ page }) => {
    // Use an invalid code
    await page.goto("/callback?code=invalid-code-12345");

    // Should redirect to login with error
    await expect(page).toHaveURL(/\/login.*error/i, { timeout: 10000 });
    await expect(page.getByText(/failed|error/i)).toBeVisible();
  });
});
