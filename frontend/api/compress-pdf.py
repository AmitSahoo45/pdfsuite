from collections import deque
import io
import json
import os
import tempfile
import time
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from threading import Lock
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlparse
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException, Request as FastAPIRequest
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import pikepdf

try:
    from vercel import blob as vercel_blob
except Exception:  # pragma: no cover - runtime dependency import
    vercel_blob = None


APP_NAME = "pdfsuite-compress-pdf"
MAX_SOURCE_BYTES = 25 * 1024 * 1024
MAX_OUTPUT_BYTES = 25 * 1024 * 1024
SOURCE_DOWNLOAD_TIMEOUT_SECONDS = 20
MAX_PROCESS_SECONDS = 25
ALLOWED_BLOB_HOST_SUFFIX = ".blob.vercel-storage.com"
ALLOWED_SOURCE_PATH_PREFIX = "/compress-inputs/"
ALLOWED_LEVELS = {"recommended", "less"}
MAX_ORIGINAL_FILENAME_CHARS = 200
MAX_OUTPUT_FILENAME_CHARS = 180
RECOMMENDED_MAX_IMAGE_EDGE = 2200
MIN_VALID_PDF_BYTES = 5
MAX_SOURCE_URL_CHARS = 4096
MAX_SOURCE_URL_QUERY_CHARS = 2048
MAX_SOURCE_URL_QUERY_PARAMS = 25
DEFAULT_ALLOWED_BROWSER_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
)
DEFAULT_COMPRESS_RATE_LIMIT_WINDOW_SECONDS = 5 * 60
DEFAULT_COMPRESS_RATE_LIMIT_MAX_REQUESTS = 20
DEFAULT_OUTPUT_BLOB_ACCESS = "public"


def normalize_origin(origin: str) -> str | None:
    value = origin.strip()
    if not value:
        return None

    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"}:
        return None
    if not parsed.hostname:
        return None
    if parsed.username or parsed.password:
        return None
    if parsed.path not in ("", "/"):
        return None
    if parsed.query or parsed.fragment:
        return None

    host = parsed.hostname.lower()
    port = parsed.port
    default_port = 80 if parsed.scheme == "http" else 443
    if port and port != default_port:
        return f"{parsed.scheme}://{host}:{port}"
    return f"{parsed.scheme}://{host}"


def parse_allowed_browser_origins() -> set[str]:
    raw = os.getenv("COMPRESS_API_ALLOWED_ORIGINS", "").strip()
    candidates = [item.strip() for item in raw.split(",") if item.strip()] if raw else list(DEFAULT_ALLOWED_BROWSER_ORIGINS)

    origins: set[str] = set()
    for candidate in candidates:
        normalized = normalize_origin(candidate)
        if normalized:
            origins.add(normalized)
    return origins


ALLOWED_BROWSER_ORIGINS = parse_allowed_browser_origins()
_RATE_LIMIT_LOCK = Lock()
_RATE_LIMIT_BUCKETS: dict[str, deque[float]] = {}


class CompressionLevel(str, Enum):
    recommended = "recommended"
    less = "less"


class CompressPdfRequest(BaseModel):
    sourceBlobUrl: str = Field(min_length=1, max_length=MAX_SOURCE_URL_CHARS)
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
if ALLOWED_BROWSER_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=sorted(ALLOWED_BROWSER_ORIGINS),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
    )


@app.get("/")
@app.get("/api/compress-pdf")
@app.get("/api/compress-pdf/")
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "service": APP_NAME}


