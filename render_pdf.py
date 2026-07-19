import fitz # PyMuPDF
import os

pdf_path = "images/images.pdf"
doc = fitz.open(pdf_path)
print(f"Total pages: {len(doc)}")

for page_num in range(len(doc)):
    page = doc[page_num]
    pix = page.get_pixmap(matrix=fitz.Matrix(3, 3))
    out_path = f"public/pdf-page-{page_num}.png"
    pix.save(out_path)
    print(f"Saved {out_path} with size {pix.width}x{pix.height}")
