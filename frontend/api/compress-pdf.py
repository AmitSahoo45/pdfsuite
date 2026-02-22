import io
import os
import tempfile
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

import pikepdf

try:
    from vercel import blob as vercel_blob
except Exception:  # pragma: no cover - runtime dependency import
    vercel_blob = None


APP_NAME = "pdfsuite-compress-pdf"
MAX_SOURCE_BYTES = 25 * 1024 * 1024
SOURCE_DOWNLOAD_TIMEOUT_SECONDS = 20
ALLOWED_BLOB_HOST_SUFFIX = ".blob.vercel-storage.com"
ALLOWED_LEVELS = {"recommended", "less"}


class CompressionLevel(str, Enum):
    recommended = "recommended"
    less = "less"


class CompressPdfRequest(BaseModel):
    sourceBlobUrl: str = Field(min_length=1)
    level: CompressionLevel = CompressionLevel.recommended
    originalFilename: str | None = None


class CompressPdfResponse(BaseModel):
    level: CompressionLevel
    originalSizeBytes: int
    compressedSizeBytes: int
    reductionPercent: int
    outputFilename: str
    compressedBlobUrl: str
    downloadUrl: str | None = None


app = FastAPI(title=APP_NAME)


@app.get("/")
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "service": APP_NAME}


@app.post("/", response_model=CompressPdfResponse)
def compress_pdf_endpoint(payload: CompressPdfRequest) -> CompressPdfResponse:
    ensure_blob_sdk_available()
    ensure_blob_token_available()

    source_url = payload.sourceBlobUrl.strip()
    validate_blob_source_url(source_url)

    source_bytes = download_blob_bytes(source_url)
    if len(source_bytes) > MAX_SOURCE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Source PDF is too large ({len(source_bytes)} bytes). Max supported size is {MAX_SOURCE_BYTES} bytes.",
        )
    if not source_bytes.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Source file is not a valid PDF.")

    compressed_bytes = compress_pdf_bytes(source_bytes, payload.level)

    original_size = len(source_bytes)
    compressed_size = len(compressed_bytes)
    reduction_percent = 0
    if original_size > 0:
        reduction_percent = round((1 - (compressed_size / original_size)) * 100)

    output_filename = build_output_filename(payload.originalFilename)
    upload_result = upload_output_blob(compressed_bytes, output_filename)

    return CompressPdfResponse(
        level=payload.level,
        originalSizeBytes=original_size,
        compressedSizeBytes=compressed_size,
        reductionPercent=reduction_percent,
        outputFilename=output_filename,
        compressedBlobUrl=upload_result["url"],
        downloadUrl=upload_result.get("downloadUrl"),
    )


def ensure_blob_sdk_available() -> None:
    if vercel_blob is None:
        raise HTTPException(
            status_code=500,
            detail="Python Vercel Blob SDK is unavailable. Check requirements.txt deployment dependencies.",
        )


def ensure_blob_token_available() -> None:
    if not os.getenv("BLOB_READ_WRITE_TOKEN"):
        raise HTTPException(
            status_code=500,
            detail="BLOB_READ_WRITE_TOKEN is not configured.",
        )


def validate_blob_source_url(source_url: str) -> None:
    parsed = urlparse(source_url)
    if parsed.scheme != "https":
        raise HTTPException(status_code=400, detail="Only https Blob URLs are allowed.")
    if not parsed.netloc.endswith(ALLOWED_BLOB_HOST_SUFFIX):
        raise HTTPException(status_code=400, detail="Only Vercel Blob URLs are allowed.")


def download_blob_bytes(source_url: str) -> bytes:
    try:
        req = Request(
            source_url,
            method="GET",
            headers={"User-Agent": f"{APP_NAME}/1.0"},
        )
        with urlopen(req, timeout=SOURCE_DOWNLOAD_TIMEOUT_SECONDS) as response:
            content_length = response.headers.get("Content-Length")
            if content_length:
                try:
                    expected = int(content_length)
                    if expected > MAX_SOURCE_BYTES:
                        raise HTTPException(
                            status_code=413,
                            detail=f"Source PDF is too large ({expected} bytes). Max supported size is {MAX_SOURCE_BYTES} bytes.",
                        )
                except ValueError:
                    pass

            data = response.read(MAX_SOURCE_BYTES + 1)
            if len(data) > MAX_SOURCE_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"Source PDF exceeds max supported size of {MAX_SOURCE_BYTES} bytes.",
                )
            return data
    except HTTPException:
        raise
    except HTTPError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to download source Blob ({exc.code}).",
        ) from exc
    except URLError as exc:
        raise HTTPException(
            status_code=400,
            detail="Unable to reach source Blob URL.",
        ) from exc


