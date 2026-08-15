import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_full_api():
    # 1. Register
    email = "integration_test@easypdf.com"
    password = "SecurePassword123!"
    name = "Integration Tester"

    print("1. Testing Register...")
    reg_resp = client.post("/api/auth/register", json={
        "name": name,
        "email": email,
        "password": password
    })
    if reg_resp.status_code == 400 and "already exists" in reg_resp.text:
        print("User already registered. Logging in...")
        login_resp = client.post("/api/auth/login", json={
            "email": email,
            "password": password
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json()["access_token"]
    else:
        assert reg_resp.status_code == 201, f"Register failed: {reg_resp.text}"
        token = reg_resp.json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get Me
    print("2. Testing Get /auth/me...")
    me_resp = client.get("/api/auth/me", headers=headers)
    assert me_resp.status_code == 200, f"Get me failed: {me_resp.text}"
    user = me_resp.json()
    print("User authenticated:", user["name"], user["email"])

    # 3. Upload Document to My Documents
    print("3. Testing Upload /documents...")
    fake_pdf = b"%PDF-1.4 test document content for testing"
    files = {"file": ("test_doc.pdf", io.BytesIO(fake_pdf), "application/pdf")}
    data = {"operation": "save"}
    up_resp = client.post("/api/documents", headers=headers, files=files, data=data)
    assert up_resp.status_code == 201, f"Upload document failed: {up_resp.text}"
    doc = up_resp.json()
    doc_id = doc["id"]
    print("Document uploaded with ID:", doc_id, doc["original_filename"])

    # 4. List Documents
    print("4. Testing List /documents...")
    list_resp = client.get("/api/documents", headers=headers)
    assert list_resp.status_code == 200
    docs = list_resp.json()
    assert any(d["id"] == doc_id for d in docs)
    print("Documents listed successfully:", len(docs), "docs")

    # 5. Download Document
    print("5. Testing Download /documents/{id}/download...")
    dl_resp = client.get(f"/api/documents/{doc_id}/download", headers=headers)
    assert dl_resp.status_code == 200
    assert dl_resp.content == fake_pdf
    print("Document downloaded successfully, binary content matches!")

    # 6. Check Processing History
    print("6. Testing /history...")
    hist_resp = client.get("/api/history", headers=headers)
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) > 0
    print("History record found:", history[0]["operation"])

    # 7. Delete Document
    print("7. Testing Delete /documents/{id}...")
    del_resp = client.delete(f"/api/documents/{doc_id}", headers=headers)
    assert del_resp.status_code == 200
    print("Document deleted successfully!")

    print("\nALL BACKEND AUTH, DOCUMENT, STORAGE & HISTORY TESTS PASSED 100%!")

if __name__ == "__main__":
    test_full_api()
