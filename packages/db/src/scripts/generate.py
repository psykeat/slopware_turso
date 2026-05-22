import os
import sys
import pty
import subprocess
import time

def run_with_pty():
    # We will spawn 'pnpm' in the directory 'packages/db'
    cwd = "/home/ubuntu/slopware/packages/db"
    cmd = ["pnpm", "exec", "drizzle-kit", "generate"]

    master_fd, slave_fd = pty.openpty()

    # Start the process with the slave pty as stdin/stdout/stderr
    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        close_fds=True
    )

    # Close slave fd in parent as we only use master fd
    os.close(slave_fd)

    output_buffer = b""
    
    # Read output and send carriage returns when prompted
    while True:
        # Check if process is still running
        status = proc.poll()
        
        # Read from master_fd
        try:
            # We use non-blocking read or small timeout using select
            import select
            r, _, _ = select.select([master_fd], [], [], 0.1)
            if master_fd in r:
                data = os.read(master_fd, 1024)
                if not data:
                    if status is not None:
                        break
                else:
                    sys.stdout.buffer.write(data)
                    sys.stdout.flush()
                    output_buffer += data
                    
                    # Check if we got a prompt
                    if b"Is address_category." in data or b"column created or renamed" in data or b"?" in data:
                        # Wait a bit and send a carriage return (\r)
                        time.sleep(0.5)
                        os.write(master_fd, b"\r")
                        print("\n[Python PTY: Sent Carriage Return]", flush=True)
        except OSError:
            if status is not None:
                break

    # Wait for the process to exit
    proc.wait()
    
    # Also compile docs or run pnpm run docs if it was successful
    if proc.returncode == 0:
        print("\nMigration generated successfully! Running pnpm run docs...")
        subprocess.run(["pnpm", "run", "docs"], cwd=cwd)
    else:
        print(f"\nDrizzle generate failed with return code {proc.returncode}")
        sys.exit(proc.returncode)

if __name__ == "__main__":
    run_with_pty()
