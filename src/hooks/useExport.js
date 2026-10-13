import { useCallback, useMemo } from 'react';
import { formatLongDate, slugify } from '../lib/format.js';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function extensionFor(mimeType) {
  if (mimeType?.includes('mp4')) return 'mp4';
  if (mimeType?.includes('webm')) return 'webm';
  if (mimeType?.includes('png')) return 'png';
  return 'jpg';
}

export function buildPlainText(capture) {
  const sections = [capture.title, `Capturado em ${formatLongDate(capture.createdAt)} · Álbum: ${capture.album}`];
  if (capture.summary?.sentences?.length) {
    sections.push(`RESUMO\n${capture.summary.sentences.map((sentence) => `• ${sentence}`).join('\n')}`);
  }
  if (capture.text) sections.push(`TEXTO EXTRAÍDO\n${capture.text}`);
  if (capture.notes) sections.push(`ANOTAÇÕES\n${capture.notes}`);
  return sections.join('\n\n');
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  textarea.remove();
  if (!ok) throw new Error('Não foi possível copiar.');
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function buildPdf(capture, mediaBlob) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 16;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (height) => {
    if (y + height > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeParagraph = (text, { size = 11, style = 'normal', gap = 5 } = {}) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    const lineHeight = size * 0.45;
    doc.splitTextToSize(text, contentWidth).forEach((line) => {
      ensureSpace(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    });
    y += gap;
  };

  writeParagraph(capture.title, { size: 16, style: 'bold', gap: 2 });
  writeParagraph(`${formatLongDate(capture.createdAt)} · Álbum: ${capture.album}`, { size: 9, gap: 6 });

  if (capture.kind === 'photo' && mediaBlob) {
    const dataUrl = await blobToDataUrl(mediaBlob);
    const ratio = capture.height / capture.width || 0.75;
    const width = Math.min(contentWidth, (pageHeight - margin * 2) * 0.55 / ratio);
    const height = width * ratio;
    ensureSpace(height);
    doc.addImage(dataUrl, 'JPEG', margin + (contentWidth - width) / 2, y, width, height);
    y += height + 8;
  }

  if (capture.summary?.sentences?.length) {
    writeParagraph('Resumo', { size: 12, style: 'bold', gap: 2 });
    capture.summary.sentences.forEach((sentence) => writeParagraph(`• ${sentence}`, { gap: 1.5 }));
    y += 4;
  }
  if (capture.text) {
    writeParagraph('Texto extraído', { size: 12, style: 'bold', gap: 2 });
    capture.text.split('\n\n').forEach((paragraph) => writeParagraph(paragraph, { gap: 3 }));
  }
  if (capture.notes) {
    writeParagraph('Anotações', { size: 12, style: 'bold', gap: 2 });
    writeParagraph(capture.notes);
  }

  return doc.output('blob');
}

// Ações de exportação reais: arquivos baixados no aparelho, área de transferência e compartilhamento nativo.
export function useExport() {
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const exportPdf = useCallback(async (capture, mediaBlob) => {
    const blob = await buildPdf(capture, mediaBlob);
    downloadBlob(blob, `${slugify(capture.title)}.pdf`);
  }, []);

  const exportText = useCallback((capture) => {
    const blob = new Blob([buildPlainText(capture)], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${slugify(capture.title)}.txt`);
  }, []);

  const exportMedia = useCallback((capture, mediaBlob) => {
    downloadBlob(mediaBlob, `${slugify(capture.title)}.${extensionFor(capture.mimeType)}`);
  }, []);

  const copyText = useCallback((text) => copyToClipboard(text), []);

  const share = useCallback(async (capture, mediaBlob) => {
    const text = buildPlainText(capture);
    const file = mediaBlob
      ? new File([mediaBlob], `${slugify(capture.title)}.${extensionFor(capture.mimeType)}`, { type: mediaBlob.type })
      : null;
    const data = file && navigator.canShare?.({ files: [file] })
      ? { title: capture.title, text, files: [file] }
      : { title: capture.title, text };
    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return false;
      throw error;
    }
  }, []);

  // Sem integração falsa: copia o conteúdo e abre um documento novo do Google Docs para colar.
  const openInGoogleDocs = useCallback(async (capture) => {
    await copyToClipboard(buildPlainText(capture));
    window.open('https://docs.new', '_blank', 'noopener');
  }, []);

  return useMemo(() => ({ canShare, exportPdf, exportText, exportMedia, copyText, share, openInGoogleDocs }),
    [canShare, exportPdf, exportText, exportMedia, copyText, share, openInGoogleDocs]);
}
