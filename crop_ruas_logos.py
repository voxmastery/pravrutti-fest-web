import fitz # PyMuPDF

doc = fitz.open("images/images.pdf")
page = doc[1]

# Crop color RUAS logo
clip_color = fitz.Rect(25.0, 55.0, 390.0, 205.0)
pix_color = page.get_pixmap(matrix=fitz.Matrix(4, 4), clip=clip_color)
pix_color.save("public/ruas-logo-color.png")
print("Saved public/ruas-logo-color.png")

# Crop white RUAS logo
clip_white = fitz.Rect(35.0, 280.0, 390.0, 410.0)
pix_white = page.get_pixmap(matrix=fitz.Matrix(4, 4), clip=clip_white)
pix_white.save("public/ruas-logo-white.png")
print("Saved public/ruas-logo-white.png")

doc.close()
