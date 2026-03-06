'use strict';

const config = require('../src/config');
const { getAccessToken } = require('../src/google-auth');

async function checkSheet() {
  const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

  try {
    const token = await getAccessToken(config.CREDENTIALS_PATH, scopes);
    const range = "'📋 Service Details'!A:C";
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.SHEET_ID}/values/${encodeURIComponent(range)}`;
    
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Unknown Error');

    console.log('--- 📋 Service Details Data ---');
    console.table(data.values);
    
    const attachments = (data.values || []).filter(r => {
      const label = (r[0] || '').trim().toLowerCase();
      return (label === 'pdf attachment url' || label === 'pdf attachment') && (r[1] || '').trim();
    });

    console.log('\n--- Detected Attachments ---');
    console.log(JSON.stringify(attachments, null, 2));

  } catch (err) {
    console.error('Check failed:', err.message);
  }
}

checkSheet();
