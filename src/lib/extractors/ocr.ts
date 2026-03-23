export async function recognizeCanvasText(
  canvas: HTMLCanvasElement,
  language = 'eng',
): Promise<string> {
  const { recognize } = await import('tesseract.js');
  const result = await recognize(canvas, language);
  return result.data.text.replace(/\s+/g, ' ').trim();
}
