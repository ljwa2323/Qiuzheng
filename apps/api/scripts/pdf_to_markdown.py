#!/usr/bin/env python3
"""Convert PDF bytes/path to Markdown via PyMuPDF4LLM (better tables than plain text extract)."""
from __future__ import annotations

import argparse
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="PDF to Markdown with PyMuPDF4LLM")
    parser.add_argument("pdf_path", help="Path to input PDF")
    parser.add_argument("--title", default="", help="Optional H1 title prefix")
    args = parser.parse_args()

    try:
        import pymupdf4llm
    except ImportError:
        sys.stderr.write("pymupdf4llm is not installed. Run: pip install -r requirements-pdf.txt\n")
        return 2

    md = pymupdf4llm.to_markdown(args.pdf_path) or ""
    title = (args.title or "").strip()
    if title:
        md = f"# {title}\n\n{md}".strip() + "\n"
    sys.stdout.buffer.write(md.encode("utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
