"""Build the one-page project overview from docs/submission.md.

Run: python scripts/build_writeup.py
Requires: reportlab
Uses Segoe UI on Windows, DejaVu Sans on Linux, or built-in Helvetica.
The Markdown remains the editable content source. No network access is used.
"""

from pathlib import Path
import re
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "submission.md"
OUTPUT = ROOT / "docs" / "Benchlog_Project_Overview.pdf"
REPOSITORY = "https://github.com/talayahya/Benchlog"
PROTOTYPE = "https://talayahya.github.io/Benchlog/"
SUBTITLE = "Voice-assisted electronics experiments"

INK = colors.HexColor("#172B32")
SECONDARY = colors.HexColor("#51646A")
ACCENT = colors.HexColor("#B73F27")
LINE = colors.HexColor("#D3DDDA")


def register_fonts():
    candidates = [
        (Path("C:/Windows/Fonts/segoeui.ttf"), Path("C:/Windows/Fonts/seguisb.ttf"), "Segoe UI"),
        (
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
            "DejaVu Sans",
        ),
    ]
    for regular, bold, label in candidates:
        if regular.exists() and bold.exists():
            pdfmetrics.registerFont(TTFont("BenchBody", str(regular)))
            pdfmetrics.registerFont(TTFont("BenchBold", str(bold)))
            pdfmetrics.registerFontFamily(
                "BenchBody", normal="BenchBody", bold="BenchBold",
                italic="BenchBody", boldItalic="BenchBold"
            )
            return "BenchBody", "BenchBold", label
    return "Helvetica", "Helvetica-Bold", "Helvetica"


BODY_FONT, BOLD_FONT, FONT_LABEL = register_fonts()


def inline_markup(text):
    # ReportLab Paragraph uses XML-like markup: escape source before adding tags.
    clean = text.replace("\u2011", "-").replace("\u2013", "-").replace("\u2014", "-")
    clean = escape(clean)
    clean = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", clean)
    clean = re.sub(r"`([^`]+)`", r'<font name="%s">\1</font>' % BODY_FONT, clean)
    return clean


def blocks_from_source():
    text = SOURCE.read_text(encoding="utf-8")
    start = text.index("## ")
    for block in re.split(r"\n\s*\n", text[start:].strip()):
        if block.startswith("## "):
            yield "heading", block[3:].strip()
        else:
            yield "paragraph", " ".join(block.split())


def draw_page(canvas, doc):
    width, height = A4
    left = doc.leftMargin
    right = width - doc.rightMargin
    canvas.saveState()
    canvas.setTitle("Benchlog - Project Overview")
    canvas.setAuthor("Tala Yahya")
    canvas.setSubject("Voice-assisted electronics measurements and testable RC circuit explanations")
    canvas.setKeywords("Benchlog, voice, RC filter, electronics, AI-assisted prototype")

    canvas.setFillColor(INK)
    canvas.setFont(BOLD_FONT, 35)
    canvas.drawString(left, height - 69, "benchlog")
    title_width = pdfmetrics.stringWidth("benchlog", BOLD_FONT, 35)
    canvas.setFillColor(ACCENT)
    canvas.drawString(left + title_width, height - 69, ".")

    canvas.setFillColor(INK)
    canvas.setFont(BODY_FONT, 14)
    canvas.drawString(left, height - 95, SUBTITLE)
    canvas.setFillColor(SECONDARY)
    canvas.setFont(BODY_FONT, 9.5)
    canvas.drawString(left, height - 116, "Tala Yahya  /  Project overview")
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.7)
    canvas.line(left, height - 132, right, height - 132)

    canvas.setStrokeColor(LINE)
    canvas.line(left, 66, right, 66)
    canvas.setFillColor(SECONDARY)
    canvas.setFont(BODY_FONT, 8.8)
    canvas.drawString(left, 48, "Code & setup")
    canvas.setFillColor(ACCENT)
    canvas.drawString(left + 59, 48, "github.com/talayahya/Benchlog")
    repo_width = pdfmetrics.stringWidth("github.com/talayahya/Benchlog", BODY_FONT, 8.8)
    canvas.linkURL(REPOSITORY, (left + 59, 45, left + 59 + repo_width, 58), relative=0, thickness=0)
    canvas.setFillColor(SECONDARY)
    canvas.drawString(left, 32, "Prototype")
    canvas.setFillColor(ACCENT)
    canvas.drawString(left + 59, 32, "talayahya.github.io/Benchlog")
    demo_width = pdfmetrics.stringWidth("talayahya.github.io/Benchlog", BODY_FONT, 8.8)
    canvas.linkURL(PROTOTYPE, (left + 59, 29, left + 59 + demo_width, 42), relative=0, thickness=0)
    canvas.setFillColor(SECONDARY)
    canvas.setFont(BODY_FONT, 8.8)
    canvas.drawRightString(right, 32, "November 2026")
    canvas.restoreState()


def build():
    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4,
        leftMargin=47, rightMargin=47,
        topMargin=146, bottomMargin=80,
        title="Benchlog - Project Overview", author="Tala Yahya"
    )
    heading = ParagraphStyle(
        "Section", fontName=BOLD_FONT, fontSize=11.3, leading=14,
        textColor=ACCENT, spaceBefore=12, spaceAfter=5,
        keepWithNext=True, alignment=TA_LEFT
    )
    first_heading = ParagraphStyle("FirstSection", parent=heading, spaceBefore=0)
    body = ParagraphStyle(
        "Body", fontName=BODY_FONT, fontSize=10.3, leading=14.25,
        textColor=INK, spaceAfter=7, alignment=TA_LEFT,
        allowWidows=0, allowOrphans=0
    )
    flowables = []
    first = True
    for kind, text in blocks_from_source():
        if kind == "heading":
            flowables.append(Paragraph(inline_markup(text), first_heading if first else heading))
            first = False
        else:
            flowables.append(Paragraph(inline_markup(text), body))
    doc.build(flowables, onFirstPage=draw_page, onLaterPages=draw_page)
    print(f"Wrote {OUTPUT}")
    print(f"Typeface: {FONT_LABEL}")
    try:
        from pypdf import PdfReader
        reader = PdfReader(OUTPUT)
        print(f"Pages: {len(reader.pages)}")
        if len(reader.pages) != 1:
            raise RuntimeError("The project overview must fit on one page; revise layout or content.")
    except ImportError:
        print("Install pypdf or run pdfinfo to verify the single-page requirement.")


if __name__ == "__main__":
    build()
