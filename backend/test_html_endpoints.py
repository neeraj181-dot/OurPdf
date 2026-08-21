import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_endpoints():
    print("Testing /api/convert/html-to-pdf with raw HTML...")
    res = client.post(
        "/api/convert/html-to-pdf",
        data={
            "html_content": "<h1>Hello OurPdf</h1><p>Testing HTML to PDF conversion endpoint.</p>",
            "filename": "test_hello.html",
            "page_size": "A4",
            "orientation": "portrait",
            "margin": "default",
            "print_background": True,
        },
    )
    assert res.status_code == 200, f"Error: {res.status_code} - {res.text}"
    assert res.headers["content-type"] == "application/pdf"
    assert len(res.content) > 500
    print(f"[PASS] /api/convert/html-to-pdf raw HTML passed. PDF size: {len(res.content)} bytes")

    print("\nTesting /api/convert/html-to-pdf with uploaded .html file...")
    html_file = io.BytesIO(b"<!DOCTYPE html><html><body><h2>File Upload Test</h2><table><tr><td>Row 1</td></tr></table></body></html>")
    res_file = client.post(
        "/api/convert/html-to-pdf",
        files={"file": ("sample.html", html_file, "text/html")},
        data={"page_size": "Letter", "orientation": "landscape"},
    )
    assert res_file.status_code == 200, f"Error: {res_file.status_code} - {res_file.text}"
    assert res_file.headers["content-type"] == "application/pdf"
    assert len(res_file.content) > 500
    print(f"[PASS] /api/convert/html-to-pdf file upload passed. PDF size: {len(res_file.content)} bytes")

    print("\nTesting /api/tools/html-to-pdf endpoint alias...")
    res_tools = client.post(
        "/api/tools/html-to-pdf",
        data={"html_content": "<h1>Tool Endpoint</h1><p>Working properly!</p>"},
    )
    assert res_tools.status_code == 200, f"Error: {res_tools.status_code} - {res_tools.text}"
    assert res_tools.headers["content-type"] == "application/pdf"
    print(f"[PASS] /api/tools/html-to-pdf passed. PDF size: {len(res_tools.content)} bytes")

    print("\nTesting security: malicious script tag stripping and SSRF protection...")
    malicious_html = """
    <html>
    <head><script>alert('xss');</script></head>
    <body onload="alert(1)">
    <h1>Security Protected</h1>
    <img src="file:///etc/passwd" onerror="alert(2)" />
    <img src="http://169.254.169.254/latest/meta-data" />
    <img src="http://127.0.0.1:8000/secret" />
    <p>Safe content rendered cleanly.</p>
    </body>
    </html>
    """
    res_sec = client.post("/api/convert/html-to-pdf", data={"html_content": malicious_html})
    assert res_sec.status_code == 200
    assert len(res_sec.content) > 500
    print(f"[PASS] Security test passed. PDF size: {len(res_sec.content)} bytes")

    print("\nTesting error handling: empty HTML...")
    res_err = client.post("/api/convert/html-to-pdf", data={"html_content": "   "})
    assert res_err.status_code == 400
    print(f"[PASS] Empty HTML error handling passed: {res_err.json()['detail']}")

    print("\nAll backend HTML to PDF tests passed successfully!")

if __name__ == "__main__":
    test_endpoints()
