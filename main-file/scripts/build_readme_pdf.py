from __future__ import annotations

import html
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
OUTPUT_DIR = ROOT / "output" / "pdf"
HTML_OUT = OUTPUT_DIR / "dzerp-client-guide.html"


def inline_markdown(text: str) -> str:
    text = html.escape(text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    return text


def render_blocks(lines: list[str]) -> str:
    parts: list[str] = []
    paragraph: list[str] = []
    bullets: list[str] = []

    def flush_paragraph() -> None:
        nonlocal paragraph
        if paragraph:
            parts.append(f"<p>{inline_markdown(' '.join(paragraph))}</p>")
            paragraph = []

    def flush_bullets() -> None:
        nonlocal bullets
        if bullets:
            items = "\n".join(f"<li>{inline_markdown(item)}</li>" for item in bullets)
            parts.append(f"<ul>{items}</ul>")
            bullets = []

    for raw in lines:
        line = raw.strip()
        if not line:
            flush_paragraph()
            flush_bullets()
            continue

        image = re.match(r"!\[(.*?)\]\((.*?)\)", line)
        if image:
            flush_paragraph()
            flush_bullets()
            alt = html.escape(image.group(1))
            image_path = (ROOT / image.group(2)).resolve()
            src = html.escape(image_path.as_uri())
            parts.append(
                "<figure>"
                f"<img src='{src}' alt='{alt}'>"
                f"<figcaption>{alt}</figcaption>"
                "</figure>"
            )
            continue

        if line.startswith("#"):
            flush_paragraph()
            flush_bullets()
            level = min(len(line) - len(line.lstrip("#")), 4)
            title = line[level:].strip()
            parts.append(f"<h{level}>{inline_markdown(title)}</h{level}>")
            continue

        if line.startswith("- "):
            flush_paragraph()
            bullets.append(line[2:].strip())
            continue

        paragraph.append(line)

    flush_paragraph()
    flush_bullets()
    return "\n".join(parts)


def render_image_pages(lines: list[str]) -> str:
    pages: list[str] = []
    pending: list[str] = []
    bullets: list[str] = []
    current_category = ""

    def flush_bullets() -> None:
        nonlocal bullets
        if bullets:
            items = "\n".join(f"<li>{inline_markdown(item)}</li>" for item in bullets)
            pending.append(f"<ul>{items}</ul>")
            bullets = []

    def push_paragraph(text: str) -> None:
        flush_bullets()
        pending.append(f"<p>{inline_markdown(text)}</p>")

    for raw in lines:
        line = raw.strip()
        if not line:
            flush_bullets()
            continue

        image = re.match(r"!\[(.*?)\]\((.*?)\)", line)
        if image:
            flush_bullets()
            alt_text = image.group(1)
            alt = html.escape(alt_text)
            image_path = (ROOT / image.group(2)).resolve()
            src = html.escape(image_path.as_uri())
            explanation = "\n".join(pending) if pending else "<p>لقطة توضيحية لهذه الميزة داخل النظام.</p>"
            category = html.escape(current_category or "DzERP")
            pages.append(
                '<section class="shot-page">'
                '<div class="shot-header">'
                f'<div class="category">{category}</div>'
                f"<h1>{alt}</h1>"
                "</div>"
                f'<div class="explanation">{explanation}</div>'
                "<figure>"
                f"<img src='{src}' alt='{alt}'>"
                f"<figcaption>{alt}</figcaption>"
                "</figure>"
                "</section>"
            )
            pending = []
            continue

        if line.startswith("#"):
            flush_bullets()
            level = len(line) - len(line.lstrip("#"))
            title = line[level:].strip()
            if level == 1:
                continue
            current_category = title
            continue

        if line.startswith("- "):
            bullets.append(line[2:].strip())
            continue

        push_paragraph(line)

    flush_bullets()
    return "\n".join(pages)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    body = render_image_pages(README.read_text(encoding="utf-8").splitlines())
    logo_uri = (ROOT / "public" / "brand" / "dzerp-logo.png").resolve().as_uri()
    css = """
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body {
      direction: rtl;
      font-family: "Arial", "Tahoma", sans-serif;
      color: #1f2933;
      background: #ffffff;
      font-size: 13px;
      line-height: 1.7;
      margin: 0;
    }
    .cover {
      min-height: 265mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      page-break-after: always;
      border: 2px solid #0f766e;
      border-radius: 18px;
      padding: 30mm 18mm;
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 55%, #ecfdf5 100%);
    }
    .cover-logo {
      width: 122px;
      height: auto;
      border: 0;
      margin-bottom: 24px;
      background: transparent;
    }
    .cover h1 {
      border: 0;
      font-size: 36px;
      margin: 0 0 12px;
    }
    .cover .subtitle {
      font-size: 18px;
      color: #0f766e;
      margin-bottom: 20px;
    }
    .cover .summary {
      max-width: 140mm;
      font-size: 14px;
      color: #334155;
      margin-bottom: 24px;
    }
    .cover-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      width: 145mm;
      margin-top: 10px;
    }
    .cover-card {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.78);
      padding: 10px 12px;
      color: #0f172a;
      font-weight: 700;
    }
    .toc {
      page-break-after: always;
      padding-top: 8mm;
    }
    .toc-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-top: 18px;
    }
    .toc-item {
      border: 1px solid #d8dee9;
      border-radius: 8px;
      padding: 10px 12px;
      background: #f8fafc;
      min-height: 38px;
    }
    .toc-item strong {
      display: block;
      color: #0f766e;
      margin-bottom: 3px;
    }
    h1, h2, h3 {
      color: #0f172a;
      line-height: 1.35;
      margin: 0 0 10px;
      page-break-after: avoid;
    }
    h1 {
      font-size: 30px;
      padding-bottom: 12px;
      border-bottom: 3px solid #0f766e;
      margin-bottom: 18px;
    }
    h2 {
      font-size: 22px;
      margin-top: 28px;
      padding-bottom: 8px;
      border-bottom: 1px solid #d8dee9;
    }
    h3 {
      font-size: 17px;
      margin-top: 20px;
      color: #0f766e;
    }
    .shot-page {
      min-height: 268mm;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      padding-top: 2mm;
    }
    .shot-header {
      border-bottom: 3px solid #0f766e;
      padding-bottom: 9px;
      margin-bottom: 10px;
    }
    .shot-header .category {
      color: #0f766e;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .shot-header h1 {
      border: 0;
      margin: 0;
      padding: 0;
      font-size: 26px;
    }
    .explanation {
      border: 1px solid #d8dee9;
      background: #f8fafc;
      border-radius: 8px;
      padding: 9px 12px;
      margin: 0 0 10px;
    }
    .explanation p {
      margin: 0 0 7px;
    }
    .explanation p:last-child {
      margin-bottom: 0;
    }
    .appendix {
      justify-content: flex-start;
    }
    p { margin: 8px 0 12px; }
    ul {
      margin: 8px 24px 16px 0;
      padding: 0;
    }
    li { margin: 4px 0; }
    code {
      direction: ltr;
      unicode-bidi: embed;
      background: #eef2f7;
      border-radius: 4px;
      padding: 1px 5px;
      font-family: "Menlo", monospace;
      font-size: 12px;
    }
    figure {
      margin: 0;
      padding: 9px;
      border: 1px solid #d8dee9;
      border-radius: 8px;
      background: #f8fafc;
      page-break-inside: avoid;
    }
    img {
      display: block;
      max-width: 100%;
      max-height: 213mm;
      height: auto;
      margin: 0 auto;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
      background: #ffffff;
    }
    figcaption {
      text-align: center;
      font-size: 12px;
      color: #475569;
      margin-top: 8px;
    }
    """
    document = f"""<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>DzERP - دليل العميل</title>
  <style>{css}</style>
</head>
<body>
{body}
</body>
</html>
"""
    HTML_OUT.write_text(document, encoding="utf-8")
    print(HTML_OUT)


if __name__ == "__main__":
    main()
