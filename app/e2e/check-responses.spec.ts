import { test, expect } from '@playwright/test';

test('check conversation responses', async ({ page }) => {
  // Login as the real user
  await page.goto('http://127.0.0.1:3050/login');
  
  // Check if already logged in
  const url = page.url();
  if (url.includes('/login')) {
    // Need to login - use test user or skip
    console.log('Not logged in - skipping auth for now');
  }
  
  // Go directly to conversation page
  await page.goto('http://127.0.0.1:3050/conversations/20d49eca-fc3f-402d-8a8e-f1ea40f963ea');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/conversation-page.png', fullPage: true });
  
  // Log the page content
  const content = await page.content();
  console.log('Page title:', await page.title());
  
  // Check for any error messages
  const errorText = await page.locator('text=error').count();
  console.log('Error elements found:', errorText);
  
  // Check for response elements
  const responseElements = await page.locator('[data-testid="response"]').count();
  console.log('Response elements found:', responseElements);
  
  // Check for any "assistant" or "response" text
  const assistantText = await page.locator('text=assistant').count();
  console.log('Assistant text found:', assistantText);
  
  // Get all visible text
  const bodyText = await page.locator('body').innerText();
  console.log('\n=== PAGE TEXT (first 2000 chars) ===\n', bodyText.substring(0, 2000));
});
