function getDocumentTitle(documentCapture) {
  if (documentCapture?.title?.trim()) return documentCapture.title.trim();
  if (documentCapture?.source === 'created') return 'Documento criado';
  return 'Documento JOVI';
}

function getDocumentText(documentCapture) {
  return documentCapture?.documentText || documentCapture?.ocrText || '';
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
    Packer,
    Paragraph,
    TextRun
  } = await import('docx');

  const title = getDocumentTitle(documentCapture);
  const documentText = getDocumentText(documentCapture) || 'Nenhum texto reconhecido.';
  const summary = documentCapture?.summary || 'Resumo ainda não gerado.';
  const annotation = documentCapture?.annotation || 'Sem anotação.';

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
