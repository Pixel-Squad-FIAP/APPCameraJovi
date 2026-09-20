import { getCombinedDocumentText, getDocumentPages, getPageText } from './documentModel.js';

function getDocumentTitle(documentCapture) {
  if (documentCapture?.title?.trim()) return documentCapture.title.trim();
  if (documentCapture?.source === 'created') return 'Documento criado';
  return 'Documento JOVI';
}

function getDocumentText(documentCapture) {
  return getCombinedDocumentText(documentCapture);
}

function createSafeFileName(title) {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'documento-jovi';
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportDocumentAsDocx(documentCapture) {
  const {
    Document,
    ImageRun,
    Packer,
    Paragraph,
    TextRun
  } = await import('docx');

  const title = getDocumentTitle(documentCapture);
  const documentText = getDocumentText(documentCapture) || 'Nenhum texto reconhecido.';
  const summary = documentCapture?.summary || 'Resumo ainda não gerado.';
  const annotation = documentCapture?.annotation || 'Sem anotação.';
  const pages = getDocumentPages(documentCapture);

  const createSection = (heading, body) => [
    new Paragraph({
      children: [new TextRun({ bold: true, text: heading })],
      spacing: { after: 120, before: 240 }
    }),
    ...String(body)
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => new Paragraph({
        children: [new TextRun(line)],
        spacing: { after: 80 }
      }))
  ];

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          children: [new TextRun({ bold: true, size: 32, text: title })],
          spacing: { after: 240 }
        }),
        ...(await createImageParagraphs(pages)),
        ...createSection('Texto reconhecido/corrigido', documentText),
        ...createSection('Resumo', summary),
        ...createSection('Anotação', annotation)
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${createSafeFileName(title)}.docx`;

  if (navigator.canShare && navigator.share) {
    const file = new File([blob], fileName, {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title
      });
      return { fileName, shared: true };
    }
  }

  downloadBlob(blob, fileName);
  return { fileName, shared: false };
}

async function createImageParagraphs(pages) {
  const imagePages = pages.filter((page) => page.processedBlob || page.rectifiedBlob || page.blob);
  const children = [];

  for (let index = 0; index < imagePages.length; index += 1) {
    const page = imagePages[index];
    const blob = page.processedBlob || page.rectifiedBlob || page.blob;
    const buffer = await blob.arrayBuffer();
    const ratio = (page.width && page.height) ? page.width / page.height : 0.72;
    const width = 420;
    children.push(
      new Paragraph({
        children: [new TextRun({ bold: true, text: `Página ${index + 1}` })],
        spacing: { after: 120, before: 160 }
      }),
      new Paragraph({
        children: [
          new ImageRun({
            data: buffer,
            transformation: {
              height: Math.round(width / Math.max(0.2, ratio)),
              width
            },
            type: 'jpg'
          })
        ],
        spacing: { after: 160 }
      })
    );
  }

  return children;
}

export async function exportDocumentAsPdf(documentCapture, { study = false } = {}) {
  const { jsPDF } = await import('jspdf');
  const title = getDocumentTitle(documentCapture);
  const pages = getDocumentPages(documentCapture);
  const fileName = `${createSafeFileName(title)}.pdf`;
  let pdf = null;

  if (!study && pages.length > 0) {
    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      const blob = page.processedBlob || page.rectifiedBlob || page.blob;
      if (!blob) continue;
      const dataUrl = await blobToDataUrl(blob);
      const width = page.width || 800;
      const height = page.height || 1100;
      const orientation = width > height ? 'landscape' : 'portrait';
      if (!pdf) {
        pdf = new jsPDF({ orientation, unit: 'pt', format: [width, height] });
      } else {
        pdf.addPage([width, height], orientation);
      }
      pdf.addImage(dataUrl, 'JPEG', 0, 0, width, height);
    }
  }

  if (!pdf) {
    pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    writePdfText(pdf, title, [
      ['Texto', getCombinedDocumentText(documentCapture) || 'Nenhum texto reconhecido.'],
      ['Resumo', documentCapture?.summary || 'Resumo ainda não gerado.'],
      ['Anotação', documentCapture?.annotation || 'Sem anotação.']
    ]);
  } else if (study) {
    pdf.addPage('a4', 'portrait');
    writePdfText(pdf, title, [
      ['Texto', getCombinedDocumentText(documentCapture) || 'Nenhum texto reconhecido.'],
      ['Resumo', documentCapture?.summary || 'Resumo ainda não gerado.'],
      ['Anotação', documentCapture?.annotation || 'Sem anotação.']
    ]);
  }

  const blob = pdf.output('blob');
  if (navigator.canShare && navigator.share) {
    const file = new File([blob], fileName, { type: 'application/pdf' });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return { fileName, shared: true };
    }
  }

  downloadBlob(blob, fileName);
  return { fileName, shared: false };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Não foi possível preparar a imagem para PDF.'));
    reader.readAsDataURL(blob);
  });
}

function writePdfText(pdf, title, sections) {
  const margin = 42;
  const maxWidth = 512;
  let y = 54;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(title, margin, y);
  y += 30;

  sections.forEach(([heading, body]) => {
    if (y > 740) {
      pdf.addPage();
      y = 54;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(heading, margin, y);
    y += 18;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    const lines = pdf.splitTextToSize(String(body || ''), maxWidth);
    lines.forEach((line) => {
      if (y > 780) {
        pdf.addPage();
        y = 54;
      }
      pdf.text(line, margin, y);
      y += 14;
    });
    y += 12;
  });
}
