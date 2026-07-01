"""Shared PDF styling for Alis-Adventure documents."""

from __future__ import annotations

from fpdf import FPDF

from pdf_diagrams import DiagramCanvas, PALETTE

_UNICODE_REPLACEMENTS = str.maketrans({
    "\u2013": "-",  # en dash
    "\u2014": "-",  # em dash
    "\u2192": "->",  # arrow
    "\u2265": ">=",  # >=
    "\u2022": "*",  # bullet (we draw our own)
    "\u00b7": "-",  # middle dot in header
})


def ascii_text(text: str) -> str:
    return text.translate(_UNICODE_REPLACEMENTS)


class BrandPDF(FPDF):
    doc_label: str = "Alis-Adventure"

    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*PALETTE.slate)
        self.cell(0, 8, ascii_text(f"{self.doc_label}  -  Confidential"), align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*PALETTE.sky)
        self.set_line_width(0.3)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(3)

    def footer(self):
        self.set_y(-14)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*PALETTE.line)
        self.cell(0, 8, f"Page {self.page_no()}", align="C")

    def cover_page(
        self,
        title: str,
        subtitle: str,
        audience: str,
        blurb: str,
        *,
        accent: tuple[int, int, int] | None = None,
    ) -> None:
        accent = accent or PALETTE.ocean
        self.add_page()
        # Top banner
        self.set_fill_color(*accent)
        self.rect(0, 0, 210, 52, style="F")
        self.set_fill_color(*PALETTE.navy)
        self.rect(0, 48, 210, 6, style="F")
        # Wave accent
        self.set_draw_color(*PALETTE.sky)
        self.set_line_width(1.2)
        for i in range(0, 210, 14):
            self.line(i, 54, i + 7, 58)
            self.line(i + 7, 58, i + 14, 54)

        self.set_y(62)
        self.set_font("Helvetica", "B", 30)
        self.set_text_color(*PALETTE.navy)
        self.cell(0, 14, title, align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)
        self.set_font("Helvetica", "", 17)
        self.set_text_color(*PALETTE.slate)
        self.cell(0, 10, subtitle, align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(10)

        cx = 105
        canvas = DiagramCanvas(self)
        canvas.badge(cx - 42, self.get_y(), audience, accent)
        self.ln(12)
        self.set_font("Helvetica", "", 11)
        self.set_text_color(*PALETTE.ink)
        self.set_x(28)
        self.multi_cell(154, 6.5, ascii_text(blurb), align="C")
        self.ln(8)
        self.set_font("Helvetica", "I", 10)
        self.set_text_color(*PALETTE.slate)
        self.cell(0, 8, "July 2026", align="C", new_x="LMARGIN", new_y="NEXT")

    def section_title(self, title: str):
        self.ln(3)
        self.set_fill_color(*PALETTE.sky)
        self.set_draw_color(*PALETTE.ocean)
        self.set_line_width(0.5)
        y = self.get_y()
        self.rect(10, y, 3, 9, style="F")
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(*PALETTE.navy)
        self.set_xy(15, y)
        self.cell(0, 9, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(4)

    def sub_title(self, title: str):
        self.ln(2)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(*PALETTE.ocean)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def body_text(self, text: str):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*PALETTE.ink)
        self.multi_cell(0, 5.5, ascii_text(text))
        self.ln(2)

    def bullet(self, text: str):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*PALETTE.ink)
        x = self.get_x()
        self.set_text_color(*PALETTE.ocean)
        self.cell(6, 5.5, "*")
        self.set_text_color(*PALETTE.ink)
        self.multi_cell(0, 5.5, ascii_text(text))
        self.set_x(x)

    def table_row(self, cols: list[str], widths: list[int], header: bool = False):
        cols = [ascii_text(c) for c in cols]
        if header:
            self.set_font("Helvetica", "B", 9)
            self.set_fill_color(*PALETTE.sky)
            self.set_text_color(*PALETTE.navy)
        else:
            self.set_font("Helvetica", "", 9)
            self.set_fill_color(255, 255, 255)
            self.set_text_color(*PALETTE.ink)
        self.set_draw_color(*PALETTE.line)
        y_start = self.get_y()
        x_start = self.get_x()
        line_heights = []
        for col, w in zip(cols, widths):
            n_lines = max(1, len(self.multi_cell(w, 5, col, border=0, dry_run=True, output="LINES")))
            line_heights.append(n_lines)
        row_h = max(line_heights) * 5
        x = x_start
        for col, w in zip(cols, widths):
            self.set_xy(x, y_start)
            self.multi_cell(w, 5, col, border=1, fill=header, align="L")
            x += w
        self.set_xy(x_start, y_start + row_h)

    def diagram(self) -> DiagramCanvas:
        return DiagramCanvas(self)

    def diagram_frame(self, title: str, draw_fn, height_hint: float = 0) -> None:
        """Draw a titled diagram inside a light frame."""
        self.sub_title(title)
        y0 = self.get_y()
        x0 = 10
        w = 190
        # Pre-allocate space estimate if needed for page break
        if height_hint and y0 + height_hint > 270:
            self.add_page()
            y0 = self.get_y()
        bottom = draw_fn(self.diagram(), x0, y0, w)
        frame_h = bottom - y0 + 4
        self.set_draw_color(*PALETTE.sky)
        self.set_line_width(0.35)
        self.rect(x0 - 2, y0 - 2, w + 4, frame_h + 2, style="D")
        self.set_y(bottom + 4)
