import nodemailer from 'nodemailer';
import twilio from 'twilio';

// ─── SMS ─────────────────────────────────────────────────────────────────────

export async function sendSMS(
  to: string,
  giftUrl: string,
  senderName: string,
  recipientName: string,
): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  const message =
    `Hi ${recipientName}! 🎁 ${senderName} sent you a gift. ` +
    `Tap the link to open your card: ${giftUrl}`;

  if (!accountSid || !authToken || !fromNumber) {
    console.log('[Delivery] Twilio not configured — would have sent SMS:');
    console.log(`  To: ${to}`);
    console.log(`  Message: ${message}`);
    return;
  }

  const client = twilio(accountSid, authToken);

  await client.messages.create({
    body: message,
    from: fromNumber,
    to,
  });

  console.log(`[Delivery] SMS sent to ${to}`);
}

// ─── Email ───────────────────────────────────────────────────────────────────

function buildEmailHtml(
  giftUrl: string,
  senderName: string,
  recipientName: string,
  brandName: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You have a gift from ${senderName}!</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #FBF8F3;
      font-family: Georgia, 'Times New Roman', serif;
      color: #2C1A0E;
    }
    .wrapper {
      max-width: 560px;
      margin: 40px auto;
      background-color: #FFFFFF;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .header {
      background-color: #FBF8F3;
      padding: 32px 40px 24px;
      text-align: center;
      border-bottom: 1px solid #EDE8E0;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: normal;
      color: #2C1A0E;
      letter-spacing: 0.02em;
    }
    .header .tagline {
      margin: 8px 0 0;
      font-size: 13px;
      color: #7A6652;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .body {
      padding: 40px;
      text-align: center;
    }
    .gift-icon {
      font-size: 56px;
      margin-bottom: 24px;
      display: block;
    }
    .body h2 {
      margin: 0 0 12px;
      font-size: 22px;
      font-weight: normal;
      color: #2C1A0E;
    }
    .body p {
      margin: 0 0 32px;
      font-size: 16px;
      line-height: 1.6;
      color: #4A3728;
    }
    .cta-button {
      display: inline-block;
      background-color: #C75A3F;
      color: #FFFFFF !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-size: 17px;
      letter-spacing: 0.03em;
      font-family: Georgia, serif;
    }
    .brand-note {
      margin: 28px 0 0;
      font-size: 14px;
      color: #7A6652;
    }
    .footer {
      background-color: #FBF8F3;
      padding: 24px 40px;
      text-align: center;
      border-top: 1px solid #EDE8E0;
    }
    .footer p {
      margin: 0;
      font-size: 12px;
      color: #9E8A78;
      line-height: 1.6;
    }
    .footer a {
      color: #C75A3F;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Olive</h1>
      <p class="tagline">Thoughtful digital gifts</p>
    </div>
    <div class="body">
      <span class="gift-icon">🎁</span>
      <h2>Hi ${recipientName},</h2>
      <p>
        <strong>${senderName}</strong> sent you a <strong>${brandName}</strong> gift card!<br />
        Open your personalised card to reveal your gift.
      </p>
      <a href="${giftUrl}" class="cta-button">Open Your Gift</a>
      <p class="brand-note">
        Your card is waiting — tap the button above to open it.
      </p>
    </div>
    <div class="footer">
      <p>
        This gift was sent via <a href="${process.env.FRONTEND_URL ?? 'https://sendolive.com'}">Olive</a>.<br />
        If you did not expect this, you may safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendEmail(
  to: string,
  giftUrl: string,
  senderName: string,
  recipientName: string,
  brandName: string,
): Promise<void> {
  const fromEmail = process.env.FROM_EMAIL ?? 'noreply@sendolive.com';

  const mailOptions = {
    from: `"Olive" <${fromEmail}>`,
    to,
    subject: `${senderName} sent you a ${brandName} gift! 🎁`,
    text:
      `Hi ${recipientName},\n\n` +
      `${senderName} sent you a ${brandName} gift card via Olive.\n\n` +
      `Open your personalised card here:\n${giftUrl}\n\n` +
      `— Olive`,
    html: buildEmailHtml(giftUrl, senderName, recipientName, brandName),
  };

  // Check for SMTP or SendGrid configuration
  const smtpHost = process.env.SMTP_HOST;
  const sendgridKey = process.env.SENDGRID_API_KEY;

  if (!smtpHost && !sendgridKey) {
    console.log('[Delivery] Email transport not configured — would have sent email:');
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${mailOptions.subject}`);
    console.log(`  Gift URL: ${giftUrl}`);
    return;
  }

  let transporter: nodemailer.Transporter;

  if (sendgridKey) {
    transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: sendgridKey,
      },
    });
  } else {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS ?? '',
          }
        : undefined,
    });
  }

  await transporter.sendMail(mailOptions);
  console.log(`[Delivery] Email sent to ${to}`);
}
