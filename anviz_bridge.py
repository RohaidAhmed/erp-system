#!/usr/bin/env python3
"""
anviz_bridge.py  —  Anviz EP300 → HTTP JSON bridge
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Run on the SAME machine as your Next.js server (must be on the same
LAN as the Anviz device at 192.168.10.116).

Usage:
    python anviz_bridge.py

Env vars (all optional, defaults shown):
    ANVIZ_IP        192.168.10.116
    ANVIZ_PORT      8080
    ANVIZ_DEVICE_ID 1
    BRIDGE_HOST     127.0.0.1
    BRIDGE_PORT     7070

Endpoints:
    GET /health          connectivity check + record counts
    GET /info            record counts
    GET /staff           all staff on device
    GET /records         all records  (optional ?from=YYYY-MM-DD&to=YYYY-MM-DD)
    GET /records/new     only "new" (uncleared) records
"""

import os, json, socket, struct, itertools, traceback
from datetime import datetime, date
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# ── Anviz binary protocol constants ──────────────────────────────────────────
STX     = 0xA5
ACK_SUM = 0x80
SSEC    = datetime(2000, 1, 2, 0, 0).timestamp()  # Anviz epoch

CMD_GET_RECORD_INFO     = 0x3C
CMD_DOWNLOAD_RECORDS    = 0x40
CMD_DOWNLOAD_STAFF_INFO = 0x42
RET_SUCCESS             = 0x00

_CRC = (
    0x0000,0x1189,0x2312,0x329B,0x4624,0x57AD,0x6536,0x74BF,
    0x8C48,0x9DC1,0xAF5A,0xBED3,0xCA6C,0xDBE5,0xE97E,0xF8F7,
    0x1081,0x0108,0x3393,0x221A,0x56A5,0x472C,0x75B7,0x643E,
    0x9CC9,0x8D40,0xBFDB,0xAE52,0xDAED,0xCB64,0xF9FF,0xE876,
    0x2102,0x308B,0x0210,0x1399,0x6726,0x76AF,0x4434,0x55BD,
    0xAD4A,0xBCC3,0x8E58,0x9FD1,0xEB6E,0xFAE7,0xC87C,0xD9F5,
    0x3183,0x200A,0x1291,0x0318,0x77A7,0x662E,0x54B5,0x453C,
    0xBDCB,0xAC42,0x9ED9,0x8F50,0xFBEF,0xEA66,0xD8FD,0xC974,
    0x4204,0x538D,0x6116,0x709F,0x0420,0x15A9,0x2732,0x36BB,
    0xCE4C,0xDFC5,0xED5E,0xFCD7,0x8868,0x99E1,0xAB7A,0xBAF3,
    0x5285,0x430C,0x7197,0x601E,0x14A1,0x0528,0x37B3,0x263A,
    0xDECD,0xCF44,0xFDDF,0xEC56,0x98E9,0x8960,0xBBFB,0xAA72,
    0x6306,0x728F,0x4014,0x519D,0x2522,0x34AB,0x0630,0x17B9,
    0xEF4E,0xFEC7,0xCC5C,0xDDD5,0xA96A,0xB8E3,0x8A78,0x9BF1,
    0x7387,0x620E,0x5095,0x411C,0x35A3,0x242A,0x16B1,0x0738,
    0xFFCF,0xEE46,0xDCDD,0xCD54,0xB9EB,0xA862,0x9AF9,0x8B70,
    0x8408,0x9581,0xA71A,0xB693,0xC22C,0xD3A5,0xE13E,0xF0B7,
    0x0840,0x19C9,0x2B52,0x3ADB,0x4E64,0x5FED,0x6D76,0x7CFF,
    0x9489,0x8500,0xB79B,0xA612,0xD2AD,0xC324,0xF1BF,0xE036,
    0x18C1,0x0948,0x3BD3,0x2A5A,0x5EE5,0x4F6C,0x7DF7,0x6C7E,
    0xA50A,0xB483,0x8618,0x9791,0xE32E,0xF2A7,0xC03C,0xD1B5,
    0x2942,0x38CB,0x0A50,0x1BD9,0x6F66,0x7EEF,0x4C74,0x5DFD,
    0xB58B,0xA402,0x9699,0x8710,0xF3AF,0xE226,0xD0BD,0xC134,
    0x39C3,0x284A,0x1AD1,0x0B58,0x7FE7,0x6E6E,0x5CF5,0x4D7C,
    0xC60C,0xD785,0xE51E,0xF497,0x8028,0x91A1,0xA33A,0xB2B3,
    0x4A44,0x5BCD,0x6956,0x78DF,0x0C60,0x1DE9,0x2F72,0x3EFB,
    0xD68D,0xC704,0xF59F,0xE416,0x90A9,0x8120,0xB3BB,0xA232,
    0x5AC5,0x4B4C,0x79D7,0x685E,0x1CE1,0x0D68,0x3FF3,0x2E7A,
    0xE70E,0xF687,0xC41C,0xD595,0xA12A,0xB0A3,0x8238,0x93B1,
    0x6B46,0x7ACF,0x4854,0x59DD,0x2D62,0x3CEB,0x0E70,0x1FF9,
    0xF78F,0xE606,0xD49D,0xC514,0xB1AB,0xA022,0x92B9,0x8330,
    0x7BC7,0x6A4E,0x58D5,0x495C,0x3DE3,0x2C6A,0x1EF1,0x0F78,
)

