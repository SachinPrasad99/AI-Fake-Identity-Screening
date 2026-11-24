import os
import sys
import uuid
import json
import datetime
import cv2
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Ensure backend directory is in sys.path for robust imports
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

try:
    from services.ocr import extract_text
    from services.document_analysis import (
        detect_document_type,
        validate_identifier_format,
        extract_document_fields,
        check_document_consistency,
        analyze_image_quality,
        screen_image_anomalies,
        run_advanced_forensics,
        generate_screening_result
    )
except ImportError:
    from backend.services.ocr import extract_text
    from backend.services.document_analysis import (
        detect_document_type,
        validate_identifier_format,
        extract_document_fields,
        check_document_consistency,
        analyze_image_quality,
        screen_image_anomalies,
        run_advanced_forensics,
        generate_screening_result
    )

app = Flask(__name__)

# Security & CORS configuration
CORS(app, resources={r"/*": {"origins": "*"}})

UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
REPORTS_FOLDER = os.path.abspath(os.path.join(BASE_DIR, "..", "reports"))
FRONTEND_FOLDER = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["REPORTS_FOLDER"] = REPORTS_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(REPORTS_FOLDER, exist_ok=True)


def allowed_file(filename):
    """
    Validate that the uploaded file has a permitted extension and a valid dot separator.
    """
    if not filename or "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS


def cleanup_file_safely(file_path):
    """
    Safely delete a temporary file if it exists, ignoring missing file errors.
    """
    try:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
    except Exception:
        pass


def save_screening_report(file_info, classification, ocr_result, format_validation,
                          detected_fields, consistency_checks, image_quality,
                          image_anomalies, screening_result, forensic_analysis=None):
    """
    Generate and save a structured local JSON screening report in the reports directory.
    """
    now = datetime.datetime.now()
    timestamp_str = now.strftime("%Y%m%d_%H%M%S")
    unique_suffix = uuid.uuid4().hex[:6]
    report_id = f"REP_{timestamp_str}_{unique_suffix}"

    report_data = {
        "report_id": report_id,
        "timestamp": now.isoformat(),
        "formatted_date": now.strftime("%Y-%m-%d %H:%M:%S"),
        "filename": file_info.get("original_filename", "document.jpg"),
        "document_type": classification.get("document_type", "Unknown Document"),
        "classification": classification,
        "ocr_confidence": ocr_result.get("average_confidence", 0.0),
        "ocr_line_count": ocr_result.get("line_count", 0),
        "detected_fields": detected_fields,
        "format_validation": format_validation,
        "consistency_checks": consistency_checks,
        "image_quality": image_quality,
        "image_anomalies": image_anomalies,
        "forensics": forensic_analysis,
        "screening_status": screening_result.get("status", "Needs Review"),
        "screening_indicators": screening_result.get("reasons_for_review", []),
        "summary_message": screening_result.get("summary_message", ""),
        "disclaimer": screening_result.get("disclaimer", "")
    }

    report_filepath = os.path.join(REPORTS_FOLDER, f"{report_id}.json")
    try:
        with open(report_filepath, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
    except Exception as err:
        app.logger.error(f"Failed to write report file {report_filepath}: {err}")

    return report_id, report_data


# =========================================================
# GLOBAL ERROR HANDLERS (CLEAN JSON - NO STACK TRACES)
# =========================================================

@app.errorhandler(400)
def bad_request(error):
    return jsonify({
        "status": "error",
        "message": getattr(error, "description", "Bad request format.")
    }), 400


@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "status": "error",
        "message": "The requested resource was not found on this server."
    }), 404


@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({
        "status": "error",
        "message": "The HTTP method is not permitted on this endpoint."
    }), 405


@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({
        "status": "error",
        "message": "The uploaded file exceeds the maximum permitted limit of 16 MB."
    }), 413


@app.errorhandler(500)
def internal_server_error(error):
    return jsonify({
        "status": "error",
        "message": "An unexpected internal server error occurred while processing the request."
    }), 500


# =========================================================
# REST API ENDPOINTS
# =========================================================

@app.route("/", methods=["GET"])
def serve_index():
    """Serve the web dashboard frontend."""
    return send_from_directory(FRONTEND_FOLDER, "index.html")


