import os
from pathlib import Path

from flask import Flask, jsonify, render_template, send_file


BASE_DIR = Path(__file__).resolve().parent
DOG_IMAGE = BASE_DIR / "static" / "assets" / "dog.jpg"

app = Flask(__name__)


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/dog-photo")
def dog_photo():
    return send_file(DOG_IMAGE, mimetype="image/jpeg", conditional=True)


@app.get("/download/dog")
def download_dog():
    return send_file(
        DOG_IMAGE,
        mimetype="image/jpeg",
        as_attachment=True,
        download_name="opendog-dog.jpg",
    )


@app.get("/healthz")
def healthz():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5487"))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG") == "1")
