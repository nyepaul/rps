import pytest

from src.app import create_app
from src.config import ProductionConfig


def test_production_requires_encryption_key(monkeypatch):
    monkeypatch.setattr(ProductionConfig, "ENCRYPTION_KEY", None)
    monkeypatch.setattr(ProductionConfig, "SECRET_KEY", "test-secret")

    with pytest.raises(ValueError, match="ENCRYPTION_KEY"):
        create_app("production")


def test_production_requires_non_default_secret_key(monkeypatch):
    monkeypatch.setattr(ProductionConfig, "ENCRYPTION_KEY", "test-encryption-key")
    monkeypatch.setattr(
        ProductionConfig, "SECRET_KEY", "dev-secret-key-change-in-production"
    )

    with pytest.raises(ValueError, match="SECRET_KEY"):
        create_app("production")
