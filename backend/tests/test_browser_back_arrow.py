import asyncio
import io
import json
import os
import subprocess
import sys
import time
import urllib.request
import websockets

# Ensure UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9223
USER_DATA_DIR = r"C:\Users\Admin\AppData\Local\Temp\chrome-test-back-arrow"


class CDPClient:
    def __init__(self, ws_url):
        self.ws_url = ws_url
        self.ws = None
        self.msg_id = 0

    async def connect(self):
        self.ws = await websockets.connect(self.ws_url, max_size=10_000_000)

    async def send(self, method, params=None):
        self.msg_id += 1
        payload = {"id": self.msg_id, "method": method, "params": params or {}}
        await self.ws.send(json.dumps(payload))
        while True:
            res = await self.ws.recv()
            data = json.loads(res)
            if data.get("id") == self.msg_id:
                if "error" in data:
                    raise RuntimeError(f"CDP error: {data['error']}")
                return data.get("result", {})

    async def eval_js(self, expression):
        res = await self.send("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": True,
        })
        return res.get("result", {}).get("value")

    async def close(self):
        if self.ws:
            await self.ws.close()


async def main():
    print("Launching headless Chrome for real browser validation...")
    chrome_proc = subprocess.Popen([
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        f"--user-data-dir={USER_DATA_DIR}",
        "--no-first-run",
        "--no-default-browser-check",
        "http://localhost:5173",
    ])

    cdp = None
    try:
        # Wait for CDP endpoint
        targets = None
        for _ in range(20):
            try:
                with urllib.request.urlopen(f"http://localhost:{PORT}/json") as resp:
                    targets = json.loads(resp.read().decode())
                    break
            except Exception:
                time.sleep(0.5)

        assert targets, "Failed to connect to Chrome CDP"
        page_target = next(t for t in targets if t.get("type") == "page")
        ws_url = page_target["webSocketDebuggerUrl"]

        cdp = CDPClient(ws_url)
        await cdp.connect()
        await cdp.send("Page.enable")
        await cdp.send("Runtime.enable")

        print("[✓] Connected to Chrome via CDP!")

        # 1. Wait for Landing Page
        await asyncio.sleep(2)
        url = await cdp.eval_js("window.location.href")
        print(f"Current page URL: {url}")
        assert "5173" in url

        sections = [
            ("Human Resources", "hr", "/chat"),
            ("Engineering", "engineering", "/chat"),
            ("Finance", "finance", "/chat"),
            ("Admin Panel", "admin", "/admin-panel"),
        ]

        for dept_name, role, expected_path in sections:
            print(f"\n=======================================================")
            print(f"Testing {dept_name} Workspace Back Arrow Navigation")
            print(f"=======================================================")

            # Navigate to landing page
            await cdp.eval_js("window.location.href = 'http://localhost:5173/'")
            await asyncio.sleep(1.5)

            # Click section card to enter
            print(f"Entering {dept_name}...")
            clicked = await cdp.eval_js(f"""
                (() => {{
                    const allEls = Array.from(document.querySelectorAll('*'));
                    const target = allEls.find(el => el.children.length === 0 && el.innerText && el.innerText.trim() === '{dept_name}');
                    if (target) {{
                        let p = target;
                        while (p && p.tagName !== 'BODY') {{
                            if (p.style && p.style.cursor && p.style.cursor.includes('pointer')) {{
                                p.click();
                                return true;
                            }}
                            p = p.parentElement;
                        }}
                        target.click();
                        return true;
                    }}
                    return false;
                }})()
            """)
            print(f"Card clicked: {clicked}")

            # Wait for workspace to load
            curr_url = "/"
            for _ in range(30):
                await asyncio.sleep(0.5)
                curr_url = await cdp.eval_js("window.location.pathname")
                if curr_url == expected_path:
                    break

            print(f"[✓] Entered workspace at: {curr_url}")
            assert curr_url == expected_path, f"Path mismatch: {curr_url} != {expected_path}"

            # Verify Back Arrow button is present in the header
            back_btn_info = await cdp.eval_js("""
                (() => {
                    const btn = document.querySelector('button[title="Back to Home"]');
                    if (!btn) return null;
                    const rect = btn.getBoundingClientRect();
                    return {
                        exists: true,
                        title: btn.getAttribute('title'),
                        ariaLabel: btn.getAttribute('aria-label'),
                        visible: rect.width > 0 && rect.height > 0,
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height,
                    };
                })()
            """)
            print(f"[✓] Back Arrow button detected: {back_btn_info}")
            assert back_btn_info and back_btn_info["exists"], "Back button not found!"
            assert back_btn_info["visible"], "Back button not visible!"
            assert back_btn_info["title"] == "Back to Home", f"Title mismatch: {back_btn_info['title']}"

            # Click Back Arrow
            print("Clicking Back Arrow (←)...")
            await cdp.eval_js("""
                (() => {
                    const btn = document.querySelector('button[title="Back to Home"]');
                    btn.click();
                })()
            """)

            # Wait for navigation to /
            new_url = ""
            for _ in range(20):
                await asyncio.sleep(0.3)
                new_url = await cdp.eval_js("window.location.pathname")
                if new_url == "/":
                    break

            print(f"[✓] Navigated back to: {new_url}")
            assert new_url == "/", f"Expected to be at '/', but got: {new_url}"

            # Check authentication state is preserved
            cookies = await cdp.send("Network.getCookies", {"urls": ["http://localhost:5173"]})
            cookie_names = [c["name"] for c in cookies.get("cookies", [])]
            print(f"[✓] Cookies preserved: {cookie_names}")
            assert "access_token" in cookie_names, "access_token lost!"

        print("\n=======================================================")
        print("ALL BROWSER NAVIGATION TESTS PASSED PERFECTLY!")
        print("=======================================================")

    finally:
        if cdp:
            await cdp.close()
        chrome_proc.terminate()
        try:
            chrome_proc.wait(timeout=3)
        except Exception:
            chrome_proc.kill()


if __name__ == "__main__":
    asyncio.run(main())
