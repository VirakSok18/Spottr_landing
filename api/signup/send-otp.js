const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://movymmlayggqzjtunlfk.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vdnltbWxheWdncXpqdHVubGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxNjY1MDYsImV4cCI6MjEwODc0MjUwNn0.wnYGxn8vr3EvMMVe__qeTrurkLmCP2-5UsqKA9y9tLw';

const EMAIL_USER = process.env.EMAIL_USER || 'spottrnoreply@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'nzqnwyhpqvennzbf';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // 1. Invalidate any previous unused OTPs for this email in Supabase
    try {
      await supabase
        .from('signup_otps')
        .update({ is_used: true })
        .eq('email', cleanEmail)
        .eq('is_used', false);
    } catch (_) {}

    // 2. Insert fresh OTP record
    const { error: dbError } = await supabase.from('signup_otps').insert({
      email: cleanEmail,
      code,
      expires_at: expiresAt,
      is_used: false,
    });

    if (dbError) {
      console.error('Supabase DB error storing OTP:', dbError);
    }

    // 3. Send email using Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0b0f; color: #ffffff; padding: 40px 20px; text-align: center;">
        <h1 style="color: #B497FF; margin-bottom: 4px; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Spottr</h1>
        <p style="color: #9ca3af; font-size: 14px; margin-top: 0;">AI Fitness Coach & Workout Partner</p>
        <div style="background-color: #17171f; border-radius: 16px; padding: 32px 24px; margin: 28px auto; max-width: 440px; border: 1px solid #272732; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <p style="font-size: 15px; color: #e5e7eb; margin-bottom: 24px; line-height: 1.5;">Enter the following verification code in Spottr to complete your sign up:</p>
          <div style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #B497FF; padding: 18px 24px; background: rgba(180, 151, 255, 0.12); border: 1px solid rgba(180, 151, 255, 0.3); border-radius: 12px; display: inline-block;">
            ${code}
          </div>
          <p style="color: #6b7280; font-size: 13px; margin-top: 24px; line-height: 1.5;">This code will expire in 10 minutes.<br/>If you did not request this, please ignore this email.</p>
        </div>
        <p style="color: #4b5563; font-size: 12px; margin-top: 24px;">© 2026 Spottr Fitness. All rights reserved.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `Spottr <${EMAIL_USER}>`,
      to: cleanEmail,
      subject: `Your Spottr Verification Code: ${code}`,
      html: htmlContent,
      text: `Your Spottr verification code is: ${code}. It expires in 10 minutes.`,
    });

    console.log(`[Spottr] OTP ${code} successfully sent to ${cleanEmail}`);
    return res.status(200).json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error('Error sending OTP:', err);
    return res.status(500).json({ error: err.message || 'Failed to send OTP email' });
  }
};
