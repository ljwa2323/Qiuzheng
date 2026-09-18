import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractText, getDocumentProxy } from 'unpdf';

export type PdfToMarkdownResult = {
  markdown: string;
  pageCount: number;
  charCount: number;
  engine: 'pymupdf4llm' | 'unpdf';
};

function collapseWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function pageToMarkdown(pageText: string, pageNumber: number, totalPages: number): string {
  const cleaned = collapseWhitespace(pageText);
  if (!cleaned) return '';
  const heading = totalPages > 1 ? `## Page ${pageNumber}\n\n` : '';
  return `${heading}${cleaned}`;
}

function resolvePythonBin(): string {
  return process.env.QIUZHENG_PYTHON || process.env.PYTHON || 'python';
}

async function resolvePdfScript(): Promise<string | null> {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '../../scripts/pdf_to_markdown.py'),
    join(process.cwd(), 'apps/api/scripts/pdf_to_markdown.py'),
    join(process.cwd(), 'scripts/pdf_to_markdown.py'),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

function runProcess(command: string, args: string[], opts?: { cwd?: string }): Promise<{ code: number; stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts?.cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    child.stdout.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => errChunks.push(Buffer.from(chunk)));
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(chunks),
        stderr: Buffer.concat(errChunks).toString('utf8'),
      });
    });
  });
}

async function pdfViaPyMuPdf4Llm(buffer: Buffer, opts?: { title?: string }): Promise<PdfToMarkdownResult | null> {
  const script = await resolvePdfScript();
  if (!script) return null;
  const dir = await mkdtemp(join(tmpdir(), 'qiuzheng-pdf-'));
  const pdfPath = join(dir, 'input.pdf');
  try {
    await writeFile(pdfPath, buffer);
    const python = resolvePythonBin();
    const args = [script, pdfPath];
    const title = String(opts?.title || '').trim();
    if (title) args.push('--title', title);
    const result = await runProcess(python, args);
    if (result.code !== 0) {
      return null;
    }
    const markdown = collapseWhitespace(result.stdout.toString('utf8'));
    if (!markdown) return null;
    const pageMarks = markdown.match(/^##\s+/gm);
    return {
      markdown,
      pageCount: pageMarks?.length || 1,
      charCount: markdown.length,
      engine: 'pymupdf4llm',
    };
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function pdfViaUnpdf(buffer: Buffer, opts?: { title?: string }): Promise<PdfToMarkdownResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const extracted = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(extracted.text) ? extracted.text.map(String) : [String(extracted.text || '')];
  const pageCount = extracted.totalPages || pages.length;
  const body = pages
    .map((pageText, index) => pageToMarkdown(pageText, index + 1, pageCount))
    .filter(Boolean)
    .join('\n\n');

  const title = String(opts?.title || '').trim();
  const markdown = collapseWhitespace(
    [title ? `# ${title}` : '', body].filter(Boolean).join('\n\n'),
  );

  return {
    markdown,
    pageCount,
    charCount: markdown.length,
    engine: 'unpdf',
  };
}

/**
 * Convert PDF to Markdown for AI pipelines.
 * Prefers PyMuPDF4LLM (better tables); falls back to unpdf when Python/deps unavailable.
 */
export async function pdfBufferToMarkdown(
  buffer: Buffer,
  opts?: { title?: string },
): Promise<PdfToMarkdownResult> {
  const preferred = await pdfViaPyMuPdf4Llm(buffer, opts);
  if (preferred?.markdown.trim()) return preferred;
  return pdfViaUnpdf(buffer, opts);
}

/** Test helper: force writing a tiny PDF via the active converter path. */
export async function pdfBufferToMarkdownForceUnpdf(
  buffer: Buffer,
  opts?: { title?: string },
): Promise<PdfToMarkdownResult> {
  return pdfViaUnpdf(buffer, opts);
}
