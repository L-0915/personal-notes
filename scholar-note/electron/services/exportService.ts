// electron/services/exportService.ts
// Export notes to PDF, DOCX, HTML, and Markdown

import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow } from 'electron';
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import { full as emoji } from 'markdown-it-emoji';
import katex from '@traptitech/markdown-it-katex';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, ExternalHyperlink,
  Table, TableRow, TableCell, WidthType,
  Math, MathRun, MathFraction, MathSuperScript, MathSubScript,
  MathSubSuperScript, MathRadical,
} from 'docx';

type MdToken = ReturnType<MarkdownIt['parse']>[number];

// Shared markdown-it instance for export (same config as preview)
const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: true });
md.use(footnote).use(taskLists).use(emoji).use(katex, {
  throwOnError: false,
  strict: false,
  trust: true,
});

// ---------------------------------------------------------------------------
// HTML Export
// ---------------------------------------------------------------------------

const EXPORT_CSS = `
body { font-family: 'Inter', -apple-system, 'Source Han Sans SC', 'Microsoft YaHei', sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; line-height: 1.7; color: #1f2328; }
h1 { font-size: 2em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
h3 { font-size: 1.25em; }
h4 { font-size: 1.1em; }
p { margin: 0.5em 0; }
ul, ol { padding-left: 2em; }
li { margin: 0.25em 0; }
code { background: #f6f8fa; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
pre code { background: none; padding: 0; }
blockquote { border-left: 4px solid #4A90D9; padding-left: 1em; color: #656d76; margin: 1em 0; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #d0d7de; padding: 8px 12px; text-align: left; }
th { background: #f6f8fa; font-weight: 600; }
img { max-width: 100%; }
a { color: #4A90D9; text-decoration: none; }
a:hover { text-decoration: underline; }
hr { border: none; border-top: 1px solid #d0d7de; margin: 1.5em 0; }
.katex-display { margin: 1em 0; }
`;

export function exportToHtml(markdown: string, title: string): string {
  const html = md.render(markdown);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>${EXPORT_CSS}</style>
</head>
<body>
${html}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Markdown Export
// ---------------------------------------------------------------------------

export function exportToMarkdown(markdown: string): string {
  return markdown;
}

// ---------------------------------------------------------------------------
// PDF Export — uses a hidden BrowserWindow to render HTML then printToPDF
// ---------------------------------------------------------------------------

export async function exportToPdf(htmlContent: string): Promise<Buffer> {
  const win = new BrowserWindow({
    width: 800,
    height: 1100,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      offscreen: true,
    },
  });

  try {
    // Load HTML content via data URL
    const encoded = encodeURIComponent(htmlContent);
    await win.loadURL(`data:text/html;charset=utf-8,${encoded}`);

    // Wait for rendering to settle (mermaid, katex, etc.)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const pdfData = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: {
        top: 72,    // 1 inch
        bottom: 72,
        left: 72,
        right: 72,
      },
    });

    return Buffer.from(pdfData);
  } finally {
    win.destroy();
  }
}

// ---------------------------------------------------------------------------
// DOCX Export — uses the docx package to create proper Word documents
// ---------------------------------------------------------------------------