def crc16(data):
    crc = 0xFFFF
    for b in data:
        crc ^= b
        crc = (crc >> 8) ^ _CRC[crc & 0xFF]
    return struct.pack("<H", crc)

def b_take(it, n):
    return bytes(itertools.islice(it, n))

def left_fill(b, n=0):
    return (b"\x00" * n + b)[-n:]

def split_every(n, seq):
    it = iter(seq)
    chunk = bytes(itertools.islice(it, n))
    while chunk:
        yield chunk
        chunk = bytes(itertools.islice(it, n))


# ── Device class ──────────────────────────────────────────────────────────────
class AnvizDevice:
    def __init__(self, device_id, ip, port, timeout=20):
        self.device_id = device_id
        self.ip        = ip
        self.port      = port
        self.timeout   = timeout
        self._s        = None

    def connect(self):
        self._s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._s.settimeout(self.timeout)
        self._s.connect((self.ip, self.port))

    def disconnect(self):
        if self._s:
            try: self._s.close()
            except: pass
            self._s = None

    def _recv_n(self, n):
        buf = b""
        while len(buf) < n:
            chunk = self._s.recv(n - len(buf))
            if not chunk:
                raise ConnectionError("Device closed connection")
            buf += chunk
        return buf

    def _cmd(self, cmd, args=b""):
        req = bytearray([STX])
        req += struct.pack(">L", self.device_id)
        req.append(cmd)
        req += struct.pack(">H", len(args))
        req += args
        req += crc16(req)
        self._s.sendall(req)

        hdr = self._recv_n(7)
        dev_id, ack, ret = struct.unpack(">xLcc", hdr)
        if (hdr[0] != STX or dev_id != self.device_id
                or ack != bytes([cmd + ACK_SUM]) or ord(ret) != RET_SUCCESS):
            raise RuntimeError(f"Bad ACK for cmd 0x{cmd:02X}  hdr={hdr.hex()}")

        rlen_b   = self._recv_n(2)
        data_len = struct.unpack(">H", rlen_b)[0]
        data     = self._recv_n(data_len)
        crc      = self._recv_n(2)

        full = hdr + rlen_b + data
        if crc16(full) != crc:
            raise RuntimeError("CRC mismatch")
        return data

    # High-level

    def get_record_info(self):
        d  = self._cmd(CMD_GET_RECORD_INFO)
        it = iter(d)
        def rd3(): return sum(struct.unpack(">BH", b_take(it, 3)))
        return {
            "users": rd3(), "fingerprints": rd3(), "passwords": rd3(),
            "cards": rd3(), "all_records": rd3(), "new_records": rd3(),
        }

    def _parse_rec(self, raw):
        it   = iter(raw)
        uid  = struct.unpack(">Q", left_fill(b_take(it, 5), 8))[0]
        sec  = struct.unpack(">I", b_take(it, 4))[0]
        bkp  = b_take(it, 1)[0]
        rtype= b_take(it, 1)[0]
        work = struct.unpack(">I", left_fill(b_take(it, 3), 4))[0]
        dt   = datetime.fromtimestamp(SSEC + sec)
        return {
            "code":  uid,
            "datetime": dt.strftime("%Y-%m-%d %H:%M:%S"),
            "date":     dt.strftime("%Y-%m-%d"),
            "time":     dt.strftime("%H:%M:%S"),
            "type":     rtype,   # 0 = IN, 1 = OUT
            "bkp":      bkp,
            "work":     work,
        }

    def _parse_block(self, data):
        d      = bytearray(data)
        valids = d[0]
        recs   = []
        for chunk in split_every(14, d[1:]):
            if len(chunk) == 14:
                recs.append(self._parse_rec(chunk))
        return recs

    def download_records(self, new_only=False, date_from=None, date_to=None):
        info  = self.get_record_info()
        total = info["new_records"] if new_only else info["all_records"]
        if total == 0:
            return []

        param = 2 if new_only else 1
        recs  = []
        q     = min(25, total)
        recs.extend(self._parse_block(self._cmd(CMD_DOWNLOAD_RECORDS, bytes([param, q]))))
        left = total - q

        while left > 0:
            q = min(25, left)
            recs.extend(self._parse_block(self._cmd(CMD_DOWNLOAD_RECORDS, bytes([0, q]))))
            left -= q

        if date_from or date_to:
            recs = [r for r in recs if (
                (not date_from or datetime.strptime(r["date"], "%Y-%m-%d").date() >= date_from) and
                (not date_to   or datetime.strptime(r["date"], "%Y-%m-%d").date() <= date_to)
            )]
        return recs

    def download_staff(self):
        info  = self.get_record_info()
        users = info["users"]
        if users == 0:
            return []
        staff = []
        q = min(12, users)
        staff.extend(self._parse_staff_block(self._cmd(CMD_DOWNLOAD_STAFF_INFO, bytes([1, q]))))
        left = users - q
        while left > 0:
            q = min(12, left)
            staff.extend(self._parse_staff_block(self._cmd(CMD_DOWNLOAD_STAFF_INFO, bytes([0, q]))))
            left -= q
        return staff

    def _parse_staff_block(self, data):
        d      = bytearray(data)
        staff  = []
        for chunk in split_every(27, d[1:]):
            if len(chunk) >= 27:
                it   = iter(chunk)
                uid  = struct.unpack(">Q", left_fill(b_take(it, 5), 8))[0]
                pwd  = b_take(it, 3)
                pwd  = None if pwd == b"\xff\xff\xff" else struct.unpack(">L", left_fill(pwd, 4))[0]
                card = b_take(it, 3)
                card = None if card == b"\xff\xff\xff" else struct.unpack(">L", left_fill(card, 4))[0]
                name = b_take(it, 10).rstrip(b"\x00").decode("utf-8", errors="replace")
                dep  = b_take(it, 1)[0]
                grp  = b_take(it, 1)[0]
                mode = b_take(it, 1)[0]
                fp   = struct.unpack("H", b_take(it, 2))[0]
                spec = b_take(it, 1)[0]
                staff.append({"code": uid, "name": name, "dep": dep,
                               "group": grp, "fp_count": fp, "card": card})
        return staff


