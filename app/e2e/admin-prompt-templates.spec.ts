/**
 * E2E Tests for Prompt Templates (Story 22-1)
 *
 * Tests the prompt template management system for super admins.
 */

import { test, expect } from '@playwright/test';

// Test credentials - super admin user
const TEST_EMAIL = 'edgars@test.com';
const TEST_PASSWORD = 'password123';

// Helper to login as super admin
async function loginAsSuperAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', TEST_EMAIL);
  await page.fill('[data-testid="password-input"]', TEST_PASSWORD);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL(/\/(prompts|$)/);
}

test.describe('Prompt Templates - List Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test('should display templates list page with filters', async ({ page }) => {
    await page.goto('/admin/analysis/templates');

    // Check page elements
    await expect(page.getByTestId('templates-list-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Prompt Templates' })).toBeVisible();
    await expect(page.getByTestId('create-template-button')).toBeVisible();
    await expect(page.getByTestId('template-filters')).toBeVisible();
  });

  test('should filter templates by type', async ({ page }) => {
    await page.goto('/admin/analysis/templates');

    // Click on Analysis filter
    await page.click('[data-testid="filter-type-analysis"]');
    await expect(page).toHaveURL(/type=analysis/);

    // Click again to deselect
    await page.click('[data-testid="filter-type-analysis"]');
    await expect(page).not.toHaveURL(/type=analysis/);
  });

  test('should filter templates by status', async ({ page }) => {
    await page.goto('/admin/analysis/templates');

    // Click on Draft filter
    await page.click('[data-testid="filter-status-draft"]');
    await expect(page).toHaveURL(/status=draft/);

    // Clear filters
    await page.click('[data-testid="clear-filters"]');
    await expect(page).not.toHaveURL(/status=/);
  });

  test('should navigate to create template page', async ({ page }) => {
    await page.goto('/admin/analysis/templates');
    await page.click('[data-testid="create-template-button"]');
    await expect(page).toHaveURL('/admin/analysis/templates/new');
  });
});

test.describe('Prompt Templates - Create Template', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test('should display create template form', async ({ page }) => {
    await page.goto('/admin/analysis/templates/new');

    // Check form elements
    await expect(page.getByTestId('template-form')).toBeVisible();
    await expect(page.getByTestId('template-name-input')).toBeVisible();
    await expect(page.getByTestId('template-type-select')).toBeVisible();
    await expect(page.getByTestId('template-body-editor')).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/admin/analysis/templates/new');

    // Try to save empty form
    await page.click('button:has-text("Save Draft")');

    // Check for validation errors
    await expect(page.getByText('Name is required')).toBeVisible();
  });

  test('should create a new template successfully', async ({ page }) => {
    await page.goto('/admin/analysis/templates/new');

    // Fill form
    const uniqueName = `Test Template ${Date.now()}`;
    await page.fill('[data-testid="template-name-input"]', uniqueName);
    await page.fill('[data-testid="template-description-input"]', 'Test description');

    // Fill template body
    await page.fill(
      '[data-testid="template-body-editor-textarea"]',
      'Analyze the following prompt: {{prompt}}\n\nProvide a detailed analysis.'
    );

    // Save template
    await page.click('button:has-text("Save Draft")');

    // Should redirect to detail page
    await expect(page).toHaveURL(/\/admin\/analysis\/templates\/[a-f0-9-]+$/);
    await expect(page.getByText('Template created successfully')).toBeVisible();
  });

  test('should show variable highlighting in editor', async ({ page }) => {
    await page.goto('/admin/analysis/templates/new');

    // Type template with variables
    await page.fill(
      '[data-testid="template-body-editor-textarea"]',
      'Hello {{prompt}} and {{unknown_var}}'
    );

    // Check variable usage summary shows correct counts
    await expect(page.getByText(/Used:/)).toBeVisible();
  });
});

test.describe('Prompt Templates - Edit Template', () => {
  let templateId: string | null = null;

  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);

    // Create a test template first
    await page.goto('/admin/analysis/templates/new');

    const uniqueName = `Edit Test Template ${Date.now()}`;
    await page.fill('[data-testid="template-name-input"]', uniqueName);
    await page.fill(
      '[data-testid="template-body-editor-textarea"]',
      'Test template body with {{prompt}} variable'
    );
    await page.click('button:has-text("Save Draft")');

    // Wait for redirect and extract template ID
    await page.waitForURL(/\/admin\/analysis\/templates\/[a-f0-9-]+$/);
    const url = page.url();
    templateId = url.split('/').pop() || null;
  });

  test('should load existing template for editing', async ({ page }) => {
    if (!templateId) {
      test.skip();
      return;
    }

    await page.goto(`/admin/analysis/templates/${templateId}`);

    // Check template is loaded
    await expect(page.getByTestId('template-form')).toBeVisible();
    await expect(page.getByTestId('template-name-input')).not.toBeEmpty();
    await expect(page.getByText('Draft')).toBeVisible();
  });

  test('should update template successfully', async ({ page }) => {
    if (!templateId) {
      test.skip();
      return;
    }

    await page.goto(`/admin/analysis/templates/${templateId}`);

    // Update name
    await page.fill('[data-testid="template-name-input"]', 'Updated Template Name');

    // Save changes
    await page.click('button:has-text("Save Draft")');
    await expect(page.getByText('Template saved successfully')).toBeVisible();
  });
});

