# Python 3.11: the version this image has been built and run with
FROM python:3.11-slim

# GPU runtime, used only when the hardware has a GPU (on CPU hardware the image behaves as
# before). llama-cpp-python has no prebuilt CUDA wheel for the pinned version and compiling
# it here exceeds the Space build limit, so it is compiled once by
# ml-services/gpu_runtime/build_job.py and downloaded from the model repo at a pinned commit.
# The CUDA libraries it links come from NVIDIA's own wheels; the driver comes from the host.
ARG LLAMA_CUDA_WHEEL=https://huggingface.co/Che237/cyberforge-models/resolve/ef1944b0e4a4a89d638b95c8461528daea4d83a0/runtime/llama_cpp_python-0.3.36-cuda124-linux_x86_64.whl
RUN pip install --no-cache-dir --no-deps --target /opt/cuda-pkgs nvidia-cuda-runtime-cu12==12.4.127 nvidia-cublas-cu12==12.4.5.8 nvidia-nccl-cu12==2.21.5 && python -c "import sys,urllib.request,zipfile,os; urllib.request.urlretrieve(sys.argv[1], '/tmp/llama.whl'); zipfile.ZipFile('/tmp/llama.whl').extractall('/opt/llama-cuda'); os.remove('/tmp/llama.whl')" "$LLAMA_CUDA_WHEEL" && test -d /opt/llama-cuda/llama_cpp
# On GPU hardware the host's NVIDIA runtime mounts the driver when these are set.
ENV NVIDIA_VISIBLE_DEVICES=all     NVIDIA_DRIVER_CAPABILITIES=compute,utility

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    git-lfs \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgomp1 \
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
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=user . .

# Expose port
EXPOSE 7860

# Run the API via uvicorn (FastAPI only, no web interface)
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
