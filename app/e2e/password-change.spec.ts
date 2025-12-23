import { test, expect } from "@playwright/test";
import {
  loginUser,
  createTestUserViaApi,
  deleteTestUserViaApi,
} from "./helpers/auth";

test.describe("Password Change (In-App)", () => {
  // Test user credentials
  let testUser: { email: string; password: string; id: string };
  const newPassword = "NewSecurePass123!";
  const invalidShortPassword = "short";
  const noLowercasePassword = "ALLUPPERCASE123";
  const noUppercasePassword = "alllowercase123";
  const noNumberPassword = "NoNumbersHere!";

  test.beforeAll(async () => {
    // Create a fresh test user for password change tests
    testUser = await createTestUserViaApi("password-change");
  });

  test.afterAll(async () => {
    // Clean up test user
    if (testUser?.email) {
      await deleteTestUserViaApi(testUser.email);
    }
  });

  test.describe("Form Display", () => {
    test("should display Security section on settings page", async ({ page }) => {
      await loginUser(page, testUser.email, testUser.password);

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      // Check for Security card - Security is in CardTitle with icon, so look for text
      await expect(page.getByText("Security")).toBeVisible();
      await expect(page.getByText("Update your account password")).toBeVisible();
    });

    test("should show current password field for email users", async ({ page }) => {
      await loginUser(page, testUser.email, testUser.password);

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      // Email users should see current password field
      // Use placeholder text since that's what appears in the accessibility tree
      await expect(page.getByPlaceholder("Enter your current password")).toBeVisible();
      await expect(page.getByPlaceholder("Enter your new password")).toBeVisible();
      await expect(page.getByPlaceholder("Confirm your new password")).toBeVisible();
      await expect(page.getByRole("button", { name: "Change Password" })).toBeVisible();
    });

    test("should toggle password visibility", async ({ page }) => {
      await loginUser(page, testUser.email, testUser.password);

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      // Find new password input
      const newPasswordInput = page.getByPlaceholder("Enter your new password");
      await newPasswordInput.fill("testpassword");

      // Password should be hidden by default
      await expect(newPasswordInput).toHaveAttribute("type", "password");

      // Find the show password button - there are multiple, get the one next to New Password
      // The second show password button (after current password)
      const showButtons = page.getByRole("button", { name: "Show password" });
      await showButtons.nth(1).click();

      // Password should now be visible
      await expect(newPasswordInput).toHaveAttribute("type", "text");
    });
  });

  test.describe("Password Strength Indicator", () => {
    test("should show password requirements checklist", async ({ page }) => {
      await loginUser(page, testUser.email, testUser.password);

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      // Start typing to trigger checklist
      const newPasswordInput = page.getByPlaceholder("Enter your new password");
      await newPasswordInput.fill("a");

      // Should show checklist items - use exact match to avoid matching error messages
      await expect(page.getByText("At least 12 characters", { exact: true })).toBeVisible();
      await expect(page.getByText("One lowercase letter", { exact: true })).toBeVisible();
      await expect(page.getByText("One uppercase letter", { exact: true })).toBeVisible();
      await expect(page.getByText("One number", { exact: true })).toBeVisible();
    });

    test("should update strength indicator as password improves", async ({ page }) => {
      await loginUser(page, testUser.email, testUser.password);

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      const newPasswordInput = page.getByPlaceholder("Enter your new password");

      // Type a weak password (only lowercase)
      await newPasswordInput.fill("abcdefghijkl");

      // Should show some progress
      await expect(page.getByText("Password strength")).toBeVisible();

      // Add uppercase
      await newPasswordInput.fill("Abcdefghijkl");

      // Add number for full strength
      await newPasswordInput.fill("Abcdefghijk1");

      // Should show strong
      await expect(page.getByText("Strong")).toBeVisible();
    });

    test("should show check marks for passed requirements", async ({ page }) => {
      await loginUser(page, testUser.email, testUser.password);

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      const newPasswordInput = page.getByPlaceholder("Enter your new password");

      // Type a password that meets all requirements
      await newPasswordInput.fill("SecurePass123!");

      // All requirements should be satisfied (green checkmarks)
      const checklist = page.locator("ul").filter({ hasText: "At least 12 characters" });
      await expect(checklist).toBeVisible();
    });
  });

  test.describe("Validation Errors", () => {
    test("should show error for empty current password", async ({ page }) => {
      await loginUser(page, testUser.email, testUser.password);

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      // Fill only new password fields
      await page.getByPlaceholder("Enter your new password").fill("NewSecurePass123");
      await page.getByPlaceholder("Confirm your new password").fill("NewSecurePass123");

      await page.getByRole("button", { name: "Change Password" }).click();

      await expect(page.getByText("Current password is required")).toBeVisible();
    });

    test("should show error for password mismatch", async ({ page }) => {
      await loginUser(page, testUser.email, testUser.password);

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      await page.getByPlaceholder("Enter your current password").fill(testUser.password);
      await page.getByPlaceholder("Enter your new password").fill("NewSecurePass123");
      await page.getByPlaceholder("Confirm your new password").fill("DifferentPass456");

      await page.getByRole("button", { name: "Change Password" }).click();

      await expect(page.getByText("Passwords do not match")).toBeVisible();
    });

    test("should show error for short password", async ({ page }) => {
      await loginUser(page, testUser.email, testUser.password);

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      await page.getByPlaceholder("Enter your current password").fill(testUser.password);
      await page.getByPlaceholder("Enter your new password").fill(invalidShortPassword);
      await page.getByPlaceholder("Confirm your new password").fill(invalidShortPassword);

      await page.getByRole("button", { name: "Change Password" }).click();

      await expect(page.getByText("Password must be at least 12 characters")).toBeVisible();
    });

    test("should show error for password without lowercase", async ({ page }) => {
      await loginUser(page, testUser.email, testUser.password);

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      await page.getByPlaceholder("Enter your current password").fill(testUser.password);
      await page.getByPlaceholder("Enter your new password").fill(noLowercasePassword);
      await page.getByPlaceholder("Confirm your new password").fill(noLowercasePassword);

      await page.getByRole("button", { name: "Change Password" }).click();

      await expect(page.getByText("Password must contain at least one lowercase letter")).toBeVisible();
    });

    test("should show error for password without uppercase", async ({ page }) => {
      await loginUser(page, testUser.email, testUser.password);

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      await page.getByPlaceholder("Enter your current password").fill(testUser.password);
      await page.getByPlaceholder("Enter your new password").fill(noUppercasePassword);
      await page.getByPlaceholder("Confirm your new password").fill(noUppercasePassword);

      await page.getByRole("button", { name: "Change Password" }).click();

      await expect(page.getByText("Password must contain at least one uppercase letter")).toBeVisible();
    });

    test("should show error for password without number", async ({ page }) => {
      await loginUser(page, testUser.email, testUser.password);

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      await page.getByPlaceholder("Enter your current password").fill(testUser.password);
      await page.getByPlaceholder("Enter your new password").fill(noNumberPassword);
      await page.getByPlaceholder("Confirm your new password").fill(noNumberPassword);

      await page.getByRole("button", { name: "Change Password" }).click();

      await expect(page.getByText("Password must contain at least one number")).toBeVisible();
    });

    test("should show error for wrong current password", async ({ page }) => {
      await loginUser(page, testUser.email, testUser.password);

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      await page.getByPlaceholder("Enter your current password").fill("WrongPassword123!");
      await page.getByPlaceholder("Enter your new password").fill(newPassword);
      await page.getByPlaceholder("Confirm your new password").fill(newPassword);

      await page.getByRole("button", { name: "Change Password" }).click();

      await expect(page.getByText("Current password is incorrect")).toBeVisible({ timeout: 10000 });
    });

    test("should show error when new password same as current", async ({ page }) => {
      await loginUser(page, testUser.email, testUser.password);

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      await page.getByPlaceholder("Enter your current password").fill(testUser.password);
      await page.getByPlaceholder("Enter your new password").fill(testUser.password);
      await page.getByPlaceholder("Confirm your new password").fill(testUser.password);

      await page.getByRole("button", { name: "Change Password" }).click();

      await expect(page.getByText("New password must be different from current password")).toBeVisible();
    });
  });

  test.describe("Successful Password Change", () => {
    // Use a dedicated test user for the success flow since it changes the password
    let successTestUser: { email: string; password: string; id: string };
    const successNewPassword = "ChangedPass999!";

    test.beforeAll(async () => {
      successTestUser = await createTestUserViaApi("password-change-success");
    });

    test.afterAll(async () => {
      if (successTestUser?.email) {
        await deleteTestUserViaApi(successTestUser.email);
      }
    });

    test("should successfully change password and remain logged in", async ({ page }) => {
      await loginUser(page, successTestUser.email, successTestUser.password);

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      // Fill the form with valid data
      await page.getByPlaceholder("Enter your current password").fill(successTestUser.password);
      await page.getByPlaceholder("Enter your new password").fill(successNewPassword);
      await page.getByPlaceholder("Confirm your new password").fill(successNewPassword);

      // Submit
      await page.getByRole("button", { name: "Change Password" }).click();

      // Should show success toast
      await expect(page.getByText("Password changed successfully")).toBeVisible({ timeout: 10000 });

      // User should still be on settings page (not logged out)
      await expect(page).toHaveURL("/settings");

      // Form should be cleared
      await expect(page.getByPlaceholder("Enter your current password")).toHaveValue("");
      await expect(page.getByPlaceholder("Enter your new password")).toHaveValue("");
      await expect(page.getByPlaceholder("Confirm your new password")).toHaveValue("");
    });

    test("should be able to login with new password after change", async ({ page }) => {
      // Logout
      await page.goto("/logout");
      await page.waitForLoadState("networkidle");

      // Try to login with new password
      await page.goto("/login");
      await page.getByLabel("Email").fill(successTestUser.email);
      await page.locator('input[autocomplete="current-password"]').fill(successNewPassword);
      await page.getByRole("button", { name: "Login", exact: true }).click();

      // Should redirect to dashboard
      await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
    });
  });
});