export async function exportToDocx(markdown: string, title: string): Promise<Buffer> {
  const tokens = md.parse(markdown, {});
  const children: (Paragraph | Table)[] = [];

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === 'heading_open') {
      const level = parseInt(token.tag.slice(1), 10); // h1 → 1
      i++;
      const inline = tokens[i];
      i++; // skip heading_close
      i++;
      const runs = inlineTokensToRuns(inline.children || []);
      children.push(new Paragraph({
        children: runs,
        heading: headingLevel(level),
        spacing: { before: 240, after: 120 },
      }));
      continue;
    }

    if (token.type === 'paragraph_open') {
      i++;
      const inline = tokens[i];
      i++; // skip paragraph_close
      i++;
      const runs = inlineTokensToRuns(inline?.children || []);
      children.push(new Paragraph({ children: runs, spacing: { after: 120 } }));
      continue;
    }

    if (token.type === 'bullet_list_open') {
      const items = parseListItems(tokens, i, 'bullet_list_close');
      i = items.nextIndex;
      for (const itemRuns of items.runs) {
        children.push(new Paragraph({
          children: [new TextRun({ text: '•  ' }), ...itemRuns],
          spacing: { after: 40 },
          indent: { left: 720 },
        }));
      }
      continue;
    }

    if (token.type === 'ordered_list_open') {
      const items = parseListItems(tokens, i, 'ordered_list_close');
      i = items.nextIndex;
      let num = 1;
      for (const itemRuns of items.runs) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `${num}.  ` }), ...itemRuns],
          spacing: { after: 40 },
          indent: { left: 720 },
        }));
        num++;
      }
      continue;
    }

    if (token.type === 'code_block' || token.type === 'fence') {
      const code = token.content.split('\n');
      for (const line of code) {
        children.push(new Paragraph({
          children: [new TextRun({
            text: line || ' ',
            font: 'Consolas',
            size: 20,
          })],
          spacing: { after: 0 },
          shading: { type: 'clear' as unknown as undefined, fill: 'f6f8fa' },
        }));
      }
      i++;
      continue;
    }

    if (token.type === 'blockquote_open') {
      const blockContent: Paragraph[] = [];
      i++; // skip blockquote_open
      while (i < tokens.length && tokens[i].type !== 'blockquote_close') {
        if (tokens[i].type === 'paragraph_open') {
          i++;
          const inline = tokens[i];
          i++; // paragraph_close
          i++;
          const runs = inlineTokensToRuns(inline?.children || []);
          blockContent.push(new Paragraph({
            children: runs,
            spacing: { after: 80 },
            indent: { left: 720 },
            border: {
              left: { style: BorderStyle.SINGLE, size: 6, color: '4A90D9', space: 10 },
            },
          }));
        } else {
          i++;
        }
      }
      i++; // skip blockquote_close
      children.push(...blockContent);
      continue;
    }

    if (token.type === 'hr') {
      children.push(new Paragraph({
        children: [],
        spacing: { before: 200, after: 200 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'd0d7de' },
        },
      }));
      i++;
      continue;
    }

    if (token.type === 'math_block') {
      const mathElements = latexToMathRuns(token.content.trim());
      if (mathElements.length > 0) {
        children.push(new Paragraph({
          children: [new Math({ children: mathElements })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 120 },
        }));
      }
      i++;
      continue;
    }

    if (token.type === 'table_open') {
      const tableResult = parseTable(tokens, i);
      i = tableResult.nextIndex;
      children.push(tableResult.table);
      continue;
    }

    // Skip everything else
    i++;
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children: children.length > 0 ? children : [new Paragraph({ text: '' })],
    }],
    title: title,
  });

  return await Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function headingLevel(level: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  const map: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  };
  return map[level] ?? HeadingLevel.HEADING_2;
}

type InlineRun = TextRun | ExternalHyperlink | Math;

function inlineTokensToRuns(tokens: MdToken[]): InlineRun[] {
  const runs: InlineRun[] = [];

  for (const token of tokens) {
    if (token.type === 'text' || token.type === 'text_special') {
      runs.push(new TextRun({ text: token.content }));
    } else if (token.type === 'code_inline') {
      runs.push(new TextRun({
        text: token.content,
        font: 'Consolas',
        size: 20,
        shading: { type: 'clear' as unknown as undefined, fill: 'f6f8fa' },
      }));
    } else if (token.type === 'math_inline') {
      const mathElements = latexToMathRuns(token.content.trim());
      if (mathElements.length > 0) {
        runs.push(new Math({ children: mathElements }));
      }
    } else if (token.type === 'softbreak') {
      runs.push(new TextRun({ text: ' ', break: 1 }));
    } else if (token.type === 'hardbreak') {
      runs.push(new TextRun({ text: '', break: 1 }));
    } else if (token.type === 'strong_open') {
      // The next text token should be bold — we handle this through nesting
      // markdown-it flattens, so we need a different approach
      // For simplicity, we'll just output the text content
    } else if (token.type === 'em_open') {
      // Same for italic
    } else if (token.type === 'link_open') {
      // Handle links — capture href from next token
      const href = token.attrGet('href') ?? '';
      // Collect text until link_close
      const linkTokens: MdToken[] = [];
      const parentTokens = tokens;
      const idx = tokens.indexOf(token);
      for (let j = idx + 1; j < parentTokens.length && parentTokens[j].type !== 'link_close'; j++) {
        linkTokens.push(parentTokens[j]);
      }
      // Get text content of link
      let linkText = '';
      for (const lt of linkTokens) {
        if (lt.content) linkText += lt.content;
      }
      if (linkText && href) {
        runs.push(new ExternalHyperlink({
          children: [new TextRun({ text: linkText, style: 'Hyperlink' })],
          link: href,
        }));
      }
    } else if (token.type === 'link_close') {
      // Already handled in link_open
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text: '' })];
}