test.describe('Prompt Templates - Preview', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test('should open preview modal with sample data', async ({ page }) => {
    await page.goto('/admin/analysis/templates/new');

    // Add template content first
    await page.fill(
      '[data-testid="template-body-editor-textarea"]',
      'Analyze prompt: {{prompt}}\nLength: {{prompt_length}}'
    );

    // Open preview
    await page.click('button:has-text("Preview")');

    // Check preview modal is open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Template Preview')).toBeVisible();
    await expect(page.getByText('Variable Data (JSON)')).toBeVisible();
  });

  test('should render template with custom data', async ({ page }) => {
    await page.goto('/admin/analysis/templates/new');

    // Add template content
    await page.fill(
      '[data-testid="template-body-editor-textarea"]',
      'Hello {{prompt}}'
    );

    // Open preview
    await page.click('button:has-text("Preview")');
    await page.waitForSelector('[role="dialog"]');

    // Click Update Preview
    await page.click('button:has-text("Update Preview")');

    // Check rendered template is shown
    await expect(page.getByText('Rendered Template')).toBeVisible();
  });
});

test.describe('Prompt Templates - Publish Workflow', () => {
  let templateId: string | null = null;

  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);

    // Create a test template
    await page.goto('/admin/analysis/templates/new');

    const uniqueName = `Publish Test Template ${Date.now()}`;
    await page.fill('[data-testid="template-name-input"]', uniqueName);
    await page.fill(
      '[data-testid="template-body-editor-textarea"]',
      'Valid template with {{prompt}} variable for testing publish flow.'
    );
    await page.click('button:has-text("Save Draft")');

    await page.waitForURL(/\/admin\/analysis\/templates\/[a-f0-9-]+$/);
    const url = page.url();
    templateId = url.split('/').pop() || null;
  });

  test('should show publish button for draft templates', async ({ page }) => {
    if (!templateId) {
      test.skip();
      return;
    }

    await page.goto(`/admin/analysis/templates/${templateId}`);
    await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();
  });

  test('should show confirmation dialog when publishing', async ({ page }) => {
    if (!templateId) {
      test.skip();
      return;
    }

    await page.goto(`/admin/analysis/templates/${templateId}`);
    await page.click('button:has-text("Publish")');

    // Check confirmation dialog
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByText('Publish Template')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('should publish template successfully', async ({ page }) => {
    if (!templateId) {
      test.skip();
      return;
    }

    await page.goto(`/admin/analysis/templates/${templateId}`);
    await page.click('button:has-text("Publish")');

    // Confirm publish
    await page.getByRole('alertdialog').getByRole('button', { name: 'Publish' }).click();

    // Check success message and status change
    await expect(page.getByText('Template published successfully')).toBeVisible();
    await expect(page.getByText('Active')).toBeVisible();
  });
});

test.describe('Prompt Templates - Duplicate', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test('should duplicate template from list', async ({ page }) => {
    // First create a template
    await page.goto('/admin/analysis/templates/new');

    const originalName = `Original Template ${Date.now()}`;
    await page.fill('[data-testid="template-name-input"]', originalName);
    await page.fill(
      '[data-testid="template-body-editor-textarea"]',
      'Template to duplicate with {{prompt}}'
    );
    await page.click('button:has-text("Save Draft")');
    await page.waitForURL(/\/admin\/analysis\/templates\/[a-f0-9-]+$/);

    // Go to list and duplicate
    await page.goto('/admin/analysis/templates');

    // Find and click the actions menu for our template
    const templateCard = page.locator(`[data-testid^="template-card-"]`).first();
    await templateCard.locator('[data-testid^="template-actions-"]').click();

    // Click duplicate
    await page.click('text=Duplicate');

    // Should redirect to new template
    await expect(page).toHaveURL(/\/admin\/analysis\/templates\/[a-f0-9-]+$/);
    await expect(page.getByText('Template duplicated successfully')).toBeVisible();

    // Check name is "Copy of ..."
    const nameInput = page.getByTestId('template-name-input');
    await expect(nameInput).toHaveValue(/Copy of/);
  });
});

test.describe('Prompt Templates - Variable Panel', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test('should display variables for analysis type', async ({ page }) => {
    await page.goto('/admin/analysis/templates/new');

    // Check variable panel shows analysis variables
    await expect(page.getByTestId('variable-prompt')).toBeVisible();
    await expect(page.getByTestId('variable-prompt_length')).toBeVisible();
    await expect(page.getByTestId('variable-word_count')).toBeVisible();
    await expect(page.getByTestId('variable-context')).toBeVisible();
  });

  test('should update variables when type changes', async ({ page }) => {
    await page.goto('/admin/analysis/templates/new');

    // Change type to feedback
    await page.click('[data-testid="template-type-select"]');
    await page.click('text=Feedback');

    // Check feedback variables are shown
    await expect(page.getByTestId('variable-score')).toBeVisible();
    await expect(page.getByTestId('variable-dimension_scores')).toBeVisible();
    await expect(page.getByTestId('variable-suggestions')).toBeVisible();
  });

  test('should insert variable when clicked', async ({ page }) => {
    await page.goto('/admin/analysis/templates/new');

    // Click on a variable to insert
    await page.click('[data-testid="variable-prompt"]');

    // Check variable was inserted
    const editor = page.getByTestId('template-body-editor-textarea');
    await expect(editor).toHaveValue(/\{\{prompt\}\}/);
  });
});

test.describe('Prompt Templates - Access Control', () => {
  test('should redirect non-admin users', async ({ page }) => {
    // Don't login - try to access admin page directly
    await page.goto('/admin/analysis/templates');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});