@app.post("/", response_model=CompressPdfResponse)
@app.post("/api/compress-pdf", response_model=CompressPdfResponse)
@app.post("/api/compress-pdf/", response_model=CompressPdfResponse)
def compress_pdf_endpoint(payload: CompressPdfRequest, request: FastAPIRequest) -> CompressPdfResponse:
    request_id = uuid.uuid4().hex[:12]
    started_at = time.monotonic()
    client_ip = get_client_ip(request)

    log_event(
        "compress.request.received",
        requestId=request_id,
        clientIp=client_ip,
        level=str(payload.level.value if isinstance(payload.level, CompressionLevel) else payload.level),
        hasOriginalFilename=bool(payload.originalFilename),
    )

    ensure_blob_sdk_available()
    ensure_blob_token_available()

    source_url = payload.sourceBlobUrl.strip()
    try:
        enforce_allowed_request_origin(request)
        enforce_rate_limit(client_ip)
        validate_original_filename(payload.originalFilename)
        validate_blob_source_url(source_url)

        source_bytes = download_blob_bytes(source_url)
        enforce_time_budget(started_at, "downloading source PDF")

        if len(source_bytes) < MIN_VALID_PDF_BYTES:
            raise HTTPException(status_code=400, detail="Source file is too small to be a valid PDF.")
        if len(source_bytes) > MAX_SOURCE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Source PDF is too large ({len(source_bytes)} bytes). Max supported size is {MAX_SOURCE_BYTES} bytes.",
            )
        if not source_bytes.startswith(b"%PDF-"):
            raise HTTPException(status_code=400, detail="Source file is not a valid PDF.")

        compressed_bytes = compress_pdf_bytes(source_bytes, payload.level, started_at)
        enforce_time_budget(started_at, "compressing PDF")

        if len(compressed_bytes) == 0 or not compressed_bytes.startswith(b"%PDF-"):
            raise HTTPException(status_code=500, detail="Compression produced an invalid PDF output.")
        if len(compressed_bytes) > MAX_OUTPUT_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Compressed PDF is too large ({len(compressed_bytes)} bytes). Max supported size is {MAX_OUTPUT_BYTES} bytes.",
            )

        original_size = len(source_bytes)
        compressed_size = len(compressed_bytes)
        reduction_percent = 0
        if original_size > 0:
            reduction_percent = round((1 - (compressed_size / original_size)) * 100)
        reduction_percent = max(0, reduction_percent)

        output_filename = build_output_filename(payload.originalFilename)
        upload_result = upload_output_blob(compressed_bytes, output_filename)
        enforce_time_budget(started_at, "uploading compressed PDF")
        delete_source_blob_best_effort(source_url, request_id=request_id)

        elapsed_ms = round((time.monotonic() - started_at) * 1000)
        log_event(
            "compress.request.completed",
            requestId=request_id,
            originalSizeBytes=original_size,
            compressedSizeBytes=compressed_size,
            reductionPercent=reduction_percent,
            elapsedMs=elapsed_ms,
            level=str(payload.level.value if isinstance(payload.level, CompressionLevel) else payload.level),
        )

        return CompressPdfResponse(
            level=payload.level,
            originalSizeBytes=original_size,
            compressedSizeBytes=compressed_size,
            reductionPercent=reduction_percent,
            outputFilename=output_filename,
            compressedBlobUrl=upload_result["url"],
            downloadUrl=upload_result.get("downloadUrl"),
        )
    except HTTPException as exc:
        log_event(
            "compress.request.rejected",
            requestId=request_id,
            statusCode=exc.status_code,
            detail=str(exc.detail),
            elapsedMs=round((time.monotonic() - started_at) * 1000),
        )
        raise
    except pikepdf.PdfError as exc:
        log_event(
            "compress.request.pdf_error",
            requestId=request_id,
            errorType=type(exc).__name__,
            elapsedMs=round((time.monotonic() - started_at) * 1000),
        )
        raise HTTPException(
            status_code=400,
            detail="Unable to read or compress this PDF. The file may be corrupted or unsupported.",
        ) from exc
    except Exception as exc:
        log_event(
            "compress.request.failed",
            requestId=request_id,
            clientIp=client_ip,
            errorType=type(exc).__name__,
            elapsedMs=round((time.monotonic() - started_at) * 1000),
        )
        raise HTTPException(
            status_code=500,
            detail="Internal compression error. Please try again or use a smaller PDF.",
        ) from exc


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