interface ListParseResult {
  runs: InlineRun[][];
  nextIndex: number;
}

function parseListItems(tokens: MdToken[], startIdx: number, closeType: string): ListParseResult {
  const items: InlineRun[][] = [];
  let i = startIdx + 1; // skip list_open

  while (i < tokens.length && tokens[i].type !== closeType) {
    if (tokens[i].type === 'list_item_open') {
      i++; // skip list_item_open
      const itemRuns: InlineRun[] = [];
      while (i < tokens.length && tokens[i].type !== 'list_item_close') {
        if (tokens[i].type === 'paragraph_open') {
          i++;
          const inline = tokens[i];
          i++; // paragraph_close
          i++;
          const runs = inlineTokensToRuns(inline?.children || []);
          itemRuns.push(...runs);
        } else {
          i++;
        }
      }
      i++; // skip list_item_close
      items.push(itemRuns);
    } else {
      i++;
    }
  }
  i++; // skip close

  return { runs: items, nextIndex: i };
}

interface TableParseResult {
  table: Table;
  nextIndex: number;
}

function parseTable(tokens: MdToken[], startIdx: number): TableParseResult {
  const rows: string[][] = [];
  let i = startIdx + 1; // skip table_open

  while (i < tokens.length && tokens[i].type !== 'table_close') {
    if (tokens[i].type === 'tr_open') {
      const row: string[] = [];
      i++; // skip tr_open
      while (i < tokens.length && tokens[i].type !== 'tr_close') {
        if (tokens[i].type === 'td_open' || tokens[i].type === 'th_open') {
          i++;
          let cellText = '';
          while (i < tokens.length && tokens[i].type !== 'td_close' && tokens[i].type !== 'th_close') {
            if (tokens[i].content) cellText += tokens[i].content;
            i++;
          }
          i++; // skip td_close/th_close
          row.push(cellText);
        } else {
          i++;
        }
      }
      i++; // skip tr_close
      rows.push(row);
    } else {
      i++;
    }
  }
  i++; // skip table_close

  const colCount = rows[0]?.length || 1;
  const colWidth = (9000 / colCount) | 0;
  const cellBorders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'auto' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'auto' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'auto' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'auto' },
  };

  const table = new Table({
    rows: rows.map((row, rowIdx) => new TableRow({
      children: row.map((cell) => new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: cell, bold: rowIdx === 0 })],
          spacing: { before: 40, after: 40 },
        })],
        width: { size: colWidth, type: WidthType.DXA },
        borders: cellBorders,
        shading: rowIdx === 0 ? { fill: 'f6f8fa' } : undefined,
      })),
    })),
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  return { table, nextIndex: i };
}

// ---------------------------------------------------------------------------
// LaTeX → docx Math converter
// ---------------------------------------------------------------------------

type MathElement = MathRun | MathFraction | MathSuperScript | MathSubScript | MathSubSuperScript | MathRadical | Math;

const GREEK_LETTERS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ',
  epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ',
  pi: 'π', varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ',
  sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ',
  phi: 'φ', varphi: 'ϕ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ',
  Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ',
  Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

