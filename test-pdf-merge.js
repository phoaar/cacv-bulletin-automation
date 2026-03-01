'use strict';

const fs = require('fs');
const path = require('path');
const { mergePdfs } = require('./src/pdf');

async function testMerge() {
  console.log('Testing Multiple PDF merge logic...');
  
  try {
    const { PDFDocument } = require('pdf-lib');
    console.log('✓ pdf-lib is available');
    
    // Create three tiny PDFs to merge
    const pdf1 = await PDFDocument.create();
    pdf1.addPage([600, 400]).drawText('Main Bulletin');
    const buf1 = Buffer.from(await pdf1.save());
    
    const pdf2 = await PDFDocument.create();
    pdf2.addPage([600, 400]).drawText('Flyer A');
    const buf2 = Buffer.from(await pdf2.save());

    const pdf3 = await PDFDocument.create();
    pdf3.addPage([600, 400]).drawText('Flyer B');
    const buf3 = Buffer.from(await pdf3.save());
    
    // Merge main with an array of attachments
    const merged = await mergePdfs(buf1, [buf2, buf3]);
    
    // Load back to check page count
    const resultPdf = await PDFDocument.load(merged);
    const pageCount = resultPdf.getPageCount();
    
    console.log(`✓ Result has ${pageCount} pages (Expected 3)`);
    
    if (pageCount === 3) {
      console.log(`✓ Multi-merge successful. Result size: ${merged.length} bytes`);
    } else {
      throw new Error(`Expected 3 pages, but got ${pageCount}`);
    }
    
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testMerge();
}
