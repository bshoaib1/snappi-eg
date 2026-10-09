const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[character]!));

export const emailLayout = ({ eyebrow, heading, intro, rows = [], action }: {
  eyebrow: string;
  heading: string;
  intro: string;
  rows?: Array<[string, string]>;
  action?: { label: string; url: string };
}) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>${escapeHtml(heading)}</title></head><body style="margin:0;background-color:#f4f4f1;font-family:Arial,Helvetica,sans-serif;color:#000000"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#f4f4f1"><tr><td align="center" style="padding-top:32px;padding-right:16px;padding-bottom:32px;padding-left:16px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#fefffc;border-width:1px;border-style:solid;border-color:#d7d7d2;border-radius:20px"><tr><td bgcolor="#8116e0" style="padding-top:18px;padding-right:28px;padding-bottom:18px;padding-left:28px;background-color:#8116e0;border-top-left-radius:20px;border-top-right-radius:20px"><img src="https://raw.githubusercontent.com/bshoaib1/snappi-eg/main/assets/snappi-email-logo.png" width="180" height="60" border="0" alt="Snappi EG" style="display:block;width:180px;height:60px"></td></tr><tr><td style="padding-top:30px;padding-right:28px;padding-bottom:32px;padding-left:28px"><p style="margin-top:0;margin-right:0;margin-bottom:12px;margin-left:0;font-size:13px;line-height:20px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8116e0">${escapeHtml(eyebrow)}</p><h1 style="margin-top:0;margin-right:0;margin-bottom:16px;margin-left:0;font-size:30px;line-height:36px;font-weight:800;color:#000000">${escapeHtml(heading)}</h1><p style="margin-top:0;margin-right:0;margin-bottom:22px;margin-left:0;font-size:16px;line-height:26px;color:#222222">${escapeHtml(intro)}</p>${rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-top-width:1px;border-top-style:solid;border-top-color:#deded8">${rows.map(([label, value]) => `<tr><td style="padding-top:10px;padding-right:10px;padding-bottom:10px;padding-left:0;font-size:13px;line-height:20px;font-weight:700;color:#666666;border-bottom-width:1px;border-bottom-style:solid;border-bottom-color:#deded8">${escapeHtml(label)}</td><td align="right" style="padding-top:10px;padding-right:0;padding-bottom:10px;padding-left:10px;font-size:14px;line-height:20px;color:#000000;border-bottom-width:1px;border-bottom-style:solid;border-bottom-color:#deded8">${escapeHtml(value)}</td></tr>`).join("")}</table>` : ""}${action ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px"><tr><td bgcolor="#d4ff3a" style="background-color:#d4ff3a;border-radius:999px"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding-top:13px;padding-right:22px;padding-bottom:13px;padding-left:22px;font-size:15px;line-height:20px;font-weight:700;color:#000000;text-decoration:none">${escapeHtml(action.label)}</a></td></tr></table>` : ""}<p style="margin-top:26px;margin-right:0;margin-bottom:0;margin-left:0;font-size:12px;line-height:19px;color:#666666">This is an automated Snappi message. For help, reply to this email or contact support@snappi-eg.com.</p></td></tr></table></td></tr></table></body></html>`;

export async function sendEmail({ to, subject, html, text, replyTo = "support@snappi-eg.com", idempotencyKey }: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
}) {
  // Supabase secret names are case-sensitive. Support both conventional uppercase
  // names and lowercase names created through dashboards that normalize input.
  const apiKey = Deno.env.get("RESEND_API_KEY") || Deno.env.get("resend_api_key");
  if (!apiKey) throw new Error("Transactional email is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    body: JSON.stringify({
      from: "Snappi <notifications@updates.snappi-eg.com>",
      to: Array.isArray(to) ? to : [to],
      reply_to: replyTo,
      subject,
      html,
      text
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email delivery failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return await response.json();
}
