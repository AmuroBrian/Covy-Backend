const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vbmNqaXZlYXN3eGZoYWFjeHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTEyMjA1MjksImV4cCI6MjAyNjc5NjUyOX0.H2N2T9J7W_T3_UqO9T3X5U_zYx5T9J7W_T3_UqO9T3X5U');

async function run() {
  const email = `test+${Date.now()}@example.com`;
  console.log('Signing up:', email);
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: 'password123',
  });
  
  if (authError) {
    console.error('Supabase Error:', authError.message);
    return;
  }
  
  const token = authData.session.access_token;
  console.log('Got JWT Token:', token.substring(0, 20) + '...');
  
  // Encrypt payload if backend expects it
  const key = process.env.ENCRYPTION_KEY;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), iv);
  let enc = cipher.update('{}', 'utf8', 'base64');
  enc += cipher.final('base64');
  const tag = cipher.getAuthTag().toString('base64');
  const payloadStr = `${iv.toString('base64')}:${Buffer.concat([Buffer.from(enc, 'base64'), Buffer.from(tag, 'base64')]).toString('base64')}`;

  try {
    const res = await axios.post('http://localhost:3000/api/v1/auth/sync', {
      payload: payloadStr
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': process.env.FRONTEND_API_KEY,
        'x-encrypted-payload': 'true'
      }
    });
    console.log('Sync Success:', res.data);
  } catch (err) {
    console.error('Sync Error:', err.response?.data || err.message);
  }
}
run();
