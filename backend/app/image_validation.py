from dataclasses import dataclass

SUPPORTED_IMAGE_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})
DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024


@dataclass(frozen=True)
class ImageValidationResult:
    valid: bool
    code: str
    message: str


def validate_image_metadata(
    content_type: str,
    size_bytes: int,
    width: int | None = None,
    height: int | None = None,
    max_bytes: int = DEFAULT_MAX_UPLOAD_BYTES,
) -> ImageValidationResult:
    if content_type not in SUPPORTED_IMAGE_TYPES:
        return ImageValidationResult(
            False, "UNSUPPORTED_TYPE", "Only JPEG, PNG, or WebP images are supported."
        )
    if size_bytes <= 0:
        return ImageValidationResult(False, "EMPTY_FILE", "The image is empty.")
    if size_bytes > max_bytes:
        return ImageValidationResult(
            False,
            "FILE_TOO_LARGE",
            f"Images must be {max_bytes // (1024 * 1024)} MB or smaller.",
        )
    if width is not None and height is not None and (width < 256 or height < 256):
        return ImageValidationResult(
            False, "LOW_RESOLUTION", "Use an image at least 256 by 256 pixels."
        )
    return ImageValidationResult(
        True, "OK", "The image metadata is acceptable for the next quality-check step."
    )
