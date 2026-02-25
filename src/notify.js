'use strict';

const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

/**
 * Returns true if email notifications are configured.
 */
function canSendEmail() {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

/**
 * Send a notification email to all addresses in the list.
 */
async function sendNotification({ to, subject, text, html }) {
  if (!canSendEmail()) {
    console.warn('Email notification skipped — GMAIL_USER or GMAIL_APP_PASSWORD not set.');
    return;
  }
  if (!to || to.length === 0) {
    console.warn('Email notification skipped — no notification emails configured in Settings tab.');
    return;
  }

  try {
    await getTransporter().sendMail({
      from: `"CACV Bulletin" <${process.env.GMAIL_USER}>`,
      to:   to.join(', '),
      subject,
      text,
      html,
    });
    console.log(`Notification sent to: ${to.join(', ')}`);
  } catch (err) {
    console.warn(`Failed to send notification email: ${err.message}`);
  }
}

/**
 * Send a failure notification listing all issues found.
 */
async function notifyFailures({ to, serviceDate, liveUrl, issues }) {
  const issueList = issues.map(i => `• ${i}`).join('\n');
  const issueListHtml = issues.map(i => `<li>${i}</li>`).join('\n');

  await sendNotification({
    to,
    subject: `⚠️ CACV Bulletin issues — ${serviceDate}`,
    text: [
      `The bulletin for ${serviceDate} was generated but has the following issues:`,
      '',
      issueList,
      '',
      `Please review the bulletin at: ${liveUrl}`,
      'Some content may still be in Chinese or missing. Update the sheet and regenerate if needed.',
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:600px;padding:24px;">
        <h2 style="color:#7C3C3C;margin-bottom:8px;">⚠️ Bulletin Issues — ${serviceDate}</h2>
        <p>The bulletin was generated but has the following issues:</p>
        <ul style="margin:12px 0;padding-left:20px;line-height:1.8;">
          ${issueListHtml}
        </ul>
        <p>Please <a href="${liveUrl}">review the bulletin</a> and update the sheet if needed, then regenerate.</p>
        <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
        <p style="color:#999;font-size:12px;">CACV Bulletin Automation</p>
      </div>
    `,
  });
}

/**
 * Send a success notification.
 */
async function notifySuccess({ to, serviceDate, liveUrl }) {
  await sendNotification({
    to,
    subject: `✓ CACV Bulletin is live — ${serviceDate}`,
    text: `The bulletin for ${serviceDate} has been published successfully.\n\nView it at: ${liveUrl}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;padding:24px;">
        <h2 style="color:#3D4A2A;margin-bottom:8px;">✓ Bulletin Live — ${serviceDate}</h2>
        <p>The bulletin has been published successfully.</p>
        <p><a href="${liveUrl}" style="color:#5C6B48;">View the bulletin →</a></p>
        <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
        <p style="color:#999;font-size:12px;">CACV Bulletin Automation</p>
      </div>
    `,
  });
}

module.exports = { notifyFailures, notifySuccess, canSendEmail };
