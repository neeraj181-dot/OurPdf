import os
import io
import re
import html
import tempfile
import urllib.parse
from typing import Optional
from xhtml2pdf import pisa


class HtmlConverterService:
    @staticmethod
    def _sanitize_and_prepare_html(
        raw_html: str,
        page_size: str = "A4",
        orientation: str = "portrait",
        margin: str = "default",
        print_background: bool = True,
    ) -> str:
        """
        Sanitize untrusted HTML and inject @page and default typography CSS.
        """
        if not raw_html or not raw_html.strip():
            raise ValueError("HTML content is empty.")

        # Limit HTML size to 20MB
        if len(raw_html.encode("utf-8")) > 20 * 1024 * 1024:
            raise ValueError("HTML content exceeds maximum allowed size of 20MB.")

        # Normalize page size & orientation
        valid_sizes = {
            "a4": "a4",
            "letter": "letter",
            "legal": "legal",
            "a3": "a3",
            "a5": "a5",
        }
        size_key = valid_sizes.get(page_size.lower().strip(), "a4")

        valid_orientations = {"portrait": "portrait", "landscape": "landscape"}
        orient_key = valid_orientations.get(orientation.lower().strip(), "portrait")

        # Margins mapping
        margin_map = {
            "none": "0.2cm",
            "small": "0.8cm",
            "default": "1.8cm",
            "large": "2.5cm",
        }
        margin_val = margin_map.get(margin.lower().strip(), "1.8cm")

        # Strip dangerous tags for security
        clean_html = re.sub(
            r"<(script|iframe|object|embed|applet|meta\s+http-equiv)[^>]*>.*?</\1>",
            "",
            raw_html,
            flags=re.IGNORECASE | re.DOTALL,
        )
        clean_html = re.sub(r"<(script|iframe|object|embed|applet)[^>]*>", "", clean_html, flags=re.IGNORECASE)
        # Strip inline event handlers (onload, onerror, onclick, etc.)
        clean_html = re.sub(r'\son[a-zA-Z]+\s*=\s*(["\']).*?\1', "", clean_html, flags=re.IGNORECASE)
        clean_html = re.sub(r"\son[a-zA-Z]+\s*=\s*[^\s>]+", "", clean_html, flags=re.IGNORECASE)

        # Proactively clean unsafe src attributes (file://, internal IPs, localhost)
        def _sanitize_src_attr(match):
            attr_name = match.group(1)
            quote = match.group(2)
            url_val = match.group(3)
            if url_val.startswith("data:image/") or url_val.startswith("data:font/"):
                return f'{attr_name}={quote}{url_val}{quote}'
            parsed = urllib.parse.urlparse(url_val)
            if parsed.scheme.lower() in ("file", "gopher", "dict", "ftp") or url_val.startswith("//"):
                return f'{attr_name}={quote}{quote}'
            host = (parsed.hostname or "").lower()
            if host in ("localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254") or host.startswith("192.168.") or host.startswith("10."):
                return f'{attr_name}={quote}{quote}'
            return f'{attr_name}={quote}{url_val}{quote}'

        clean_html = re.sub(r'(src|href)\s*=\s*(["\'])(.*?)\2', _sanitize_src_attr, clean_html, flags=re.IGNORECASE)

        # Base default CSS styling for clean, professional PDF output
        bg_rule = "background-color: transparent;" if not print_background else ""
        injected_css = f"""
<style>
@page {{
    size: {size_key} {orient_key};
    margin: {margin_val};
}}
html, body {{
    font-family: Helvetica, Arial, 'Segoe UI', sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: #111827;
    {bg_rule}
}}
h1 {{
    font-size: 20pt;
    color: #111827;
    margin-top: 14pt;
    margin-bottom: 8pt;
    font-weight: bold;
    line-height: 1.2;
}}
h2 {{
    font-size: 15pt;
    color: #1f2937;
    margin-top: 12pt;
    margin-bottom: 6pt;
    font-weight: bold;
    line-height: 1.3;
}}
h3 {{
    font-size: 12pt;
    color: #374151;
    margin-top: 10pt;
    margin-bottom: 4pt;
    font-weight: bold;
}}
h4, h5, h6 {{
    font-size: 10.5pt;
    color: #4b5563;
    margin-top: 8pt;
    margin-bottom: 3pt;
    font-weight: bold;
}}
p {{
    margin-top: 0;
    margin-bottom: 8pt;
}}
table {{
    width: 100%;
    border-collapse: collapse;
    margin-top: 8pt;
    margin-bottom: 12pt;
}}
th, td {{
    border: 1px solid #d1d5db;
    padding: 6pt 8pt;
    text-align: left;
    font-size: 9.5pt;
}}
th {{
    background-color: #f3f4f6;
    font-weight: bold;
    color: #111827;
}}
tr:nth-child(even) {{
    background-color: #f9fafb;
}}
img {{
    max-width: 100%;
    height: auto;
}}
ul, ol {{
    margin-top: 4pt;
    margin-bottom: 8pt;
    padding-left: 18pt;
}}
li {{
    margin-bottom: 3pt;
}}
blockquote {{
    border-left: 3px solid #1DB954;
    padding-left: 8pt;
    margin-left: 0;
    color: #4b5563;
    font-style: italic;
}}
code, pre {{
    font-family: 'Courier New', Courier, monospace;
    font-size: 9pt;
    background-color: #f3f4f6;
    border-radius: 3px;
}}
pre {{
    padding: 8pt;
    margin: 6pt 0;
    white-space: pre-wrap;
    word-break: break-word;
}}
a {{
    color: #059669;
    text-decoration: underline;
}}
.page-break {{
    page-break-before: always;
}}
.no-break {{
    page-break-inside: avoid;
}}
</style>
"""

        has_head = bool(re.search(r"<head[^>]*>", clean_html, re.IGNORECASE))
        has_body = bool(re.search(r"<body[^>]*>", clean_html, re.IGNORECASE))
        has_html_tag = bool(re.search(r"<html[^>]*>", clean_html, re.IGNORECASE))

        if has_head:
            # Inject CSS into existing <head>
            final_html = re.sub(r"(<head[^>]*>)", r"\1" + injected_css, clean_html, count=1, flags=re.IGNORECASE)
        elif has_html_tag:
            # Inject <head> before <body> or after <html>
            final_html = re.sub(
                r"(<html[^>]*>)",
                r"\1<head><meta charset='utf-8'>" + injected_css + "</head>",
                clean_html,
                count=1,
                flags=re.IGNORECASE,
            )
        elif has_body:
            # Wrap with html + head
            final_html = f"<!DOCTYPE html><html><head><meta charset='utf-8'>{injected_css}</head>{clean_html}</html>"
        else:
            # HTML snippet
            final_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
{injected_css}
</head>
<body>
{clean_html}
</body>
</html>"""

        return final_html

    @staticmethod
    def _safe_link_callback(uri: str, rel: str) -> Optional[str]:
        """
        SSRF & Local File Protection:
        Disallows local file paths and internal/private IP network addresses.
        Allows safe base64 data URIs and public HTTPS/HTTP resources.
        """
        if not uri:
            return None

        # Allow base64 data URIs
        if uri.startswith("data:image/") or uri.startswith("data:font/"):
            return uri

        # Disallow local file:// schemes and path traversal
        parsed = urllib.parse.urlparse(uri)
        scheme = parsed.scheme.lower()
        if scheme in ("file", "gopher", "dict", "ftp", "tftp", "ldap", "ssh") or uri.startswith("//"):
            return None

        # For HTTP/HTTPS, verify destination host is not localhost or private RFC1918/link-local
        if scheme in ("http", "https"):
            host = (parsed.hostname or "").lower()
            if not host:
                return None

            # Block loopback, local, and metadata endpoints
            blocked_hosts = {
                "localhost",
                "127.0.0.1",
                "0.0.0.0",
                "::1",
                "169.254.169.254", # AWS/GCP/Azure instance metadata
                "metadata.google.internal",
            }
            if host in blocked_hosts:
                return None

            # Block private IP ranges
            if (
                host.startswith("10.")
                or host.startswith("192.168.")
                or (host.startswith("172.") and any(host.startswith(f"172.{i}.") for i in range(16, 32)))
                or host.endswith(".local")
                or host.endswith(".internal")
            ):
                return None

            return uri

        return None

    @classmethod
    def convert_html_to_pdf_bytes(
        cls,
        raw_html: str,
        filename: str = "document.html",
        page_size: str = "A4",
        orientation: str = "portrait",
        margin: str = "default",
        print_background: bool = True,
    ) -> bytes:
        """
        Converts sanitized HTML string into PDF byte sequence.
        """
        if not raw_html or not raw_html.strip():
            raise ValueError("Provided HTML document is empty.")

        prepared_html = cls._sanitize_and_prepare_html(
            raw_html=raw_html,
            page_size=page_size,
            orientation=orientation,
            margin=margin,
            print_background=print_background,
        )

        pdf_stream = io.BytesIO()
        try:
            pisa_status = pisa.CreatePDF(
                src=io.StringIO(prepared_html),
                dest=pdf_stream,
                encoding="utf-8",
                link_callback=cls._safe_link_callback,
            )

            if pisa_status.err:
                raise ValueError(f"HTML to PDF rendering encountered {pisa_status.err} parser error(s).")

            pdf_bytes = pdf_stream.getvalue()
            if not pdf_bytes or len(pdf_bytes) < 100:
                raise ValueError("Generated PDF is empty or invalid.")

            return pdf_bytes
        except ValueError:
            raise
        except Exception as e:
            raise ValueError(f"Failed to generate PDF from HTML: {str(e)}")