def log_event(event: str, **fields: Any) -> None:
    payload = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "service": APP_NAME,
        "event": event,
    }
    payload.update(fields)
    try:
        print(json.dumps(payload, default=str))
    except Exception:
        print(f"[{APP_NAME}] {event}: {fields}")


def read_int_env(name: str, default: int, *, minimum: int = 1) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return max(minimum, value)


def get_client_ip(request: FastAPIRequest) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip:
        return x_real_ip.strip()
    return "unknown"


def build_request_origin(request: FastAPIRequest) -> str | None:
    forwarded_proto = request.headers.get("x-forwarded-proto")
    scheme = (forwarded_proto.split(",")[0].strip() if forwarded_proto else request.url.scheme or "https").lower()
    forwarded_host = request.headers.get("x-forwarded-host")
    host = (forwarded_host.split(",")[0].strip() if forwarded_host else (request.headers.get("host") or request.url.netloc))
    if not host:
        return None
    return normalize_origin(f"{scheme}://{host}")


def enforce_allowed_request_origin(request: FastAPIRequest) -> None:
    origin = request.headers.get("origin")
    if not origin:
        return

    normalized_origin = normalize_origin(origin)
    if not normalized_origin:
        raise HTTPException(status_code=403, detail="Invalid Origin header.")

    request_origin = build_request_origin(request)
    if request_origin and normalized_origin == request_origin:
        return
    if normalized_origin in ALLOWED_BROWSER_ORIGINS:
        return

    raise HTTPException(status_code=403, detail="Origin is not allowed.")


def enforce_rate_limit(client_ip: str) -> None:
    window_seconds = read_int_env(
        "COMPRESS_RATE_LIMIT_WINDOW_SECONDS",
        DEFAULT_COMPRESS_RATE_LIMIT_WINDOW_SECONDS,
    )
    max_requests = read_int_env(
        "COMPRESS_RATE_LIMIT_MAX_REQUESTS",
        DEFAULT_COMPRESS_RATE_LIMIT_MAX_REQUESTS,
    )
    now = time.monotonic()
    bucket_key = f"compress:{client_ip}"

    retry_after_seconds = 1
    with _RATE_LIMIT_LOCK:
        bucket = _RATE_LIMIT_BUCKETS.setdefault(bucket_key, deque())
        cutoff = now - window_seconds
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()

        if len(bucket) >= max_requests:
            retry_after_seconds = max(1, int(window_seconds - (now - bucket[0])))
        else:
            bucket.append(now)
            if len(_RATE_LIMIT_BUCKETS) > 5000:
                empty_keys = [key for key, values in _RATE_LIMIT_BUCKETS.items() if not values]
                for key in empty_keys:
                    _RATE_LIMIT_BUCKETS.pop(key, None)
            return

    raise HTTPException(
        status_code=429,
        detail="Too many compression requests. Please wait before trying again.",
        headers={"Retry-After": str(retry_after_seconds)},
    )


def enforce_time_budget(started_at: float, stage: str) -> None:
    elapsed = time.monotonic() - started_at
    if elapsed > MAX_PROCESS_SECONDS:
        raise HTTPException(
            status_code=504,
            detail=f"Compression timed out while {stage}. Try a smaller file or use Less compression.",
        )


def validate_original_filename(filename: str | None) -> None:
    if filename is None:
        return
    if len(filename.strip()) == 0:
        raise HTTPException(status_code=400, detail="originalFilename cannot be empty.")
    if len(filename) > MAX_ORIGINAL_FILENAME_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"originalFilename is too long. Max length is {MAX_ORIGINAL_FILENAME_CHARS} characters.",
        )


