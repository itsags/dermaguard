"""Build the individual observation PDF from saved account records."""

from datetime import datetime
from io import BytesIO
from xml.sax.saxutils import escape

from PIL import Image, ImageOps
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Image as PDFImage
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


INK = colors.HexColor('#0f172a')
MUTED = colors.HexColor('#475569')
BORDER = colors.HexColor('#dbe4ef')
PANEL = colors.HexColor('#f5f8fb')
WIDTH = 510


def date_text(value):
    try:
        return datetime.fromisoformat(value).strftime('%d %b %Y, %H:%M %Z').strip()
    except (ValueError, TypeError):
        return str(value or 'Not recorded')


def build_observation_pdf(scan_id, row, profile, case, photos, measurements, dates):
    buffer = BytesIO()
    styles = {
        'title': ParagraphStyle('title', fontName='Helvetica-Bold', fontSize=19, leading=23, textColor=INK),
        'heading': ParagraphStyle('heading', fontName='Helvetica-Bold', fontSize=11, leading=15, textColor=INK),
        'text': ParagraphStyle('text', fontSize=9, leading=13, textColor=INK),
        'label': ParagraphStyle('label', fontSize=8, leading=11, textColor=MUTED),
        'right': ParagraphStyle('right', fontSize=8, leading=12, textColor=MUTED, alignment=TA_RIGHT),
    }

    def paragraph(value, style='text'):
        return Paragraph(escape(str(value)).replace('\n', '<br/>'), styles[style])

    def table(cells, widths, shaded=False):
        grid = Table([cells], colWidths=widths)
        rules = [('VALIGN', (0, 0), (-1, -1), 'TOP'),
                 ('LEFTPADDING', (0, 0), (-1, -1), 9),
                 ('RIGHTPADDING', (0, 0), (-1, -1), 9),
                 ('TOPPADDING', (0, 0), (-1, -1), 9),
                 ('BOTTOMPADDING', (0, 0), (-1, -1), 9)]
        if shaded:
            rules.extend([('BACKGROUND', (0, 0), (-1, -1), PANEL),
                          ('BOX', (0, 0), (-1, -1), .6, BORDER)])
        grid.setStyle(TableStyle(rules))
        return grid

    def field(label, value):
        return [paragraph(label.upper(), 'label'), paragraph(value)]

    story = [
        table([[paragraph('DERMAGUARD', 'title'), paragraph('Private skin observation report', 'label')],
               [paragraph('Report ID: ' + scan_id, 'right'),
                paragraph('Saved: ' + date_text(row['created_at']), 'right')]], [275, 235]),
        Spacer(1, 10),
        table([field('Patient', profile.get('display_name') or 'Not recorded'),
               field('Observation', case.get('title') or 'Skin observation'),
               field('Anatomical site', case.get('body_area') or 'Not recorded')], [170] * 3, shaded=True),
        Spacer(1, 10),
    ]
    for index, (captured_at, content, checks) in enumerate(photos, 1):
        visual = []
        if content:
            with Image.open(BytesIO(content)) as original:
                preview = ImageOps.exif_transpose(original).convert('RGB')
            preview.thumbnail((840, 720))
            jpeg = BytesIO()
            preview.save(jpeg, 'JPEG', quality=86)
            jpeg.seek(0)
            ratio = min(205 / preview.width, 178 / preview.height)
            graphic = PDFImage(jpeg, width=preview.width * ratio, height=preview.height * ratio)
            graphic.hAlign = 'LEFT'
            visual.append(graphic)
        else:
            visual.append(paragraph('Photo could not be retrieved', 'label'))
        visual.extend([Spacer(1, 5), paragraph('Captured: ' + date_text(captured_at), 'label')])
        details = [paragraph(f'Photo {index}', 'heading')]
        if checks:
            details.extend([
                paragraph('Format: ' + checks['format']),
                paragraph(f"Image dimensions: {checks['width_px']} x {checks['height_px']} px"),
                paragraph(f"File size: {checks['bytes'] / 1024:.1f} KB"),
            ])
            if 'very_dark_pct' in checks:
                details.extend([paragraph(f"Very dark pixels: {checks['very_dark_pct']}%"),
                                paragraph(f"Very bright pixels: {checks['very_bright_pct']}%")])
        story.append(KeepTogether([table([visual, details], [225, 285], shaded=True), Spacer(1, 10)]))
    if row.get('notes', '').strip():
        story.extend([paragraph('Your observations', 'heading'), paragraph(row['notes']), Spacer(1, 10)])
    if measurements:
        story.append(paragraph('Measurements previously entered by the user', 'heading'))
        story.extend(paragraph(line) for line in measurements)
    if dates:
        story.extend([Spacer(1, 10), paragraph('Photo timeline', 'heading')])
        story.extend(paragraph(date_text(date)) for date in dates)
    story.extend([Spacer(1, 10), paragraph('For reference at a clinical visit', 'heading'),
                  paragraph('This report documents the uploaded photos and observations. A clinician evaluates lesion features, physical size and possible causes.')])
    SimpleDocTemplate(buffer, title='DermaGuard observation report', author='DermaGuard',
                      leftMargin=45, rightMargin=45, topMargin=34, bottomMargin=34).build(story)
    return buffer.getvalue()