def build_output_filename(original_filename: str | None) -> str:
    if original_filename:
        base = Path(original_filename).name
    else:
        base = "document.pdf"

    stem = Path(base).stem or "document"
    safe_stem = "".join(ch if ch.isalnum() or ch in ("-", "_", ".") else "_" for ch in stem)
    return f"{safe_stem}_compressed.pdf"


def build_output_blob_path(output_filename: str) -> str:
    now = datetime.now(timezone.utc)
    date_prefix = now.strftime("%Y/%m/%d")
    return f"compress-outputs/{date_prefix}/{uuid.uuid4().hex}_{output_filename}"


def upload_output_blob(data: bytes, output_filename: str) -> dict[str, str | None]:
    if vercel_blob is None:
        raise HTTPException(status_code=500, detail="Vercel Blob SDK is unavailable.")

    blob_path = build_output_blob_path(output_filename)
    temp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            temp_path = tmp.name
            tmp.write(data)

        uploaded = vercel_blob.upload_file(
            local_path=temp_path,
            path=blob_path,
            access="public",
        )

        uploaded_data = coerce_blob_result(uploaded)
        blob_url = uploaded_data.get("url")
        if not blob_url:
            raise HTTPException(
                status_code=500,
                detail="Blob upload completed but no URL was returned.",
            )
        return {
            "url": blob_url,
            "downloadUrl": uploaded_data.get("download_url") or uploaded_data.get("downloadUrl"),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload compressed PDF to Blob: {exc}",
        ) from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


def coerce_blob_result(uploaded: Any) -> dict[str, Any]:
    if uploaded is None:
        return {}
    if isinstance(uploaded, dict):
        return uploaded

    result: dict[str, Any] = {}
    for key in ("url", "download_url", "downloadUrl", "pathname", "content_type", "size"):
        if hasattr(uploaded, key):
            result[key] = getattr(uploaded, key)
    return result


def compress_pdf_bytes(pdf_bytes: bytes, level: CompressionLevel) -> bytes:
    output_stream = io.BytesIO()
    with pikepdf.open(io.BytesIO(pdf_bytes)) as pdf:
        try:
            pdf.remove_unreferenced_resources()
        except Exception:
            pass

        if level == CompressionLevel.recommended:
            strip_metadata(pdf)
            recompress_images(pdf, jpeg_quality=55)
            pdf.save(
                output_stream,
                compress_streams=True,
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
                linearize=True,
                recompress_flate=True,
            )
        elif level == CompressionLevel.less:
            pdf.save(
                output_stream,
                compress_streams=True,
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
                linearize=True,
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported compression level: {level}")

    return output_stream.getvalue()


def strip_metadata(pdf: pikepdf.Pdf) -> None:
    try:
        with pdf.open_metadata() as metadata:
            for key in list(metadata.keys()):
                del metadata[key]
    except Exception:
        pass

    try:
        if "/Info" in pdf.trailer:
            del pdf.trailer["/Info"]
    except Exception:
        pass


def recompress_images(pdf: pikepdf.Pdf, jpeg_quality: int) -> None:
    try:
        from PIL import Image, ImageFile
    except Exception:
        return

    ImageFile.LOAD_TRUNCATED_IMAGES = True

    for page in pdf.pages:
        try:
            resources = page.get("/Resources", {})
            xobjects = resources.get("/XObject", {})
        except Exception:
            continue

        for _, obj_ref in getattr(xobjects, "items", lambda: [])():
            try:
                stream_obj = obj_ref
                if not isinstance(stream_obj, pikepdf.Stream):
                    continue
                if stream_obj.get("/Subtype") != "/Image":
                    continue

                filters = stream_obj.get("/Filter")
                filter_name = ""
                if isinstance(filters, pikepdf.Array) and len(filters) > 0:
                    filter_name = str(filters[-1])
                elif filters:
                    filter_name = str(filters)

                if "/DCTDecode" not in filter_name:
                    continue

                raw_jpeg = stream_obj.read_raw_bytes()
                img = Image.open(io.BytesIO(raw_jpeg))

                if img.mode not in ("L", "RGB", "CMYK"):
                    img = img.convert("RGB")

                out = io.BytesIO()
                img.save(out, format="JPEG", quality=jpeg_quality, optimize=True)
                stream_obj.write(out.getvalue(), filter=pikepdf.Name("/DCTDecode"))
            except Exception:
                continue
