import sys, os, glob
from playwright.sync_api import sync_playwright

BASE = os.path.dirname(os.path.abspath(__file__))
# find chromium headless shell
cands = glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium_headless_shell-*/chrome-linux/headless_shell")) \
      + glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux/chrome"))
exe = cands[0] if cands else None

html = sys.argv[1]
out_prefix = sys.argv[2]
click_hotspot = int(sys.argv[3]) if len(sys.argv) > 3 else 0

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=exe, args=["--no-sandbox","--disable-gpu"])
    page = browser.new_page(viewport={"width":1280,"height":800})
    page.goto("file://"+os.path.join(BASE, html))
    page.wait_for_timeout(600)
    page.screenshot(path=f"{out_prefix}_home.png")
    # click a hotspot
    hs = page.query_selector_all(".hotspot")
    if hs and click_hotspot < len(hs):
        hs[click_hotspot].click()
        page.wait_for_timeout(1600)  # wait for push-in + diagram entered
        page.screenshot(path=f"{out_prefix}_detail.png")
    browser.close()
print("done", out_prefix)
