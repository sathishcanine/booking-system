"""Shared drawing helpers for Alis-Adventure PDF documents."""

from __future__ import annotations

from dataclasses import dataclass

from fpdf import FPDF


@dataclass(frozen=True)
class Palette:
    navy: tuple[int, int, int] = (15, 52, 96)
    ocean: tuple[int, int, int] = (26, 95, 140)
    sky: tuple[int, int, int] = (214, 234, 248)
    mist: tuple[int, int, int] = (240, 247, 252)
    sand: tuple[int, int, int] = (255, 248, 235)
    coral: tuple[int, int, int] = (232, 118, 90)
    cloud: tuple[int, int, int] = (255, 159, 67)
    slate: tuple[int, int, int] = (71, 85, 105)
    ink: tuple[int, int, int] = (30, 41, 59)
    line: tuple[int, int, int] = (148, 163, 184)
    white: tuple[int, int, int] = (255, 255, 255)
    success: tuple[int, int, int] = (34, 139, 94)
    stripe_purple: tuple[int, int, int] = (99, 91, 255)


PALETTE = Palette()


class DiagramCanvas:
    """Low-level vector diagram primitives on an FPDF page."""

    def __init__(self, pdf: FPDF, palette: Palette = PALETTE):
        self.pdf = pdf
        self.p = palette

    def _rounded_box(
        self,
        x: float,
        y: float,
        w: float,
        h: float,
        fill: tuple[int, int, int],
        border: tuple[int, int, int] | None = None,
        radius: float = 3,
    ) -> None:
        border = border or fill
        self.pdf.set_fill_color(*fill)
        self.pdf.set_draw_color(*border)
        self.pdf.set_line_width(0.45)
        if hasattr(self.pdf, "rounded_rect"):
            self.pdf.rounded_rect(x, y, w, h, radius, style="DF")
        else:
            self.pdf.rect(x, y, w, h, style="DF")

    def _center_text(
        self,
        x: float,
        y: float,
        w: float,
        h: float,
        lines: list[tuple[str, str, int, tuple[int, int, int]]],
    ) -> None:
        """Each line: (text, style, size, color)."""
        if not lines:
            return
        line_h = 5.2
        total_h = sum(line_h for _ in lines)
        cy = y + (h - total_h) / 2 + 1
        for text, style, size, color in lines:
            self.pdf.set_font("Helvetica", style, size)
            self.pdf.set_text_color(*color)
            self.pdf.set_xy(x, cy)
            self.pdf.cell(w, line_h, text, align="C")
            cy += line_h

    def node(
        self,
        center_x: float,
        y: float,
        width: float,
        title: str,
        subtitle: str | list[str] = "",
        *,
        fill: tuple[int, int, int] | None = None,
        border: tuple[int, int, int] | None = None,
        title_size: int = 10,
        subtitle_size: int = 8,
    ) -> float:
        """Draw a labeled node; return bottom y."""
        fill = fill or self.p.sky
        border = border or self.p.ocean
        subs = [subtitle] if isinstance(subtitle, str) else list(subtitle)
        subs = [s for s in subs if s]
        h = 14 + len(subs) * 4.8
        x = center_x - width / 2
        self._rounded_box(x, y, width, h, fill, border)
        lines: list[tuple[str, str, int, tuple[int, int, int]]] = [
            (title, "B", title_size, self.p.navy),
        ]
        for sub in subs:
            lines.append((sub, "", subtitle_size, self.p.slate))
        self._center_text(x, y, width, h, lines)
        return y + h

    def arrow(
        self,
        x1: float,
        y1: float,
        x2: float,
        y2: float,
        *,
        label: str = "",
        color: tuple[int, int, int] | None = None,
    ) -> None:
        color = color or self.p.line
        self.pdf.set_draw_color(*color)
        self.pdf.set_line_width(0.55)
        self.pdf.line(x1, y1, x2, y2)
        # Arrowhead toward (x2, y2)
        import math

        angle = math.atan2(y2 - y1, x2 - x1)
        size = 2.2
        for da in (2.6, -2.6):
            ax = x2 - size * math.cos(angle - da * 0.22)
            ay = y2 - size * math.sin(angle - da * 0.22)
            self.pdf.line(x2, y2, ax, ay)
        if label:
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            self.pdf.set_font("Helvetica", "I", 7.5)
            self.pdf.set_text_color(*self.p.slate)
            self.pdf.set_xy(mx + 2, my - 5)
            self.pdf.cell(28, 4, label)

    def arrow_down(self, center_x: float, y: float, length: float = 10, label: str = "") -> float:
        self.arrow(center_x, y, center_x, y + length, label=label)
        return y + length + 2

    def fork_down(
        self,
        top_x: float,
        top_y: float,
        targets: list[tuple[float, float]],
        *,
        stem: float = 5,
    ) -> float:
        """Vertical stem from top_x,top_y then branches to each (x, y_bottom)."""
        mid_y = top_y + stem
        self.pdf.set_draw_color(*self.p.line)
        self.pdf.set_line_width(0.55)
        self.pdf.line(top_x, top_y, top_x, mid_y)
        if len(targets) == 1:
            self.arrow(top_x, mid_y, targets[0][0], targets[0][1])
            return targets[0][1] + 2
        xs = [t[0] for t in targets]
        self.pdf.line(min(xs), mid_y, max(xs), mid_y)
        bottom = top_y
        for tx, ty in targets:
            self.arrow(tx, mid_y, tx, ty)
            bottom = max(bottom, ty)
        return bottom + 2

    def badge(self, x: float, y: float, text: str, fill: tuple[int, int, int]) -> None:
        w = self.pdf.get_string_width(text) + 8
        self._rounded_box(x, y, w, 6.5, fill, fill, radius=2)
        self.pdf.set_font("Helvetica", "B", 7)
        self.pdf.set_text_color(*self.p.white)
        self.pdf.set_xy(x, y + 1.2)
        self.pdf.cell(w, 4.5, text, align="C")

    def lane_label(self, x: float, y: float, text: str) -> None:
        self.pdf.set_font("Helvetica", "B", 8)
        self.pdf.set_text_color(*self.p.ocean)
        self.pdf.set_xy(x, y)
        self.pdf.cell(40, 5, text)

    def draw_production_architecture(self, x: float, y: float, width: float = 190) -> float:
        """Vertical deployment stack for production plan."""
        cx = x + width / 2
        cur = y
        nodes = [
            ("Users & WordPress Embed", ["Browsers · embedded widget"], self.p.white, self.p.slate),
            ("Cloudflare", ["HTTPS · CDN · DNS"], self.p.sand, self.p.cloud),
            ("nginx · Web Container", ["React SPA · /api · /uploads proxy"], self.p.sky, self.p.ocean),
            ("FastAPI · API Container", ["Auth · bookings · Stripe webhooks"], self.p.ocean, self.p.navy),
        ]
        for title, subs, fill, border in nodes:
            cur = self.node(cx, cur, width * 0.78, title, subs, fill=fill, border=border)
            cur = self.arrow_down(cx, cur, 9, "HTTPS" if "Cloudflare" in title else "")

        fork_y = cur - 2
        left_x = x + width * 0.28
        right_x = x + width * 0.72
        db_top = fork_y + 14
        stripe_top = fork_y + 14
        self.fork_down(cx, fork_y, [(left_x, db_top), (right_x, stripe_top)], stem=6)

        db_bottom = self.node(
            left_x, db_top, width * 0.38, "PostgreSQL 16", ["Primary datastore"], fill=self.p.mist, border=self.p.success
        )
        stripe_bottom = self.node(
            right_x,
            stripe_top,
            width * 0.38,
            "Stripe + Connect",
            ["Payments · owner payouts"],
            fill=(237, 235, 254),
            border=self.p.stripe_purple,
        )
        cur = max(db_bottom, stripe_bottom) + 2
        uploads_y = self.arrow_down(left_x, cur, 8) - 2
        cur = self.node(
            left_x + width * 0.08,
            uploads_y,
            width * 0.42,
            "Uploads Volume",
            ["Listing & captain photos"],
            fill=self.p.white,
            border=self.p.line,
        )
        return cur + 4

    def draw_system_architecture(self, x: float, y: float, width: float = 190) -> float:
        """High-level system architecture for engineering doc."""
        return self.draw_production_architecture(x, y, width)

    def draw_data_model(self, x: float, y: float, width: float = 190) -> float:
        """Entity-relationship style data model diagram."""
        cx = x + width / 2
        cur = y

        # Platform settings
        cur = self.node(cx, cur, 52, "PlatformSettings", ["singleton"], fill=self.p.sand, border=self.p.coral)
        cur = self.arrow_down(cx, cur, 8)

        org_w = 64
        cur = self.node(cx, cur, org_w, "Organization", ["tenant boundary"], fill=self.p.ocean, border=self.p.navy, title_size=11)
        org_bottom = cur
        cur += 4

        children = [
            (x + 22, "User", ["owner · admin · renter"]),
            (x + 62, "Captain", []),
            (x + 102, "Activity", ["boat listing"]),
            (x + 152, "PromoCode", []),
        ]
        child_tops = []
        for child_x, title, subs in children:
            child_tops.append(self.node(child_x, cur, 36, title, subs, fill=self.p.sky, border=self.p.ocean, title_size=9))
            self.arrow(child_x, org_bottom, child_x, cur)
        cur = max(child_tops) + 6

        act_x = x + 102
        ticket_y = cur
        slot_y = cur
        self.arrow(act_x, cur - 6, act_x - 18, ticket_y + 2)
        self.arrow(act_x, cur - 6, act_x + 18, slot_y + 2)
        t_bottom = self.node(act_x - 18, ticket_y, 34, "TicketType", [], fill=self.p.mist, border=self.p.ocean, title_size=9)
        s_bottom = self.node(act_x + 18, slot_y, 34, "Slot", ["departures"], fill=self.p.mist, border=self.p.ocean, title_size=9)
        cur = max(t_bottom, s_bottom) + 4

        book_x = act_x + 18
        cur = self.arrow_down(book_x, cur, 8) - 2
        cur = self.node(book_x, cur, 40, "Booking", ["pending · paid · cancelled"], fill=self.p.white, border=self.p.navy, title_size=9)
        book_bottom = cur

        bi_x = book_x - 22
        rev_x = book_x + 22
        self.fork_down(book_x, book_bottom, [(bi_x, book_bottom + 10), (rev_x, book_bottom + 10)], stem=5)
        b2 = self.node(bi_x, book_bottom + 10, 34, "BookingItem", [], fill=self.p.mist, border=self.p.line, title_size=8)
        r2 = self.node(rev_x, book_bottom + 10, 30, "Review", ["1:1"], fill=self.p.mist, border=self.p.line, title_size=8)

        # SavedBoat many-to-many note
        note_y = max(b2, r2) + 6
        self.pdf.set_font("Helvetica", "I", 8)
        self.pdf.set_text_color(*self.p.slate)
        self.pdf.set_xy(x + 4, note_y)
        self.pdf.cell(
            width - 8,
            5,
            "User <> Activity via SavedBoat (wishlist)   ·   Money stored as integer cents",
            align="C",
        )
        return note_y + 10

    def draw_flow_pipeline(
        self,
        x: float,
        y: float,
        steps: list[str],
        *,
        width: float = 190,
        title: str = "",
    ) -> float:
        """Horizontal numbered flow with connected boxes."""
        if title:
            self.pdf.set_font("Helvetica", "B", 9.5)
            self.pdf.set_text_color(*self.p.navy)
            self.pdf.set_xy(x, y)
            self.pdf.cell(width, 6, title)
            y += 8

        n = len(steps)
        if n == 0:
            return y

        gap = 3
        box_w = min(34, (width - gap * (n - 1)) / n)
        total_w = n * box_w + (n - 1) * gap
        start_x = x + (width - total_w) / 2
        centers = []
        cur_x = start_x
        for i, step in enumerate(steps, 1):
            h = 22
            self._rounded_box(cur_x, y, box_w, h, self.p.mist, self.p.ocean, radius=2.5)
            # Number circle
            self.pdf.set_fill_color(*self.p.ocean)
            self.pdf.ellipse(cur_x + box_w / 2 - 3, y - 2, 6, 6, style="F")
            self.pdf.set_font("Helvetica", "B", 7)
            self.pdf.set_text_color(*self.p.white)
            self.pdf.set_xy(cur_x + box_w / 2 - 3, y - 0.5)
            self.pdf.cell(6, 4, str(i), align="C")
            # Step text (wrapped manually by splitting)
            words = step.split()
            line1, line2 = "", ""
            for w in words:
                trial = (line1 + " " + w).strip()
                if self.pdf.get_string_width(trial) <= box_w - 4:
                    line1 = trial
                else:
                    line2 = (line2 + " " + w).strip()
            self.pdf.set_font("Helvetica", "", 6.5)
            self.pdf.set_text_color(*self.p.ink)
            self.pdf.set_xy(cur_x + 2, y + 7)
            self.pdf.cell(box_w - 4, 4, line1[:42], align="C")
            if line2:
                self.pdf.set_xy(cur_x + 2, y + 11)
                self.pdf.cell(box_w - 4, 4, line2[:42], align="C")
            centers.append(cur_x + box_w / 2)
            cur_x += box_w + gap

        mid_y = y + 11
        half = box_w / 2
        for i in range(len(centers) - 1):
            self.arrow(centers[i] + half, mid_y, centers[i + 1] - half, mid_y)

        return y + 28
