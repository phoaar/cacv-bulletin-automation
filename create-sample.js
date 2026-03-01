'use strict';

const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

async function createSamplePdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const text = 'Sample CACV Attachment';
  const fontSize = 30;
  const textWidth = font.widthOfTextAtSize(text, fontSize);

  page.drawText(text, {
    x: (width - textWidth) / 2,
    y: height - 100,
    size: fontSize,
    font: font,
    color: rgb(0.24, 0.29, 0.16), // Moss Green (#3D4A2A)
  });

  page.drawText('This is a test document for the Bulletin Automation system.', {
    x: 50,
    y: height - 160,
    size: 14,
    color: rgb(0.5, 0.5, 0.5),
  });

  page.drawRectangle({
    x: 50,
    y: 50,
    width: width - 100,
    height: height - 250,
    borderColor: rgb(0.55, 0.65, 0.77), // Slate (#8BA5C4)
    borderWidth: 2,
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('sample-attachment.pdf', pdfBytes);
  console.log('✓ Created sample-attachment.pdf');
}

createSamplePdf().catch(console.error);
