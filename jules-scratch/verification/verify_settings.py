import asyncio
from playwright.async_api import async_playwright
import os

print("Starting verification script...")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Get the absolute path to the index.html file
        file_path = os.path.abspath('index.html')

        # Go to the local file
        await page.goto(f'file://{file_path}')

        # Wait for the page to load
        await page.wait_for_load_state('networkidle')

        # Click the settings button using JavaScript
        await page.evaluate("document.getElementById('settingsBtn').click()")

        # Wait for the modal to appear
        await page.wait_for_selector('#settingsModal')

        # Take a screenshot
        await page.screenshot(path='jules-scratch/verification/settings_modal.png')

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
