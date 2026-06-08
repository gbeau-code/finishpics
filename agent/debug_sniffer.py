"""
debug_sniffer.py — TCP sniffer for FinishLynx scoreboard/RC debugging.

Listens on a port and logs every byte received, both as ASCII and hex.
Use this to see exactly what FinishLynx's scoreboard script is sending.

Usage:
    python debug_sniffer.py [port]   (default port: 16001)

Setup:
    1. Run this script.
    2. In FinishLynx, temporarily change the Scoreboard output port to 16001
       (or whatever port this is listening on).
    3. Post / send official results in FinishLynx.
    4. Watch what arrives here.
    5. When done, change the scoreboard port back to 16000.
"""

import socket
import sys
import datetime

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 16001


LOG_FILE = open('C:\\Projects\\timing-pics\\sniffer.log', 'a', buffering=1, encoding='utf-8')

def log(msg: str) -> None:
    ts = datetime.datetime.now().strftime('%H:%M:%S.%f')[:-3]
    line = f'[{ts}] {msg}'
    print(line, flush=True)
    LOG_FILE.write(line + '\n')
    LOG_FILE.flush()


def format_bytes(data: bytes) -> str:
    """Show data as printable ASCII with non-printable chars as <0xHH>."""
    parts = []
    for b in data:
        if 32 <= b < 127:
            parts.append(chr(b))
        elif b == 0x0D:
            parts.append('<CR>')
        elif b == 0x0A:
            parts.append('<LF>')
        elif b == 0x11:
            parts.append('<XON>')
        elif b == 0x13:
            parts.append('<XOFF>')
        else:
            parts.append(f'<0x{b:02X}>')
    return ''.join(parts)


def handle_connection(conn: socket.socket, addr: tuple) -> None:
    log(f'Connection from {addr[0]}:{addr[1]}')
    total = 0
    try:
        while True:
            data = conn.recv(4096)
            if not data:
                break
            total += len(data)
            log(f'  Received {len(data)} bytes:')
            log(f'    ASCII: {format_bytes(data)}')
            log(f'    HEX:   {data.hex(" ")}')

            # Try to echo back "Reply=Ok;\r\n" so FinishLynx doesn't error
            try:
                conn.sendall(b'Reply=Ok;\r\n')
                log(f'  Sent: Reply=Ok;<CRLF>')
            except OSError:
                pass
    except (ConnectionResetError, OSError) as e:
        log(f'  Connection closed: {e}')
    finally:
        conn.close()
        log(f'  Connection ended. Total bytes received: {total}')


def main() -> None:
    print()
    print('==========================================================')
    print(f'  FinishPics -- FinishLynx Scoreboard Sniffer')
    print(f'  Listening on port {PORT}')
    print('==========================================================')
    print()
    print('  Steps:')
    print(f'  1. In FinishLynx Scoreboards, change the output port to {PORT}')
    print('  2. Post official results (or manually send to scoreboard)')
    print('  3. Watch what arrives below')
    print(f'  4. When done, change the port back to 16000')
    print()
    print('  Ctrl+C to stop.')
    print('----------------------------------------------------------')

    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        server.bind(('0.0.0.0', PORT))
    except OSError as e:
        print(f'\nERROR: Could not bind to port {PORT}: {e}')
        print('Is another process already using this port?')
        sys.exit(1)

    server.listen(5)
    log(f'Listening on 0.0.0.0:{PORT} — waiting for FinishLynx...')

    try:
        while True:
            conn, addr = server.accept()
            handle_connection(conn, addr)
            log('Ready for next connection.')
    except KeyboardInterrupt:
        print('\nStopped.')
    finally:
        server.close()


if __name__ == '__main__':
    main()