const LATEX_SYMBOLS: Record<string, string> = {
  infty: '∞', pm: '±', mp: '∓', times: '×', cdot: '·',
  div: '÷', le: '≤', leq: '≤', ge: '≥', geq: '≥',
  ne: '≠', neq: '≠', approx: '≈', equiv: '≡', sim: '∼',
  simeq: '≃', ll: '≪', gg: '≫', partial: '∂', nabla: '∇',
  forall: '∀', exists: '∃', 'in': '∈', notin: '∉',
  subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇',
  cup: '∪', cap: '∩', emptyset: '∅', varnothing: '∅',
  therefore: '∴', because: '∵', ldots: '…', cdots: '⋯',
  vdots: '⋮', ddots: '⋱',
  to: '→', rightarrow: '→', leftarrow: '←', gets: '←',
  Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔',
 leftrightarrow: '↔', mapsto: '↦',
  leftharpoonup: '↼', leftharpoondown: '↽',
  rightharpoonup: '⇀', rightharpoondown: '⇁',
  quad: ' ', qquad: '  ',
  ',': ' ', ':': ' ', ';': ' ',
  '!': '', langle: '⟨', rangle: '⟩',
  lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉',
  vert: '|', Vert: '‖', '|': '‖',
  dag: '†', ddag: '‡', degree: '°',
  ell: 'ℓ', wp: '℘', Re: 'ℜ', Im: 'ℑ',
  aleph: 'ℵ', hbar: 'ℏ',
};

function latexToMathRuns(latex: string): MathElement[] {
  const parser = new LatexParser(latex.trim());
  return parser.parse();
}

class LatexParser {
  private pos = 0;
  private src: string;

  constructor(src: string) {
    this.src = src;
  }

  parse(): MathElement[] {
    return this.parseUntil('');
  }

