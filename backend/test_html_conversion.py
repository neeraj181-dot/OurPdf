import io
import base64
from xhtml2pdf import pisa
from PIL import Image

def test():
    img = Image.new('RGB', (100, 100), (29, 185, 84))
    buf = io.BytesIO()
    img.save(buf, 'PNG')
    b64 = base64.b64encode(buf.getvalue()).decode()
    uri = f"data:image/png;base64,{b64}"
    html = f"<html><body><h1>Img Test</h1><img src='{uri}' width='100' height='100' /></body></html>"
    out = io.BytesIO()
    s = pisa.CreatePDF(io.StringIO(html), dest=out)
    print("Err:", s.err, "Bytes:", len(out.getvalue()))

if __name__ == "__main__":
    test()