# ── HTTP server ───────────────────────────────────────────────────────────────
ANVIZ_IP  = os.environ.get("ANVIZ_IP",           "192.168.10.116")
ANVIZ_PORT= int(os.environ.get("ANVIZ_PORT",     "8080"))
DEVICE_ID = int(os.environ.get("ANVIZ_DEVICE_ID","1"))

def respond(h, data, status=200):
    body = json.dumps(data, default=str).encode()
    h.send_response(status)
    h.send_header("Content-Type", "application/json")
    h.send_header("Content-Length", str(len(body)))
    h.end_headers()
    h.wfile.write(body)

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[bridge] {fmt % args}")

    def do_GET(self):
        p  = urlparse(self.path)
        qs = parse_qs(p.query)
        path = p.path.rstrip("/")

        dev = AnvizDevice(DEVICE_ID, ANVIZ_IP, ANVIZ_PORT)
        try:
            dev.connect()
        except Exception as e:
            respond(self, {"success": False, "error": f"Cannot connect to {ANVIZ_IP}:{ANVIZ_PORT} — {e}"}, 503)
            return

        try:
            if path == "/health":
                info = dev.get_record_info()
                respond(self, {"success": True, "machine": ANVIZ_IP, "port": ANVIZ_PORT, "info": info})

            elif path == "/info":
                respond(self, {"success": True, "data": dev.get_record_info()})

            elif path == "/staff":
                staff = dev.download_staff()
                respond(self, {"success": True, "count": len(staff), "data": staff})

            elif path in ("/records", "/records/new"):
                new_only  = path.endswith("/new")
                date_from = date_to = None
                if "from" in qs:
                    try: date_from = datetime.strptime(qs["from"][0], "%Y-%m-%d").date()
                    except: pass
                if "to" in qs:
                    try: date_to = datetime.strptime(qs["to"][0], "%Y-%m-%d").date()
                    except: pass
                recs = dev.download_records(new_only=new_only, date_from=date_from, date_to=date_to)
                respond(self, {"success": True, "count": len(recs), "data": recs})

            else:
                respond(self, {"success": False, "error": "Unknown endpoint"}, 404)

        except Exception as e:
            respond(self, {"success": False, "error": str(e), "trace": traceback.format_exc()}, 500)
        finally:
            dev.disconnect()


if __name__ == "__main__":
    host = os.environ.get("BRIDGE_HOST", "127.0.0.1")
    port = int(os.environ.get("BRIDGE_PORT", "7070"))
    print(f"Anviz Bridge  →  {host}:{port}")
    print(f"Device target →  {ANVIZ_IP}:{ANVIZ_PORT}  (device_id={DEVICE_ID})")
    HTTPServer((host, port), Handler).serve_forever()
