import fitz # PyMuPDF

doc = fitz.open("images/images.pdf")
print("Image Info for Page 1:")
page = doc[1]
for idx, info in enumerate(page.get_image_info(xrefs=True)):
    print(f"Index {idx}: bbox={info['bbox']}, width={info['width']}, height={info['height']}, xref={info['xref']}")
doc.close()