def validate_blob_source_url(source_url: str) -> None:
    if len(source_url) > MAX_SOURCE_URL_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Blob URL is too long. Max length is {MAX_SOURCE_URL_CHARS} characters.",
        )

    parsed = urlparse(source_url)
    if parsed.scheme != "https":
        raise HTTPException(status_code=400, detail="Only https Blob URLs are allowed.")
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="Blob URL must not contain credentials.")
    if parsed.fragment:
        raise HTTPException(status_code=400, detail="Blob URL fragments are not allowed.")

    hostname = parsed.hostname or ""
    if not hostname.endswith(ALLOWED_BLOB_HOST_SUFFIX):
        raise HTTPException(status_code=400, detail="Only Vercel Blob URLs are allowed.")
    if parsed.port not in (None, 443):
        raise HTTPException(status_code=400, detail="Only standard https Blob URLs are allowed.")
    if not parsed.path.startswith(ALLOWED_SOURCE_PATH_PREFIX):
        raise HTTPException(status_code=400, detail="Blob URL must be a compress-pdf input upload.")

    if len(parsed.query) > MAX_SOURCE_URL_QUERY_CHARS:
        raise HTTPException(status_code=400, detail="Blob URL query string is too long.")
    if parsed.query:
        query_items = parse_qsl(parsed.query, keep_blank_values=True)
        if len(query_items) > MAX_SOURCE_URL_QUERY_PARAMS:
            raise HTTPException(status_code=400, detail="Blob URL contains too many query parameters.")


def is_allowed_blob_content_type(content_type: str | None) -> bool:
    if not content_type:
        return True
    normalized = content_type.lower()
    return ("application/pdf" in normalized) or ("application/octet-stream" in normalized)


def download_blob_bytes(source_url: str) -> bytes:
    try:
        req = Request(
            source_url,
            method="GET",
            headers={"User-Agent": f"{APP_NAME}/1.0"},
        )
        with urlopen(req, timeout=SOURCE_DOWNLOAD_TIMEOUT_SECONDS) as response:
            content_type = response.headers.get("Content-Type")
            if not is_allowed_blob_content_type(content_type):
                raise HTTPException(status_code=400, detail="Source Blob content type is not a PDF.")

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
    safe_stem = "".join(ch if ch.isalnum() or ch in ("-", "_", ".") else "_" for ch in stem).strip("._")
    if not safe_stem:
        safe_stem = "document"
    suffix = "_compressed.pdf"
    max_stem_len = max(1, MAX_OUTPUT_FILENAME_CHARS - len(suffix))
    safe_stem = safe_stem[:max_stem_len]
    return f"{safe_stem}{suffix}"


def build_output_blob_path(output_filename: str) -> str:
    now = datetime.now(timezone.utc)
    date_prefix = now.strftime("%Y/%m/%d")
    return f"compress-outputs/{date_prefix}/{uuid.uuid4().hex}_{output_filename}"


def get_output_blob_access() -> str:
    raw = (os.getenv("COMPRESS_OUTPUT_BLOB_ACCESS") or DEFAULT_OUTPUT_BLOB_ACCESS).strip().lower()
    if raw in {"public", "private"}:
        return raw
    log_event(
        "compress.output_blob.invalid_access_config",
        configuredValue=raw,
        fallbackAccess=DEFAULT_OUTPUT_BLOB_ACCESS,
    )
    return DEFAULT_OUTPUT_BLOB_ACCESS


