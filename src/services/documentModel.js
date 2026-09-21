export function createDocumentPageId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getDocumentPages(capture) {
  if (Array.isArray(capture?.pages) && capture.pages.length > 0) {
    return capture.pages;
  }

  if (capture?.kind === 'document' && capture.blob) {
    return [{
      id: capture.pageId || 'page-1',
      blob: capture.blob,
      corners: capture.corners || null,
      documentText: capture.documentText || '',
      height: capture.height,
      mimeType: capture.mimeType,
      ocrConfidence: capture.ocrConfidence,
      ocrError: capture.ocrError,
      ocrLanguage: capture.ocrLanguage,
      ocrProcessedAt: capture.ocrProcessedAt,
      ocrStatus: capture.ocrStatus || 'pending',
      ocrText: capture.ocrText || '',
      processedBlob: capture.processedBlob || null,
      rectifiedBlob: capture.rectifiedBlob || capture.blob,
      sourceHeight: capture.sourceHeight || capture.height,
      sourceWidth: capture.sourceWidth || capture.width,
      width: capture.width
    }];
  }

  return [];
}

export function getPageText(page) {
  return page?.documentText ?? page?.ocrText ?? '';
}

export function getCombinedDocumentText(capture) {
  const pages = getDocumentPages(capture);
  if (pages.length > 0) {
    return pages
      .map((page, index) => {
        const text = getPageText(page).trim();
        return text ? `Página ${index + 1}\n${text}` : '';
      })
      .filter(Boolean)
      .join('\n\n');
  }

  return capture?.documentText ?? capture?.ocrText ?? '';
}

export function getPrimaryDocumentBlob(capture) {
  const firstPage = getDocumentPages(capture)[0];
  return firstPage?.processedBlob || firstPage?.rectifiedBlob || firstPage?.blob || capture?.processedBlob || capture?.blob || null;
}

export function replaceDocumentPage(capture, pageId, patch) {
  const pages = getDocumentPages(capture);
  const nextPages = pages.map((page) => (
    page.id === pageId ? { ...page, ...patch } : page
  ));
  const firstPage = nextPages[0] || {};

  return {
    pages: nextPages,
    blob: firstPage.blob || capture.blob,
    documentText: getCombinedTextFromPages(nextPages),
    height: firstPage.height || capture.height,
    mimeType: firstPage.mimeType || capture.mimeType,
    ocrConfidence: firstPage.ocrConfidence,
    ocrStatus: getAggregateOcrStatus(nextPages),
    ocrText: getCombinedOcrTextFromPages(nextPages),
    processedBlob: firstPage.processedBlob || capture.processedBlob,
    updatedAt: new Date().toISOString(),
    width: firstPage.width || capture.width
  };
}

export function appendDocumentPage(capture, page) {
  const pages = [...getDocumentPages(capture), page];
  return {
    pages,
    documentText: getCombinedTextFromPages(pages),
    ocrStatus: getAggregateOcrStatus(pages),
    ocrText: getCombinedOcrTextFromPages(pages),
    updatedAt: new Date().toISOString()
  };
}

function getCombinedTextFromPages(pages) {
  return pages.map(getPageText).filter((text) => text.trim()).join('\n\n');
}

function getCombinedOcrTextFromPages(pages) {
  return pages.map((page) => page.ocrText || '').filter((text) => text.trim()).join('\n\n');
}

function getAggregateOcrStatus(pages) {
  if (pages.some((page) => page.ocrStatus === 'processing')) return 'processing';
  if (pages.length > 0 && pages.every((page) => page.ocrStatus === 'done')) return 'done';
  if (pages.some((page) => page.ocrStatus === 'error')) return 'error';
  return 'pending';
}
