import { Resend } from 'resend';

// Initialize Resend with API key or placeholder (will fail gracefully if not set)
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

interface SendInvitationEmailParams {
  email: string;
  inviteLink: string;
  teamName: string;
  inviterName?: string;
}

/**
 * Send a team invitation email with retry logic
 */
export async function sendInvitationEmail({
  email,
  inviteLink,
  teamName,
  inviterName,
}: SendInvitationEmailParams): Promise<{ success: boolean; error?: string }> {
  const fromEmail = process.env.EMAIL_FROM || 'Contextor <noreply@contextor.dev>';

  const inviterText = inviterName ? `${inviterName} has` : 'You have been';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited!</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      ${inviterText} invited you to join <strong>${teamName}</strong> on Contextor.
    </p>

    <p style="font-size: 14px; color: #666; margin-bottom: 30px;">
      Contextor helps AI-assisted development teams capture prompts, learn together, and improve their prompting skills.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Join Team
      </a>
    </div>

    <p style="font-size: 13px; color: #888; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
      This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
    </p>

    <p style="font-size: 12px; color: #aaa; margin-top: 20px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${inviteLink}" style="color: #667eea; word-break: break-all;">${inviteLink}</a>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>Contextor - AI-Assisted Development Teams</p>
  </div>
</body>
</html>
`;

  const textContent = `
You're Invited to Join ${teamName}!

${inviterText} invited you to join ${teamName} on Contextor.

Contextor helps AI-assisted development teams capture prompts, learn together, and improve their prompting skills.

Join the team by clicking this link:
${inviteLink}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

---
Contextor - AI-Assisted Development Teams
`;

  // Handle missing Resend client
  if (!resend) {
    console.warn('[EMAIL] Resend API key not configured, skipping email send');
    return {
      success: false,
      error: 'Email service not configured',
    };
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[EMAIL] Sending invitation to ${email} (attempt ${attempt}/${MAX_RETRIES})`);

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: `You're invited to join ${teamName} on Contextor`,
        html: htmlContent,
        text: textContent,
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log(`[EMAIL] Successfully sent invitation to ${email}, id: ${data?.id}`);
      return { success: true };
    } catch (error) {
      lastError = error as Error;
      console.error(`[EMAIL] Failed to send invitation (attempt ${attempt}/${MAX_RETRIES}):`, error);

      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[EMAIL] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[EMAIL] All ${MAX_RETRIES} attempts failed for ${email}`);
  return {
    success: false,
    error: lastError?.message || 'Failed to send email after multiple attempts',
  };
}
