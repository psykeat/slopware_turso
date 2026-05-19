#!/usr/bin/env bash

export FORCE_COLOR=1
export CLICOLOR_FORCE=1

echo "Initiating dev setup with local PostgreSQL instance..."

# Auto-detect compose command
if command -v podman-compose > /dev/null 2>&1; then
    COMPOSE_CMD="podman-compose"
elif docker compose version > /dev/null 2>&1; then
    if docker ps > /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="sudo docker compose"
    fi
elif command -v docker-compose > /dev/null 2>&1; then
    if docker-compose ps > /dev/null 2>&1; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="sudo docker-compose"
    fi
else
    echo "Error: No compose tool found (tried podman-compose, docker-compose, docker compose)!"
    exit 1
fi

# Shutdown compose services on exit
CLEANUP_RAN=0
LLM_PID=""
cleanup() {
    if [ "$CLEANUP_RAN" -eq 1 ]; then
        return
    fi

    CLEANUP_RAN=1

    echo ""
    echo "Shutting down..."
    [ -n "$LLM_PID" ] && kill "$LLM_PID" 2>/dev/null
    $COMPOSE_CMD down
}
trap cleanup INT TERM EXIT

echo "Using: $COMPOSE_CMD"

# Start PostgreSQL
echo "Starting PostgreSQL..."
START_TIME=$(date +%s)
$COMPOSE_CMD up -d
END_TIME=$(date +%s)
echo "PostgreSQL startup took $((END_TIME - START_TIME))s."

# Determine which dev command to run based on parameters
if [ -n "$1" ]; then
    DEV_CMD="--filter=@repo/$1 dev"
    echo "Starting $1 development server..."
else
    DEV_CMD="--recursive --parallel dev"
    echo "Starting all development servers..."
fi

# Start LiteLLM Python microservice
if [ "$SKIP_LLM" != "1" ]; then
    LLM_PORT="${LLM_SERVICE_PORT:-11435}"
    LLM_DIR="$(cd "$(dirname "$0")/services/llm" && pwd)"
    LLM_UVICORN="$LLM_DIR/.venv/bin/uvicorn"
    if [ -x "$LLM_UVICORN" ] || command -v uvicorn > /dev/null 2>&1; then
        UVICORN_CMD="${LLM_UVICORN:-uvicorn}"
        echo "Starting LiteLLM service on port $LLM_PORT..."
        START_TIME_LLM=$(date +%s)
        (cd "$LLM_DIR" && "$UVICORN_CMD" main:app --port "$LLM_PORT" --reload) &
        LLM_PID=$!
        echo "LiteLLM service backgrounded."
    else
        echo "Warning: uvicorn not found — skipping LiteLLM service. Install with: pip install -r services/llm/requirements.txt"
    fi
else
    echo "Skipping LiteLLM service (SKIP_LLM=1)..."
fi

# Start the development server (blocks until Ctrl+C)
echo "Development environment is ready. Press Ctrl+C to stop all services."
echo "Executing: pnpm run $DEV_CMD"
START_TIME_PNPM=$(date +%s)
pnpm run $DEV_CMD