def upload_output_blob(data: bytes, output_filename: str) -> dict[str, str | None]:
    if vercel_blob is None:
        raise HTTPException(status_code=500, detail="Vercel Blob SDK is unavailable.")

    blob_path = build_output_blob_path(output_filename)
    temp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            temp_path = tmp.name
            tmp.write(data)

        access = get_output_blob_access()
        uploaded = vercel_blob.upload_file(
            local_path=temp_path,
            path=blob_path,
            access=access,
        )

        uploaded_data = coerce_blob_result(uploaded)
        blob_url = uploaded_data.get("url")
        download_url = uploaded_data.get("download_url") or uploaded_data.get("downloadUrl")
        if not blob_url:
            raise HTTPException(
                status_code=500,
                detail="Blob upload completed but no URL was returned.",
            )
        if access == "private" and not download_url:
            raise HTTPException(
                status_code=500,
                detail="Blob upload completed but no private download URL was returned.",
            )
        return {
            "url": blob_url,
            "downloadUrl": download_url,
        }
    except HTTPException:
        raise
    except Exception as exc:
        log_event(
            "compress.output_blob.upload_failed",
            errorType=type(exc).__name__,
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to upload compressed PDF to Blob.",
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


def delete_source_blob_best_effort(source_url: str, *, request_id: str) -> None:
    if vercel_blob is None:
        return

    enabled = (os.getenv("COMPRESS_DELETE_SOURCE_BLOB", "1").strip().lower() not in {"0", "false", "no"})
    if not enabled:
        return

    delete_fn = (
        getattr(vercel_blob, "delete", None)
        or getattr(vercel_blob, "del_", None)
        or getattr(vercel_blob, "del", None)
    )
    if not callable(delete_fn):
        log_event("compress.source_blob.delete_unavailable", requestId=request_id)
        return

    parsed = urlparse(source_url)
    candidates = [source_url]
    pathname = parsed.path.lstrip("/")
    if pathname and pathname not in candidates:
        candidates.append(pathname)

    for candidate in candidates:
        try:
            delete_fn(candidate)
            log_event("compress.source_blob.deleted", requestId=request_id, via="single")
            return
        except TypeError:
            try:
                delete_fn([candidate])
                log_event("compress.source_blob.deleted", requestId=request_id, via="list")
                return
            except Exception as exc:
                last_error = exc
        except Exception as exc:
            last_error = exc

    log_event(
        "compress.source_blob.delete_failed",
        requestId=request_id,
        errorType=type(last_error).__name__ if "last_error" in locals() else "UnknownError",
    )


def compress_pdf_bytes(pdf_bytes: bytes, level: CompressionLevel, started_at: float) -> bytes:
    output_stream = io.BytesIO()
    with pikepdf.open(io.BytesIO(pdf_bytes)) as pdf:
        enforce_time_budget(started_at, "opening PDF")
        try:
            pdf.remove_unreferenced_resources()
        except Exception:
            pass

        if level == CompressionLevel.recommended:
            strip_metadata(pdf)
            recompress_images(
                pdf,
                jpeg_quality=55,
                started_at=started_at,
                max_image_edge=RECOMMENDED_MAX_IMAGE_EDGE,
            )
            enforce_time_budget(started_at, "optimizing images")
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

    result = output_stream.getvalue()
    if not result:
        raise HTTPException(status_code=500, detail="Compression produced an empty PDF.")
    return result


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


def recompress_images(
    pdf: pikepdf.Pdf,
    jpeg_quality: int,
    started_at: float,
    max_image_edge: int | None = None,
) -> None:
    try:
        from PIL import Image, ImageFile
    except Exception:
        return

    previous_load_truncated_images = getattr(ImageFile, "LOAD_TRUNCATED_IMAGES", False)
    ImageFile.LOAD_TRUNCATED_IMAGES = True
    resampling = getattr(getattr(Image, "Resampling", Image), "LANCZOS", Image.LANCZOS)

    try:
        for page in pdf.pages:
            enforce_time_budget(started_at, "processing embedded images")
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

                    if max_image_edge and max_image_edge > 0:
                        longest_edge = max(img.size) if img.size else 0
                        if longest_edge > max_image_edge:
                            scale = max_image_edge / float(longest_edge)
                            resized = (
                                max(1, int(img.size[0] * scale)),
                                max(1, int(img.size[1] * scale)),
                            )
                            img = img.resize(resized, resample=resampling)

                    out = io.BytesIO()
                    img.save(out, format="JPEG", quality=jpeg_quality, optimize=True, progressive=True)
                    next_jpeg = out.getvalue()
                    if len(next_jpeg) >= len(raw_jpeg):
                        continue
                    stream_obj.write(next_jpeg, filter=pikepdf.Name("/DCTDecode"))
                except Exception:
                    continue
    finally:
        ImageFile.LOAD_TRUNCATED_IMAGES = previous_load_truncated_images
