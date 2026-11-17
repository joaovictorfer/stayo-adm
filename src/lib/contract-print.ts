/** Render the generated Word itself; no parallel set of contract clauses. */
export async function prepareContractPrint(blob: Blob) {
  const frame = document.createElement('iframe');
  frame.title = 'Contrato para impressão';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:1200px;border:0';
  document.body.appendChild(frame);
  try {
    const target = frame.contentDocument;
    if (!target) throw new Error('Não foi possível preparar a impressão.');
    const { renderAsync } = await import('docx-preview');
    await renderAsync(blob, target.body, target.head, {
      inWrapper: true, hideWrapperOnPrint: true, breakPages: true,
      ignoreLastRenderedPageBreak: true, renderHeaders: true, renderFooters: true,
      useBase64URL: true,
    });
    const datedParagraph = Array.from(target.querySelectorAll('article p')).find(p => /,\s*\d{1,2} de [\p{L}]+ de \d{4}\./u.test(p.textContent ?? ''));
    const article = datedParagraph?.closest('article');
    if (article && datedParagraph) {
      let start: Element = datedParagraph;
      while (start.parentElement && start.parentElement !== article) start = start.parentElement;
      if (start.parentElement === article) {
        const signatures = target.createElement('div');
        signatures.style.breakInside = 'avoid';
        article.insertBefore(signatures, start);
        while (signatures.nextSibling) signatures.appendChild(signatures.nextSibling);
      }
    }
    const css = target.createElement('style');
    css.textContent = '@page { size: A4; margin: 15mm; } @media print { html, body { margin: 0; } .docx-wrapper { padding: 0 !important; background: transparent !important; } section.docx { box-shadow: none !important; margin: 0 !important; padding: 0 !important; width: auto !important; min-height: 0 !important; height: auto !important; break-after: page; } section.docx:last-child { break-after: auto; } section.docx header { position: static !important; margin: 0 0 12pt !important; } section.docx footer { position: static !important; margin-top: 12pt !important; } tr { break-inside: avoid; } } * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }';
    target.head.appendChild(css);
    await target.fonts.ready;
    await Promise.all(Array.from(target.images, image => image.decode().catch(() => undefined)));
    return { print: () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); }, dispose: () => frame.remove() };
  } catch (error) { frame.remove(); throw error; }
}