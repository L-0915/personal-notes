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
} from 'docx';

type MdToken = ReturnType<MarkdownIt['parse']>[number];

// Shared markdown-it instance for export (same config as preview)
const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: true });
md.use(footnote).use(taskLists).use(emoji).use(katex);

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
  const children: Paragraph[] = [];

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

    if (token.type === 'table_open') {
      const tableResult = parseTable(tokens, i);
      i = tableResult.nextIndex;
      children.push(...tableResult.paragraphs);
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

function inlineTokensToRuns(tokens: MdToken[]): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = [];

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
  runs: (TextRun | ExternalHyperlink)[][];
  nextIndex: number;
}

function parseListItems(tokens: MdToken[], startIdx: number, closeType: string): ListParseResult {
  const items: (TextRun | ExternalHyperlink)[][] = [];
  let i = startIdx + 1; // skip list_open

  while (i < tokens.length && tokens[i].type !== closeType) {
    if (tokens[i].type === 'list_item_open') {
      i++; // skip list_item_open
      const itemRuns: (TextRun | ExternalHyperlink)[] = [];
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
  paragraphs: Paragraph[];
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
          // Collect cell content
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

  // Convert rows to paragraphs (simple approach: tab-separated for now)
  const paragraphs: Paragraph[] = [];
  for (const row of rows) {
    const runs: TextRun[] = [];
    for (let c = 0; c < row.length; c++) {
      if (c > 0) runs.push(new TextRun({ text: '  |  ' }));
      runs.push(new TextRun({ text: row[c] }));
    }
    paragraphs.push(new Paragraph({ children: runs, spacing: { after: 40 } }));
  }

  return { paragraphs, nextIndex: i };
}
