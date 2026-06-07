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

VP_CMD="$(cd "$(dirname "$0")" && pwd)/node_modules/.bin/vp"
if [ ! -x "$VP_CMD" ]; then
    if command -v vp > /dev/null 2>&1; then
        VP_CMD="$(command -v vp)"
    else
        echo "Error: vp is not available. Run pnpm install to restore node_modules/.bin/vp."
        exit 1
    fi
fi

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
    DEV_CMD="dev"
    echo "Starting all development servers..."
fi


# Start the development server (blocks until Ctrl+C)
echo "Development environment is ready. Press Ctrl+C to stop all services."
echo "Executing: $VP_CMD run $DEV_CMD"
$VP_CMD run $DEV_CMD
