import io
import requests

BASE_URL = "http://127.0.0.1:8000/api"

def test_full_flow():
    # 1. Register User
    email = "testuser@easypdf.com"
    password = "SecurePassword123!"
    name = "Test User"

    print("Testing Register...")
    reg_resp = requests.post(f"{BASE_URL}/auth/register", json={
        "name": name,
        "email": email,
        "password": password
    })
    
    if reg_resp.status_code == 400 and "already exists" in reg_resp.text:
        print("User already registered. Logging in...")
        login_resp = requests.post(f"{BASE_URL}/auth/login", json={
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
    print("Testing Get /auth/me...")
    me_resp = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    assert me_resp.status_code == 200, f"Get me failed: {me_resp.text}"
    user = me_resp.json()
    print("User authenticated:", user["name"], user["email"])

    # 3. Upload Document to My Documents
    print("Testing Upload /documents...")
    fake_pdf = b"%PDF-1.4 test document content"
    files = {"file": ("test_doc.pdf", io.BytesIO(fake_pdf), "application/pdf")}
    data = {"operation": "save"}
    up_resp = requests.post(f"{BASE_URL}/documents", headers=headers, files=files, data=data)
    assert up_resp.status_code == 201, f"Upload document failed: {up_resp.text}"
    doc = up_resp.json()
    doc_id = doc["id"]
    print("Document uploaded with ID:", doc_id, doc["original_filename"])

    # 4. List Documents
    print("Testing List /documents...")
    list_resp = requests.get(f"{BASE_URL}/documents", headers=headers)
    assert list_resp.status_code == 200
    docs = list_resp.json()
    assert any(d["id"] == doc_id for d in docs)
    print("Documents listed successfully:", len(docs), "docs")

    # 5. Download Document
    print("Testing Download /documents/{id}/download...")
    dl_resp = requests.get(f"{BASE_URL}/documents/{doc_id}/download", headers=headers)
    assert dl_resp.status_code == 200
    assert dl_resp.content == fake_pdf
    print("Document downloaded successfully, content matches!")

    # 6. Check Processing History
    print("Testing /history...")
    hist_resp = requests.get(f"{BASE_URL}/history", headers=headers)
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) > 0
    print("History record found:", history[0]["operation"])

    # 7. Delete Document
    print("Testing Delete /documents/{id}...")
    del_resp = requests.delete(f"{BASE_URL}/documents/{doc_id}", headers=headers)
    assert del_resp.status_code == 200
    print("Document deleted successfully!")

    print("\nALL BACKEND AUTH, DOCUMENT & STORAGE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_full_flow()
