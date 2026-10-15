"use client";

const MAX_PDF_PAGES = 4;
const MAX_PAGE_WIDTH = 1400;

export async function pdfFileToImageDataUrls(file: File, maxPages = MAX_PDF_PAGES): Promise<string[]> {
  if (typeof window === "undefined") throw new Error("PDF 转图片只能在浏览器中执行。");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdfDocument = await pdfjs.getDocument({ data: bytes }).promise;
  const count = Math.min(pdfDocument.numPages, Math.max(1, maxPages));
  const images: string[] = [];

  for (let pageNumber = 1; pageNumber <= count; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, MAX_PAGE_WIDTH / Math.max(baseViewport.width, 1));
    const viewport = page.getViewport({ scale });

    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("浏览器无法创建 PDF 页面画布。");

    await page.render({ canvas, canvasContext: context, viewport }).promise;
    images.push(canvas.toDataURL("image/jpeg", 0.82));
    page.cleanup();
  }

  if (!images.length) throw new Error("PDF 中没有可读取的页面。");
  return images;
}
