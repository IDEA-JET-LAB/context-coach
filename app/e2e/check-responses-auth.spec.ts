import { test, expect } from '@playwright/test';

test('check conversation responses with auth', async ({ page }) => {
  // Go to login page
  await page.goto('http://127.0.0.1:3050/login');
  
  // Fill in credentials for a real user that's in the team
  // Using edgars@ideajetlab.com since they're the admin of "Idea Jet Lab" team
  await page.fill('input[name="email"]', 'edgars@ideajetlab.com');
  await page.fill('input[name="password"]', 'test123456'); // Assuming standard test password
  
  // Click login
  await page.click('button[type="submit"]');
  
  // Wait for navigation
  await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {
    console.log('Did not redirect to dashboard');
  });
  
  // Take screenshot after login attempt
  await page.screenshot({ path: '/tmp/after-login.png' });
  console.log('Current URL after login:', page.url());
  
  // Now try to go to conversation page
  await page.goto('http://127.0.0.1:3050/conversations/20d49eca-fc3f-402d-8a8e-f1ea40f963ea');
  await page.waitForLoadState('networkidle');
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/conversation-page.png', fullPage: true });
  
  console.log('Conversation page URL:', page.url());
  
  // Get page content
  const bodyText = await page.locator('body').innerText();
  console.log('\n=== PAGE TEXT ===\n', bodyText.substring(0, 3000));
  
  // Check for response count in the UI
  const responseCount = await page.locator('.response, [data-role="assistant"], .assistant-message').count();
  console.log('Response elements:', responseCount);
});
