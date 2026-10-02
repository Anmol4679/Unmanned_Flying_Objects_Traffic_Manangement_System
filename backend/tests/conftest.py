import pytest
from fastapi.testclient import TestClient
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from main import app

@pytest.fixture
def client():
    return TestClient(app)

# Helper to get a valid token for testing
def get_token(client, license_no, password):
    resp = client.post('/api/auth/login', json={'license_no': license_no, 'password': password})
    if resp.status_code == 200:
        return resp.json()['access_token']
    return None
