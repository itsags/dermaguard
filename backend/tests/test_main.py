from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
def test_health():
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}
def test_signing_requires_authentication():
    response = client.post('/uploads/sign', json={'case_id': 'x', 'filename': 'photo.jpg', 'content_type': 'image/jpeg'})
    assert response.status_code == 401
