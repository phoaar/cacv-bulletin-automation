'use strict';

require('dotenv').config();
const { getAccessToken } = require('./src/google-auth');

async function checkSheet() {
  const sheetId = process.env.SHEET_ID;
  const credPath = process.env.CREDENTIALS_PATH;
  const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

  try {
    const token = await getAccessToken(credPath, scopes);
    const range = "'📋 Service Details'!A:C";
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
    
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
