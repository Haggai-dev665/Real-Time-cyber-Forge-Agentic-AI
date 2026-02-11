# Use Python 3.11 to avoid the gradio_client Python 3.13 bug
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    git-lfs \
    ffmpeg \
    libsm6 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/* \
    && git lfs install

# Create user for HF Spaces
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Copy requirements and install dependencies
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir ipykernel && \
    python -m ipykernel install --user --name python3 --display-name "Python 3"

# Copy application code
COPY --chown=user . .

# Expose port
EXPOSE 7860

# Run the application via uvicorn (FastAPI + Gradio mounted)
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