  private parseUntil(endChar: string): MathElement[] {
    const elements: MathElement[] = [];
    while (this.pos < this.src.length) {
      if (endChar && this.src[this.pos] === endChar) break;

      const ch = this.src[this.pos];
      if (ch === '\\') {
        elements.push(this.parseCommand());
      } else if (ch === '^') {
        this.applySuperScript(elements);
      } else if (ch === '_') {
        this.applySubScript(elements);
      } else if (ch === '{') {
        this.pos++;
        const inner = this.parseUntil('}');
        this.pos++;
        elements.push(inner.length === 1 ? inner[0] : new Math({ children: inner }));
      } else if (ch === '}' || ch === '&') {
        break;
      } else if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
        this.pos++;
      } else {
        elements.push(new MathRun(ch));
        this.pos++;
      }
    }
    return elements;
  }

  private parseCommand(): MathElement {
    this.pos++; // skip '\'
    let cmd = '';
    while (this.pos < this.src.length && /[a-zA-Z]/.test(this.src[this.pos])) {
      cmd += this.src[this.pos];
      this.pos++;
    }

    if (cmd.length === 0 && this.pos < this.src.length) {
      const ch = this.src[this.pos];
      this.pos++;
      return new MathRun(ch);
    }

    if (GREEK_LETTERS[cmd]) return new MathRun(GREEK_LETTERS[cmd]);
    if (LATEX_SYMBOLS[cmd] !== undefined) return new MathRun(LATEX_SYMBOLS[cmd]);

    switch (cmd) {
      case 'frac': {
        const num = this.parseArg();
        const den = this.parseArg();
        return new MathFraction({ numerator: num, denominator: den });
      }
      case 'dfrac': {
        const num = this.parseArg();
        const den = this.parseArg();
        return new MathFraction({ numerator: num, denominator: den });
      }
      case 'sqrt': {
        let degree: MathElement[] | undefined;
        if (this.pos < this.src.length && this.src[this.pos] === '[') {
          this.pos++;
          degree = this.parseUntil(']');
          this.pos++;
        }
        const content = this.parseArg();
        return new MathRadical({ children: content, degree: degree || [] });
      }
      case 'sum': return new MathRun('∑');
      case 'prod': return new MathRun('∏');
      case 'coprod': return new MathRun('∐');
      case 'int': return new MathRun('∫');
      case 'iint': return new MathRun('∬');
      case 'iiint': return new MathRun('∭');
      case 'oint': return new MathRun('∮');
      case 'bigcup': return new MathRun('⋃');
      case 'bigcap': return new MathRun('⋂');
      case 'bigoplus': return new MathRun('⨁');
      case 'bigotimes': return new MathRun('⨂');
      case 'text':
      case 'mathrm':
      case 'textrm':
      case 'textbf':
      case 'textit': {
        if (this.pos < this.src.length && this.src[this.pos] === '{') {
          this.pos++;
          let text = '';
          let depth = 1;
          while (this.pos < this.src.length && depth > 0) {
            if (this.src[this.pos] === '{') depth++;
            else if (this.src[this.pos] === '}') { depth--; if (depth === 0) break; }
            text += this.src[this.pos];
            this.pos++;
          }
          this.pos++;
          return new MathRun(text);
        }
        return new MathRun('');
      }
      case 'left':
      case 'right':
      case 'bigl':
      case 'bigr':
      case 'Bigl':
      case 'Bigr':
      case 'biggl':
      case 'biggr':
      case 'big':
      case 'Big':
      case 'bigg':
      case 'Bigg': {
        if (this.pos < this.src.length) {
          if (this.src[this.pos] === '\\') {
            this.pos++;
            if (this.pos < this.src.length && !/[a-zA-Z]/.test(this.src[this.pos])) {
              const ch = this.src[this.pos];
              this.pos++;
              return new MathRun(ch);
            }
            let delimCmd = '';
            while (this.pos < this.src.length && /[a-zA-Z]/.test(this.src[this.pos])) {
              delimCmd += this.src[this.pos];
              this.pos++;
            }
            if (delimCmd === 'langle') return new MathRun('⟨');
            if (delimCmd === 'rangle') return new MathRun('⟩');
            if (delimCmd === 'lfloor') return new MathRun('⌊');
            if (delimCmd === 'rfloor') return new MathRun('⌋');
            if (delimCmd === 'lceil') return new MathRun('⌈');
            if (delimCmd === 'rceil') return new MathRun('⌉');
            return new MathRun('');
          }
          if (this.src[this.pos] === '.') { this.pos++; return new MathRun(''); }
          const ch = this.src[this.pos];
          this.pos++;
          return new MathRun(ch);
        }
        return new MathRun('');
      }
      case 'begin': {
        this.skipGroup();
        const content = this.parseUntil('\\');
        if (this.src.startsWith('end', this.pos)) {
          this.pos += 3;
          this.skipGroup();
        }
        return new Math({ children: content });
      }
      case 'overline':
      case 'underline':
      case 'hat':
      case 'vec':
      case 'bar':
      case 'dot':
      case 'ddot':
      case 'tilde':
      case 'widehat':
      case 'overrightarrow':
      case 'overleftarrow': {
        const arg = this.parseArg();
        return new Math({ children: arg });
      }
      case 'not': {
        const next = this.parseArg();
        return new Math({ children: [new MathRun('̸'), ...next] });
      }
      default:
        return new MathRun('\\' + cmd + ' ');
    }
  }

  private parseArg(): MathElement[] {
    if (this.pos < this.src.length && this.src[this.pos] === '{') {
      this.pos++;
      const inner = this.parseUntil('}');
      this.pos++;
      return inner;
    }
    if (this.pos < this.src.length) {
      if (this.src[this.pos] === '\\') return [this.parseCommand()];
      const ch = this.src[this.pos];
      this.pos++;
      return [new MathRun(ch)];
    }
    return [];
  }

  private applySuperScript(elements: MathElement[]): void {
    this.pos++;
    const superContent = this.parseArg();
    if (elements.length === 0) {
      elements.push(new MathSuperScript({ children: [new MathRun('')], superScript: superContent }));
      return;
    }
    const last = elements.pop()!;
    elements.push(new MathSuperScript({ children: [last], superScript: superContent }));
  }

  private applySubScript(elements: MathElement[]): void {
    this.pos++;
    const subContent = this.parseArg();
    if (elements.length === 0) {
      elements.push(new MathSubScript({ children: [new MathRun('')], subScript: subContent }));
      return;
    }
    const last = elements.pop()!;
    elements.push(new MathSubScript({ children: [last], subScript: subContent }));
  }

  private skipGroup(): void {
    if (this.pos < this.src.length && this.src[this.pos] === '{') {
      let depth = 1;
      this.pos++;
      while (this.pos < this.src.length && depth > 0) {
        if (this.src[this.pos] === '{') depth++;
        else if (this.src[this.pos] === '}') depth--;
        this.pos++;
      }
    }
  }
}
