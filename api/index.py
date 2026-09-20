"""
CareerDesk — Flask Application Factory
=======================================
Single entry point for all API routes, deployed as a Vercel serverless function.
All secrets loaded from environment variables — never hardcoded.
"""

import os
import sys

# Ensure repository root is in sys.path regardless of execution context
repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from flask import Flask, jsonify
from dotenv import load_dotenv

# Load .env for local development (Vercel injects env vars in production)
load_dotenv(os.path.join(repo_root, ".env"))

def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)

    # ── Security Configuration ──────────────────────────────────────────
    # Secret key for serverless runtime hardening
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-fallback-change-me")

    # ── Preflight / CORS Handling ───────────────────────────────────────
    @app.before_request
    def handle_preflight():
        from flask import request
        if request.method == "OPTIONS":
            response = app.make_default_options_response()
            return add_cors_headers(response)

    # ── CORS Configuration ──────────────────────────────────────────────
    @app.after_request
    def add_cors_headers(response):
        """
        Production: allow CareerDesk domains and any *.vercel.app deployments.
        Development: allow localhost origins.
        """
        allowed_origins = [
            "https://careerdesk.vercel.app",
            "https://opportunity-os.vercel.app",
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
        ]
        request_origin = request.headers.get("Origin", "")

        if request_origin:
            if request_origin in allowed_origins or request_origin.endswith(".vercel.app"):
                response.headers["Access-Control-Allow-Origin"] = request_origin

        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    # ── Register Blueprints ─────────────────────────────────────────────
    from api.routes.opportunities import opportunities_bp
    from api.routes.auth import auth_bp
    from api.routes.bookmarks import bookmarks_bp
    from api.routes.applications import applications_bp
    from api.routes.dashboard import dashboard_bp
    from api.routes.submissions import submissions_bp
    from api.routes.admin import admin_bp
    from api.routes.cron import cron_bp

    app.register_blueprint(opportunities_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(bookmarks_bp)
    app.register_blueprint(applications_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(submissions_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(cron_bp)

    public_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public")

    # ── Global Error Handlers ───────────────────────────────────────────
    # Never leak stack traces, file paths, or SQL errors to the client.

    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": str(e.description) if hasattr(e, "description") else "Bad request."}), 400

    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({"error": "Authentication required."}), 401

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({"error": "You do not have permission to access this resource."}), 403

    @app.errorhandler(404)
    def not_found(e):
        from flask import request, send_from_directory
        if not request.path.startswith("/api"):
            four_oh_four = os.path.join(public_dir, "404.html")
            if os.path.isfile(four_oh_four):
                return send_from_directory(public_dir, "404.html"), 404
        return jsonify({"error": "Resource not found."}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed."}), 405

    @app.errorhandler(429)
    def rate_limited(e):
        return jsonify({"error": "Too many requests. Please try again later."}), 429

    @app.errorhandler(500)
    def internal_error(e):
        # Log the real error server-side, return generic message to client
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Something went wrong, please try again."}), 500

    # ── Health Check ────────────────────────────────────────────────────
    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "CareerDesk API"})

    # ── Public Client Configuration ─────────────────────────────────────
    @app.route("/api/config")
    def public_config():
        """
        Dynamically provides safe public configuration from environment variables.
        Never exposes SECRET_KEY, SERVICE_ROLE_KEY, or BRABBLE_API_KEY.
        """
        return jsonify({
            "supabase_url": os.environ.get("SUPABASE_URL", ""),
            "supabase_anon_key": os.environ.get("SUPABASE_ANON_KEY", "")
        })

    # ── Static Frontend Serving (Local Development & Edge Fallback) ──────
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        from flask import send_from_directory
        # Do not intercept /api/ routes
        if path.startswith("api/") or path == "api":
            return jsonify({"error": "Resource not found."}), 404

        file_path = os.path.join(public_dir, path)
        if path and os.path.isfile(file_path):
            return send_from_directory(public_dir, path)
        elif not path:
            return send_from_directory(public_dir, "index.html")
        else:
            four_oh_four = os.path.join(public_dir, "404.html")
            if os.path.isfile(four_oh_four):
                return send_from_directory(public_dir, "404.html"), 404
            return jsonify({"error": "Frontend page not found."}), 404

    return app


# ── Vercel Serverless Entry Point ───────────────────────────────────────
app = create_app()

# For local development: python api/index.py
if __name__ == "__main__":
    app.run(debug=True, port=int(os.environ.get("PORT", 3000)))
