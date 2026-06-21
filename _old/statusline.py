#!/usr/bin/env python3
import sys
import json
import os
import time
import urllib.request

# ANSI codes for premium rendering
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
VIOLET = "\033[38;5;135m"
CYAN = "\033[38;5;45m"
GREEN = "\033[38;5;77m"
YELLOW = "\033[38;5;214m"
RED = "\033[38;5;196m"
GRAY = "\033[38;5;244m"

CACHE_PATH = "/tmp/agy_quota_cache.json"
TOKEN_PATH = "/home/ubuntu/.gemini/antigravity-cli/antigravity-oauth-token"

def get_quota():
    now = time.time()
    # Read from cache if it is fresh (60 seconds)
    if os.path.exists(CACHE_PATH):
        try:
            with open(CACHE_PATH, "r") as f:
                cache = json.load(f) or {}
            if now - cache.get("timestamp", 0) < 60:
                return cache.get("data") or {}
        except:
            pass

    # Fetch fresh quotas from Google internal API
    try:
        if not os.path.exists(TOKEN_PATH):
            return {}
        with open(TOKEN_PATH, "r") as f:
            token_data = json.load(f) or {}
        token_info = token_data.get("token") or {}
        access_token = token_info.get("access_token")
        if not access_token:
            return {}

        url = "https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota"
        req = urllib.request.Request(
            url,
            data=b"{}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=2) as response:
            res_data = response.read().decode("utf-8")
            data = json.loads(res_data) or {}
            # Write to cache
            with open(CACHE_PATH, "w") as f:
                json.dump({"timestamp": now, "data": data}, f)
            return data
    except Exception:
        # Fallback to expired cache if fetch fails
        if os.path.exists(CACHE_PATH):
            try:
                with open(CACHE_PATH, "r") as f:
                    cache = json.load(f) or {}
                    return cache.get("data") or {}
            except:
                pass
        return {}

def format_tokens(num):
    if num is None:
        return "0"
    if num >= 1_000_000:
        return f"{num/1_000_000:.1f}M"
    elif num >= 1_000:
        return f"{num/1_000:.1f}k"
    return str(num)

def main():
    try:
        # Read the JSON payload piped by agy cli to stdin
        input_data = sys.stdin.read()
        if not input_data.strip():
            print(f"{VIOLET}⚛ ANTIGRAVITY{RESET} | {GREEN}🟢 working{RESET}")
            return
        state = json.loads(input_data) or {}
    except Exception:
        print(f"{VIOLET}⚛ ANTIGRAVITY{RESET} | {GREEN}🟢 working{RESET}")
        return

    try:
        # Extract state info, protecting against None/null values
        agent_state = state.get("agent_state") or "working"
        state_icon = "🟢" if agent_state == "working" else "⚪"
        state_color = GREEN if agent_state == "working" else GRAY
        
        ctx = state.get("context_window") or {}
        used_pct = ctx.get("used_percentage")
        if used_pct is None:
            used_pct = 0.0
            
        total_in = ctx.get("total_input_tokens") or 0
        total_out = ctx.get("total_output_tokens") or 0
        ctx_size = ctx.get("context_window_size") or 1048576
        
        curr = ctx.get("current_usage") or {}
        curr_in = curr.get("input_tokens") or 0
        curr_out = curr.get("output_tokens") or 0
        cache_read = curr.get("cache_read_input_tokens") or 0

        # Format context usage color based on usage percentage
        ctx_color = GREEN
        if used_pct > 80:
            ctx_color = RED
        elif used_pct > 50:
            ctx_color = YELLOW

        # Load quota details, protecting against None/null
        quota_data = get_quota() or {}
        buckets = quota_data.get("buckets") or []
        
        hourly_fraction = 1.0
        weekly_fraction = 1.0
        
        for b in buckets:
            if not b:
                continue
            model = b.get("modelId") or ""
            fraction = b.get("remainingFraction")
            if fraction is None:
                fraction = 1.0
            # Use gemini-2.5-pro or standard gemini model to represent limits
            if "pro" in model:
                weekly_fraction = min(weekly_fraction, fraction)
            elif "flash" in model:
                hourly_fraction = min(hourly_fraction, fraction)

        # Format color for hourly / weekly limits
        def get_quota_color(frac):
            if frac < 0.2:
                return RED
            elif frac < 0.5:
                return YELLOW
            return GREEN

        hourly_color = get_quota_color(hourly_fraction)
        weekly_color = get_quota_color(weekly_fraction)

        # Build statusline components
        product_part = f"{BOLD}{VIOLET}⚛ ANTIGRAVITY{RESET}"
        state_part = f"{state_color}{state_icon} {agent_state}{RESET}"
        context_part = f"📊 Context: {ctx_color}{used_pct:.1f}%{RESET} ({format_tokens(total_in + total_out)} / {format_tokens(ctx_size)})"
        tokens_part = f"Tokens: In: {format_tokens(curr_in)} | Out: {format_tokens(curr_out)} | {CYAN}⚡ Cache: {format_tokens(cache_read)}{RESET}"
        quota_part = f"Hourly: {hourly_color}{hourly_fraction*100:.0f}%{RESET} | Weekly: {weekly_color}{weekly_fraction*100:.0f}%{RESET}"

        # Responsiveness: check terminal width and drop segments to prevent overflow
        width = state.get("terminal_width")
        if width is None or not isinstance(width, int):
            width = 80
        
        parts = []
        parts.append(product_part)
        parts.append(state_part)
        
        if width >= 120:
            parts.append(context_part)
            parts.append(tokens_part)
            parts.append(quota_part)
        elif width >= 90:
            parts.append(context_part)
            parts.append(quota_part)
        else:
            parts.append(f"📊 {ctx_color}{used_pct:.1f}%{RESET}")
            parts.append(quota_part)

        separator = f" {GRAY}|{RESET} "
        print(separator.join(parts))
    except Exception:
        # Absolute bare minimum fallback if formatting fails
        print(f"{VIOLET}⚛ ANTIGRAVITY{RESET} | {GREEN}🟢 working{RESET}")

if __name__ == "__main__":
    main()
