from pathlib import Path
from fpdf import FPDF
from app.utils.logger import get_logger

logger = get_logger(__name__)


class CorporatePDF(FPDF):
    """Custom corporate PDF styling with header and footer."""

    def __init__(self, doc_title: str = "Enterprise Document", department: str = "Enterprise", *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.doc_title = doc_title
        self.department = department.upper()

    def header(self):
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(120, 120, 140)
        self.cell(0, 6, f"NEXUSRAG ENTERPRISE ARCHITECTURE  |  {self.department} KNOWLEDGE BASE", border=0, align="L")
        self.ln(5)
        self.set_draw_color(220, 220, 230)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-12)
        self.set_draw_color(220, 220, 230)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(2)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(150, 150, 160)
        self.cell(0, 6, f"Page {self.page_no()} of {{nb}}  |  CONFIDENTIAL & PROPRIETARY", border=0, align="C")


def generate_document_pdf(
    title: str,
    department: str,
    content_text: str,
    chunks: list[dict] | None = None,
) -> bytes:
    """Generate a clean, professional multi-page corporate PDF binary from text/chunks."""
    pdf = CorporatePDF(doc_title=title, department=department)
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Document Header / Cover banner
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(30, 41, 59)
    # Sanitize title for Latin-1 encoding in FPDF
    safe_title = title.encode("latin-1", "replace").decode("latin-1")
    pdf.multi_cell(0, 10, safe_title, align="L")
    pdf.ln(2)

    # Department and Metadata badge
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(109, 40, 217)  # Violet
    pdf.cell(0, 6, f"DEPARTMENT: {department.upper()}  |  VERIFIED ENTERPRISE POLICY", ln=1)
    pdf.ln(4)

    # Divider
    pdf.set_draw_color(139, 92, 246)
    pdf.set_line_width(0.8)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.set_line_width(0.2)
    pdf.ln(6)

    # Body Content
    if chunks and len(chunks) > 0:
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(51, 65, 85)
        pdf.cell(0, 7, f"DOCUMENT SECTIONS ({len(chunks)} VERIFIED CLAUSES)", ln=1)
        pdf.ln(2)

        for i, chunk in enumerate(chunks):
            # Clause header
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(79, 70, 229)
            pdf.cell(0, 6, f"Section {i + 1}: Clause Index #{chunk.get('chunk_index', i) + 1}", ln=1)

            # Clause body text
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(30, 41, 59)
            text = chunk.get("text", "").strip()
            safe_text = text.encode("latin-1", "replace").decode("latin-1")
            pdf.multi_cell(0, 5.5, safe_text)
            pdf.ln(4)
    else:
        # Standard paragraph flow
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(30, 41, 59)
        paragraphs = content_text.split("\n\n")
        for p in paragraphs:
            p_clean = p.strip()
            if not p_clean:
                continue
            if p_clean.startswith("#"):
                # Header
                header_text = p_clean.lstrip("#").strip()
                pdf.ln(2)
                pdf.set_font("Helvetica", "B", 12)
                pdf.set_text_color(15, 23, 42)
                safe_h = header_text.encode("latin-1", "replace").decode("latin-1")
                pdf.multi_cell(0, 7, safe_h)
                pdf.set_font("Helvetica", "", 10)
                pdf.set_text_color(30, 41, 59)
            else:
                safe_p = p_clean.encode("latin-1", "replace").decode("latin-1")
                pdf.multi_cell(0, 5.5, safe_p)
            pdf.ln(3)

    return bytes(pdf.output())