@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint to verify backend operational readiness."""
    return jsonify({
        "status": "success",
        "message": "AI-Based Fake Identity Screening Backend is running",
        "version": "1.0.0",
        "privacy": "All document screening is executed locally on this server."
    }), 200


@app.route("/<path:filename>", methods=["GET"])
def serve_frontend_static(filename):
    """Serve frontend static files (CSS, JS, assets) directly."""
    file_path = os.path.join(FRONTEND_FOLDER, filename)
    if os.path.isfile(file_path):
        return send_from_directory(FRONTEND_FOLDER, filename)
    return jsonify({
        "status": "error",
        "message": "The requested resource was not found on this server."
    }), 404


# =========================================================
# OPERATOR AUTHENTICATION & USER MANAGEMENT
# =========================================================

USERS_FILE = os.path.join(BASE_DIR, "users.json")
DEFAULT_USERS = {
    "admin": {"password": "admin123", "display_name": "Admin", "role": "Authorized Inspector"},
    "officer": {"password": "screen2026", "display_name": "Officer", "role": "Verification Officer"},
    "screener": {"password": "demo", "display_name": "Screener", "role": "Demo Screener"}
}


def load_users():
    """Load authorized operators from local JSON store, initializing defaults if needed."""
    if not os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, "w", encoding="utf-8") as f:
                json.dump(DEFAULT_USERS, f, indent=2)
            return DEFAULT_USERS.copy()
        except Exception:
            return DEFAULT_USERS.copy()

    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Ensure defaults are merged
            for k, v in DEFAULT_USERS.items():
                if k not in data:
                    data[k] = v
            return data
    except Exception:
        return DEFAULT_USERS.copy()


def save_users(users):
    """Persist authorized operators to local JSON file."""
    try:
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2)
        return True
    except Exception as e:
        app.logger.error(f"Failed to save users file: {e}")
        return False


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    """
    Authenticate inspector/operator credentials for dashboard access.
    """
    try:
        data = request.get_json(silent=True) or {}
        username = (data.get("username") or "").strip().lower()
        password = (data.get("password") or "").strip()

        if not username or not password:
            return jsonify({
                "status": "error",
                "message": "Both Operator ID and Password are required."
            }), 400

        users = load_users()
        user_info = users.get(username)

        if user_info and user_info.get("password") == password:
            session_token = f"tok_{uuid.uuid4().hex}"
            return jsonify({
                "status": "success",
                "message": f"Authentication successful. Welcome, {user_info.get('display_name', username.title())}!",
                "token": session_token,
                "user": {
                    "username": username,
                    "role": user_info.get("role", "Authorized Inspector"),
                    "display_name": user_info.get("display_name", username.title())
                }
            }), 200
        else:
            return jsonify({
                "status": "error",
                "message": "Invalid Operator ID or Password. Please try again."
            }), 401

    except Exception as err:
        app.logger.error(f"Authentication exception: {err}")
        return jsonify({
            "status": "error",
            "message": "Authentication service error. Please try again."
        }), 500


@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    """
    Create a new operator/inspector account and persist to local JSON store.
    """
    try:
        data = request.get_json(silent=True) or {}
        username = (data.get("username") or "").strip().lower()
        password = (data.get("password") or "").strip()
        display_name = (data.get("display_name") or "").strip()

        if not username or not password:
            return jsonify({
                "status": "error",
                "message": "Both Operator ID and Password are required."
            }), 400

        if len(username) < 3:
            return jsonify({
                "status": "error",
                "message": "Operator ID must be at least 3 characters long."
            }), 400

        if len(password) < 4:
            return jsonify({
                "status": "error",
                "message": "Password must be at least 4 characters long."
            }), 400

        users = load_users()
        if username in users:
            return jsonify({
                "status": "error",
                "message": f"Operator ID '{username}' already exists. Please choose another ID."
            }), 409

        if not display_name:
            display_name = username.title()

        users[username] = {
            "password": password,
            "display_name": display_name,
            "role": "Authorized Inspector"
        }
        save_users(users)

        return jsonify({
            "status": "success",
            "message": f"Account '{username}' created successfully! You can now sign in.",
            "user": {
                "username": username,
                "display_name": display_name,
                "role": "Authorized Inspector"
            }
        }), 201

    except Exception as err:
        app.logger.error(f"Registration error: {err}")
        return jsonify({
            "status": "error",
            "message": "An error occurred while creating your account."
        }), 500


@app.route("/api/screen", methods=["POST"])
def screen_document():
    """
    Secure Document Screening Pipeline:
      1. Validates request and presence of file part
      2. Validates filename and extension (.jpg, .jpeg, .png)
      3. Sanitizes filename with UUID prefix to prevent traversal/collision
      4. Verifies image integrity and decodability with OpenCV
      5. Performs EasyOCR text extraction with error shielding
      6. Classifies document category
      7. Performs format pattern checks
      8. Extracts demographic fields
      9. Conducts consistency checks
      10. Analyzes image quality metrics and non-forensic anomalies
      11. Synthesizes overall screening result
      12. Persists local JSON report
    """
    file_path = None

    try:
        # 1. Check if a document file part was provided
        if "document" not in request.files:
            return jsonify({
                "status": "error",
                "message": "No document file was submitted with the request."
            }), 400

        file = request.files["document"]

        # 2. Check if a file was selected
        if not file or file.filename == "":
            return jsonify({
                "status": "error",
                "message": "No file was selected. Please choose an image to upload."
            }), 400

        # 3. Validate allowed file extensions
        if not allowed_file(file.filename):
            allowed_list = ", ".join(sorted(ALLOWED_EXTENSIONS))
            return jsonify({
                "status": "error",
                "message": f"Unsupported file type. Only image formats ({allowed_list}) are permitted."
            }), 400

        # 4. Sanitize filename safely
        original_filename = secure_filename(file.filename)
        if not original_filename:
            original_filename = "document.jpg"

        unique_prefix = uuid.uuid4().hex[:8]
        safe_filename = f"{unique_prefix}_{original_filename}"
        file_path = os.path.join(app.config["UPLOAD_FOLDER"], safe_filename)

        try:
            file.save(file_path)
        except Exception as e:
            app.logger.error(f"Failed to save uploaded file: {e}")
            return jsonify({
                "status": "error",
                "message": "Failed to save the uploaded image securely on disk."
            }), 500

        # 5. Verify image integrity and non-zero content with OpenCV
        try:
            image = cv2.imread(file_path)
            if image is None or image.size == 0:
                cleanup_file_safely(file_path)
                return jsonify({
                    "status": "error",
                    "message": "Corrupted or unreadable image file. Unable to decode image data."
                }), 400

            height, width, channels = image.shape
            file_size_bytes = os.path.getsize(file_path)

        except Exception as e:
            cleanup_file_safely(file_path)
            app.logger.error(f"OpenCV decode exception: {e}")
            return jsonify({
                "status": "error",
                "message": "An error occurred while validating image integrity."
            }), 400

        # 6. Perform OCR extraction (safely shielded)
        try:
            ocr_result = extract_text(file_path)
        except Exception as ocr_err:
            app.logger.error(f"OCR extraction exception: {ocr_err}")
            ocr_result = {
                "lines": [],
                "raw_text": "",
                "line_count": 0,
                "average_confidence": 0.0
            }

        raw_text = ocr_result.get("raw_text", "")
        lines = [item["text"] for item in ocr_result.get("lines", [])]

        # 7. Document Classification
        classification = detect_document_type(raw_text)
        doc_type = classification["document_type"]

        # 8. Field Detection
        detected_fields = extract_document_fields(raw_text, lines=lines, document_type=doc_type)

        # 9. Identifier Format & Mathematical Semantic Validation
        format_validation = validate_identifier_format(doc_type, raw_text, detected_fields=detected_fields)

        # 10. Consistency Checks
        consistency_checks = check_document_consistency(doc_type, detected_fields, format_validation)

        # 11. Image Quality Analysis
        image_quality = analyze_image_quality(file_path)

        # 12. Non-forensic Anomaly Screening
        image_anomalies = screen_image_anomalies(file_path, image_quality)

        # 13. Advanced Forensic & Cryptographic Integrity Verification
        forensics = run_advanced_forensics(file_path, doc_type, raw_text, detected_fields)

        # 14. Combined Screening Result Synthesis
        screening_result = generate_screening_result(
            document_type=doc_type,
            ocr_data=ocr_result,
            format_validations=format_validation,
            detected_fields=detected_fields,
            consistency_checks=consistency_checks,
            image_quality=image_quality,
            image_anomalies=image_anomalies,
            forensic_analysis=forensics
        )

        file_info = {
            "original_filename": original_filename,
            "saved_filename": safe_filename,
            "file_size_kb": round(file_size_bytes / 1024, 2),
            "dimensions": {
                "width": width,
                "height": height,
                "channels": channels
            }
        }

        # 15. Generate and save local JSON report
        report_id, report_data = save_screening_report(
            file_info=file_info,
            classification=classification,
            ocr_result=ocr_result,
            format_validation=format_validation,
            detected_fields=detected_fields,
            consistency_checks=consistency_checks,
            image_quality=image_quality,
            image_anomalies=image_anomalies,
            screening_result=screening_result,
            forensic_analysis=forensics
        )

        return jsonify({
            "status": "success",
            "message": "Preliminary document screening completed successfully.",
            "report_id": report_id,
            "report": report_data,
            "file_info": file_info,
            "screening_result": screening_result,
            "classification": classification,
            "ocr": ocr_result,
            "format_validation": format_validation,
            "detected_fields": detected_fields,
            "consistency_checks": consistency_checks,
            "image_quality": image_quality,
            "image_anomalies": image_anomalies,
            "forensics": forensics
        }), 200

    except Exception as err:
        app.logger.error(f"Unhandled screening pipeline error: {err}")
        if file_path:
            cleanup_file_safely(file_path)
        return jsonify({
            "status": "error",
            "message": "A processing error occurred during document screening. Please verify image clarity and try again."
        }), 500


@app.route("/api/reports", methods=["GET"])
def list_reports():
    """
    List all locally stored screening reports sorted by newest first.
    """
    reports = []
    try:
        if os.path.exists(REPORTS_FOLDER):
            for fname in os.listdir(REPORTS_FOLDER):
                if fname.endswith(".json"):
                    fpath = os.path.join(REPORTS_FOLDER, fname)
                    try:
                        with open(fpath, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            reports.append({
                                "report_id": data.get("report_id", fname[:-5]),
                                "timestamp": data.get("timestamp", ""),
                                "formatted_date": data.get("formatted_date", ""),
                                "filename": data.get("filename", "unknown"),
                                "document_type": data.get("document_type", "Unknown Document"),
                                "status": data.get("screening_status", "Needs Review")
                            })
                    except Exception:
                        continue

        reports.sort(key=lambda r: r.get("timestamp", ""), reverse=True)

        return jsonify({
            "status": "success",
            "count": len(reports),
            "reports": reports
        }), 200

    except Exception as err:
        app.logger.error(f"Error listing reports: {err}")
        return jsonify({
            "status": "error",
            "message": "Unable to read screening reports directory."
        }), 500


@app.route("/api/reports/<report_id>", methods=["GET"])
def get_report(report_id):
    """
    Retrieve an individual locally archived JSON screening report with path traversal protection.
    """
    # Sanitize report_id to prevent directory traversal
    safe_id = secure_filename(report_id)
    report_file = os.path.join(REPORTS_FOLDER, f"{safe_id}.json")

    if not os.path.exists(report_file):
        return jsonify({
            "status": "error",
            "message": f"Report '{safe_id}' was not found."
        }), 404

    try:
        with open(report_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify({
            "status": "success",
            "report": data
        }), 200
    except Exception as err:
        app.logger.error(f"Error reading report {safe_id}: {err}")
        return jsonify({
            "status": "error",
            "message": "Failed to read report data."
        }), 500


@app.route("/api/reports/<report_id>", methods=["DELETE"])
def delete_report(report_id):
    """
    Delete a locally stored screening report file with path traversal protection.
    """
    safe_id = secure_filename(report_id)
    report_file = os.path.join(REPORTS_FOLDER, f"{safe_id}.json")

    if not os.path.exists(report_file):
        return jsonify({
            "status": "error",
            "message": f"Report '{safe_id}' was not found."
        }), 404

    try:
        os.remove(report_file)
        return jsonify({
            "status": "success",
            "message": f"Report '{safe_id}' deleted successfully."
        }), 200
    except Exception as err:
        app.logger.error(f"Error deleting report {safe_id}: {err}")
        return jsonify({
            "status": "error",
            "message": "Failed to delete report."
        }), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)