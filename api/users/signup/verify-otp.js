const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://movymmlayggqzjtunlfk.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vdnltbWxheWdncXpqdHVubGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxNjY1MDYsImV4cCI6MjEwODc0MjUwNn0.wnYGxn8vr3EvMMVe__qeTrurkLmCP2-5UsqKA9y9tLw';

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

  const { email, code } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    // Query most recent unexpired, unused OTP from Supabase
    const { data, error } = await supabase
      .from('signup_otps')
      .select('id, expires_at')
      .eq('email', cleanEmail)
      .eq('code', cleanCode)
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Supabase query error:', error);
      return res.status(500).json({ error: 'Database verification error' });
    }

    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    const otpRecord = data[0];
    if (new Date(otpRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired' });
    }

    // Mark as used
    await supabase.from('signup_otps').update({ is_used: true }).eq('id', otpRecord.id);

    return res.status(200).json({ success: true, message: 'OTP verified successfully' });
  } catch (err) {
    console.error('Error verifying OTP:', err);
    return res.status(500).json({ error: err.message || 'Failed to verify OTP' });
  }
};
