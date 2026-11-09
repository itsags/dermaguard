from app.image_validation import validate_image_metadata


def test_accepts_supported_image_metadata():
    result = validate_image_metadata('image/jpeg', 1024, 512, 512)
    assert result.valid is True
    assert result.code == 'OK'


def test_rejects_unsupported_type_and_small_image():
    assert validate_image_metadata('image/gif', 1024).code == 'UNSUPPORTED_TYPE'
    assert validate_image_metadata('image/png', 1024, 100, 100).code == 'LOW_RESOLUTION'


def test_rejects_large_image():
    assert validate_image_metadata('image/webp', 11 * 1024 * 1024).code == 'FILE_TOO_LARGE'
