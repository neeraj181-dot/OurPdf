import re
from collections import Counter
import pymupdf as fitz

def convert_pdf_to_markdown(pdf_bytes: bytes) -> dict:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if len(doc) == 0:
        return {"markdown": "", "pageCount": 0, "isScanned": False, "headings": 0, "tables": 0, "words": 0}

    # 1. Determine body font size mode
    font_sizes = []
    for page in doc:
        for b in page.get_text("dict").get("blocks", []):
            if b.get("type") == 0:
                for l in b.get("lines", []):
                    for s in l.get("spans", []):
                        t = s.get("text", "").strip()
                        if len(t) > 10:
                            font_sizes.append(round(s.get("size", 10), 1))

    body_size = Counter(font_sizes).most_common(1)[0][0] if font_sizes else 10.0

    sections = []
    doc_title = None
    headings_count = 0
    tables_count = 0

    for pno, page in enumerate(doc):
        blocks = page.get_text("dict", flags=fitz.TEXT_DEHYPHENATE).get("blocks", [])
        
        # Filter out running footers / headers / page numbers
        filtered_blocks = []
        for b_idx, b in enumerate(blocks):
            if b.get("type") == 0:
                lines = b.get("lines", [])
                if not lines:
                    continue
                block_txt = " ".join("".join(s.get("text", "") for s in l.get("spans", [])).strip() for l in lines).strip()
                
                # Check if bottom of page footer / page number
                y_pos = b.get("bbox", [0, 0, 0, 0])[1]
                is_bottom = y_pos > page.rect.height - 70
                is_top = y_pos < 50
                
                # Page footer pattern (e.g. "OurPDF Heading Organizer Test Page 1", "Page 1 of 2", "Page 1")
                if (is_bottom or is_top or b_idx == len(blocks) - 1):
                    if re.search(r"Page\s+\d+(\s+of\s+\d+)?$", block_txt, re.IGNORECASE) or re.search(r"^\d+\s*[\/\|]\s*\d+$", block_txt):
                        continue
                    if re.match(r"^.*Page\s+\d+$", block_txt, re.IGNORECASE) and len(block_txt) < 80:
                        continue

                filtered_blocks.append(b)

        i = 0
        while i < len(filtered_blocks):
            b = filtered_blocks[i]
            lines = b.get("lines", [])
            if not lines:
                i += 1
                continue

            # Check if this block and consecutive blocks form a table
            # Case 1: Pipe delimited table
            # Case 2: Multi-line / multi-span tabular block with multiple columns across rows
            is_table = False
            first_line_spans = lines[0].get("spans", [])
            first_line_text = "".join(s.get("text", "") for s in first_line_spans).strip()
            
            # Check if lines have multiple spans with distinct X coordinates or "//" multi-column text
            has_multi_cols = len(first_line_spans) >= 2 or len(lines) >= 2
            if ("|" in first_line_text) or (len(lines) == 2 and len(first_line_spans) == 1 and len(lines[1].get("spans", [])) == 1 and abs(lines[0]["bbox"][1] - lines[1]["bbox"][1]) < 10):
                has_multi_cols = True

            # Detect consecutive tabular blocks (e.g. Feature Expected Result, Title Updated title...)
            if i + 1 < len(filtered_blocks):
                # Check if subsequent blocks look like rows of a table
                next_b = filtered_blocks[i + 1]
                next_lines = next_b.get("lines", [])
                if next_lines:
                    first_txt = "\n".join(" ".join(s.get("text", "") for s in l.get("spans", [])).strip() for l in lines)
                    next_txt = "\n".join(" ".join(s.get("text", "") for s in l.get("spans", [])).strip() for l in next_lines)
                    
                    if (len(lines) == 2 or "|" in first_txt) and (len(next_lines) == 2 or "|" in next_txt):
                        is_table = True

            if is_table or "|" in first_line_text or (len(lines) == 2 and len(lines[0].get("spans", [])) == 1 and len(lines[1].get("spans", [])) == 1 and lines[0]["bbox"][0] < lines[1]["bbox"][0] and lines[0]["spans"][0].get("size", 10) <= body_size * 1.05):
                table_rows = []
                while i < len(filtered_blocks):
                    curr_b = filtered_blocks[i]
                    curr_lines = curr_b.get("lines", [])
                    if not curr_lines:
                        i += 1
                        continue

                    # Extract row columns
                    if len(curr_lines) == 2 and curr_lines[0]["bbox"][0] < curr_lines[1]["bbox"][0]:
                        col1 = "".join(s.get("text", "") for s in curr_lines[0].get("spans", [])).strip()
                        col2 = "".join(s.get("text", "") for s in curr_lines[1].get("spans", [])).strip()
                        table_rows.append([col1, col2])
                        i += 1
                    elif "|" in "".join(s.get("text", "") for l in curr_lines for s in l.get("spans", [])):
                        for l in curr_lines:
                            row_txt = "".join(s.get("text", "") for s in l.get("spans", [])).strip()
                            if "|" in row_txt:
                                cols = [c.strip() for c in row_txt.split("|") if c.strip()]
                                table_rows.append(cols)
                        i += 1
                    elif len(curr_lines) == 1 and len(curr_lines[0].get("spans", [])) >= 2:
                        spans = curr_lines[0].get("spans", [])
                        cols = [s.get("text", "").strip() for s in spans if s.get("text", "").strip()]
                        if len(cols) >= 2:
                            table_rows.append(cols)
                            i += 1
                        else:
                            break
                    else:
                        break

                if len(table_rows) >= 2:
                    col_count = max(len(r) for r in table_rows)
                    header = table_rows[0]
                    while len(header) < col_count:
                        header.append("")
                    header_str = " | ".join(header)
                    sep_str = " | ".join(["---"] * col_count)
                    table_md = f"| {header_str} |\n| {sep_str} |\n"
                    for row in table_rows[1:]:
                        while len(row) < col_count:
                            row.append("")
                        row_str = " | ".join(row)
                        table_md += f"| {row_str} |\n"
                    sections.append(table_md.strip())
                    tables_count += 1
                    continue

            # Regular text block processing
            spans = [s for l in lines for s in l.get("spans", [])]
            # Paragraph text: Join consecutive lines with a single space to avoid broken paragraphs!
            line_texts = [" ".join(s.get("text", "") for s in l.get("spans", [])).strip() for l in lines]
            block_text = " ".join(t for t in line_texts if t).strip()
            block_text = re.sub(r"\s+", " ", block_text)
            
            if not block_text:
                i += 1
                continue

            first_span = spans[0]
            sz = round(first_span.get("size", 10), 1)
            flags = first_span.get("flags", 0)
            font_name = first_span.get("font", "").lower()
            is_bold = bool((flags & 16) or "bold" in font_name or "hebo" in font_name or "goth" in font_name)

            # 1. Document Title
            if pno == 0 and not doc_title and (sz >= body_size * 1.5 or (sz >= body_size * 1.35 and is_bold)) and len(block_text) < 120 and not re.match(r"^\d+\.", block_text):
                doc_title = block_text
                sections.append(f"# {block_text}")
                headings_count += 1
                i += 1
                continue

            # 2. Numbered and Stylistic Headings (H1, H2, H3)
            is_num_h3 = bool(re.match(r"^\d+\.\d+\.\d+\.?\s+[A-Za-z]", block_text))
            is_num_h2 = bool(re.match(r"^\d+\.\d+\.?\s+[A-Za-z]", block_text)) and not is_num_h3
            is_num_h1 = bool(re.match(r"^\d+\.?\s+[A-Za-z]", block_text) or re.match(r"^(Chapter|Section|Part|Unit|Appendix)\s+\d+[:\.]?\s*", block_text, re.IGNORECASE)) and not is_num_h2 and not is_num_h3
            is_title_heading = is_bold and (sz >= body_size * 1.35) and len(block_text) < 80 and not is_num_h2 and not is_num_h3

            if (is_num_h1 or is_title_heading or (sz >= body_size * 1.35 and is_bold)) and len(block_text) < 120:
                sections.append(f"## {block_text}")
                headings_count += 1
            elif (is_num_h2 or (sz >= body_size * 1.15 and is_bold and not is_num_h3)) and len(block_text) < 120:
                sections.append(f"### {block_text}")
                headings_count += 1
            elif (is_num_h3 or (sz >= body_size * 1.05 and is_bold and sz < body_size * 1.15)) and len(block_text) < 120:
                sections.append(f"#### {block_text}")
                headings_count += 1
            elif any(bullet in block_text for bullet in ("•", "▪", "▫", "\ufffd", "\u2022", "\u25cf", "–", "—")) or (block_text.startswith("- ") or block_text.startswith("* ")):
                for line in block_text.split("\n"):
                    clean_item = re.sub(r"^[^\w\s\(\[\"\']+\s*", "", line).strip()
                    if clean_item:
                        sections.append(f"- {clean_item}")
            else:
                # Normal paragraph
                sections.append(block_text)

            i += 1

    final_md = "\n\n".join(sections)
    return {
        "markdown": final_md,
        "pageCount": len(doc),
        "isScanned": len(final_md.strip()) < 20,
        "headings": headings_count,
        "tables": tables_count,
        "words": len(final_md.split()),
    }

if __name__ == "__main__":
    with open("OurPDF_Heading_Organizer_Test.pdf", "rb") as f:
        pdf_bytes = f.read()

    res = convert_pdf_to_markdown(pdf_bytes)
    print("=================== RESULT MARKDOWN ===================")
    print(res["markdown"])
    print("=================== STATS ===================")
    print("Headings:", res["headings"], "Tables:", res["tables"], "Words:", res["words"])
