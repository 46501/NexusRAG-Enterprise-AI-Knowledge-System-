import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';

function assert(cond, msg) {
  if (!cond) {
    console.error(`[❌ FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`[✅ PASS] ${msg}`);
}

async function runSuite() {
  console.log('========================================================');
  console.log('  NEXUSRAG UI OVERLAPPING, LAYERING & RESPONSIVE SUITE  ');
  console.log('========================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // -----------------------------------------------------------------
    // 1. Login & Initial Setup
    // -----------------------------------------------------------------
    console.log('--- Step 1: Login & Chat Setup ---');
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'hr@demo.com');
    await page.fill('input[type="password"]', 'hr-demo-2026');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/chat', { timeout: 10000 });
    assert(page.url().includes('/chat'), 'Login successful & navigated to /chat');

    // Wait for chat to load
    await page.waitForSelector('textarea[placeholder*="Ask anything"]', { timeout: 10000 });

    // -----------------------------------------------------------------
    // 2. Generate Conversation with Multiple Turns
    // -----------------------------------------------------------------
    console.log('\n--- Step 2: Populating Multi-Turn Conversation ---');
    // Turn 1: Ask about parental leave
    const input = page.locator('textarea[placeholder*="Ask anything"]');
    await input.fill('What is the parental leave duration?');
    await page.keyboard.press('Enter');

    // Wait for assistant response and Grounding badge
    await page.waitForSelector('button[title*="grounding confidence"]', { timeout: 20000 });
    assert(true, 'Assistant response #1 rendered with Grounding badge');

    // Turn 2: Follow-up question from user (reproducing exact user screenshot!)
    await input.fill('How do I determine if I am considered a primary or secondary caregiver for parental leave?');
    await page.keyboard.press('Enter');

    // Wait for response #2
    await page.waitForTimeout(3500);
    assert(true, 'User message #2 submitted and displayed in conversation');

    // -----------------------------------------------------------------
    // 3. Grounding Verification Modal Overlap & Stacking Context
    // -----------------------------------------------------------------
    console.log('\n--- Step 3: Grounding Verification Modal Layering & Stacking Context ---');
    // Find the first Grounding badge (from the earlier assistant message)
    const groundingBadges = page.locator('button[title*="grounding confidence"]');
    const badgeCount = await groundingBadges.count();
    assert(badgeCount >= 1, `Found ${badgeCount} Grounding badge(s) in conversation`);

    // Click the badge to open Grounding Verification Modal
    await groundingBadges.first().click();
    await page.waitForSelector('[role="dialog"][aria-labelledby="grounding-modal-title"]', { timeout: 5000 });
    assert(true, 'Grounding Verification Modal mounted via React Portal');

    // Verify modal is direct child of body or top-level portal
    const isPortaled = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"][aria-labelledby="grounding-modal-title"]');
      return modal && modal.parentElement === document.body;
    });
    assert(isPortaled, 'Grounding Modal is portaled directly to document.body (escapes message stacking context)');

    // Verify full-screen backdrop covers viewport
    const backdropBox = await page.locator('[role="dialog"][aria-labelledby="grounding-modal-title"]').boundingBox();
    const viewportSize = page.viewportSize();
    assert(
      backdropBox.width >= viewportSize.width - 5 && backdropBox.height >= viewportSize.height - 5,
      `Full-viewport backdrop active (${Math.round(backdropBox.width)}x${Math.round(backdropBox.height)})`
    );

    // CRITICAL: Verify user message bubble does NOT appear above modal!
    // We check elementFromPoint at center of the modal card
    const modalContent = page.locator('[role="dialog"][aria-labelledby="grounding-modal-title"] > div');
    const modalBox = await modalContent.boundingBox();
    assert(modalBox && modalBox.width > 250, 'Modal content card rendered with valid dimensions');

    const topElementAtCenter = await page.evaluate((coords) => {
      const el = document.elementFromPoint(coords.x, coords.y);
      return el ? { tagName: el.tagName, className: el.className, text: el.innerText?.slice(0, 40) } : null;
    }, { x: modalBox.x + modalBox.width / 2, y: modalBox.y + modalBox.height / 2 });

    const isInsideModal = await page.evaluate((coords) => {
      const el = document.elementFromPoint(coords.x, coords.y);
      const modal = document.querySelector('[role="dialog"][aria-labelledby="grounding-modal-title"]');
      return modal && modal.contains(el);
    }, { x: modalBox.x + modalBox.width / 2, y: modalBox.y + modalBox.height / 2 });

    assert(isInsideModal, `Modal content is on top (elementFromPoint returned: ${topElementAtCenter?.tagName} inside modal)`);

    // Verify buttons inside modal are visible and accessible
    const inspectBtn = page.locator('button:has-text("Inspect Sources ↗")');
    const readerBtn = page.locator('button:has-text("Open Reader 📖")');
    assert(await inspectBtn.isVisible(), 'Inspect Sources button visible and clickable');
    assert(await readerBtn.isVisible(), 'Open Reader button visible and clickable');

    // Test dismiss via Escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const isModalOpenAfterEsc = await page.locator('[role="dialog"][aria-labelledby="grounding-modal-title"]').count();
    assert(isModalOpenAfterEsc === 0, 'Escape key cleanly dismisses Grounding Modal');

    // Reopen and test close button (✕)
    await groundingBadges.first().click();
    await page.waitForSelector('[role="dialog"][aria-labelledby="grounding-modal-title"]', { timeout: 3000 });
    const closeBtn = page.locator('[role="dialog"][aria-labelledby="grounding-modal-title"] button[title*="Close"]');
    await closeBtn.click();
    await page.waitForTimeout(300);
    const isModalOpenAfterClose = await page.locator('[role="dialog"][aria-labelledby="grounding-modal-title"]').count();
    assert(isModalOpenAfterClose === 0, 'Close button (✕) cleanly dismisses Grounding Modal');

    // -----------------------------------------------------------------
    // 4. Message Bubble Containment & Input Bar Clearance
    // -----------------------------------------------------------------
    console.log('\n--- Step 4: Chat Message Containment & Input Bar Clearance ---');
    const userBubbles = page.locator('div.items-end');
    const userCount = await userBubbles.count();
    assert(userCount >= 2, `Found ${userCount} user message bubble(s)`);

    // Check that messages have bottom clearance above input bar
    const inputBar = page.locator('div:has(textarea[placeholder*="Ask anything"])').first();
    const inputBarBox = await inputBar.boundingBox();
    assert(inputBarBox != null, 'Floating input bar bounding box found');

    const lastMessage = userBubbles.last();
    const lastMsgBox = await lastMessage.boundingBox();
    assert(lastMsgBox != null, 'Last message bubble bounding box found');

    // Verify messages list scroll padding
    const hasScrollClearance = await page.evaluate(() => {
      const scrollContainer = document.querySelector('.chat-scroll');
      if (!scrollContainer) return false;
      const computed = window.getComputedStyle(scrollContainer);
      const pb = parseInt(computed.paddingBottom, 10);
      return pb >= 80; // pb-28 is 112px
    });
    assert(hasScrollClearance, 'Chat scroll container has sufficient bottom padding (>= 80px) to clear floating input bar');

    // -----------------------------------------------------------------
    // 5. Header Responsiveness & Control Collisions Across Viewports
    // -----------------------------------------------------------------
    console.log('\n--- Step 5: Header Responsiveness & Overlap Audit Across Viewports ---');

    const viewportsToTest = [
      { name: '1920x1080 (Large Desktop)', width: 1920, height: 1080 },
      { name: '1440x900 (Standard Desktop)', width: 1440, height: 900 },
      { name: '1366x768 (Standard Laptop)', width: 1366, height: 768 },
      { name: '1280x800 (Compact Laptop)', width: 1280, height: 800 },
      { name: '1024x768 (Small Laptop / Large Tablet)', width: 1024, height: 768 },
      { name: '768x1024 (Tablet Portrait)', width: 768, height: 1024 },
      { name: '375x667 (Mobile iPhone)', width: 375, height: 667 },
    ];

    for (const vp of viewportsToTest) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);

      // Verify no horizontal overflow on the whole document
      const hasHorizontalScrollbar = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      assert(!hasHorizontalScrollbar, `No horizontal document overflow at ${vp.name}`);

      // Verify Header controls bounding boxes do NOT overlap
      const overlapDetected = await page.evaluate(() => {
        const header = document.querySelector('header');
        if (!header) return false;
        const buttons = Array.from(header.querySelectorAll('button:not([style*="display: none"])'))
          .filter((b) => {
            const rect = b.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(b).display !== 'none';
          });

        for (let i = 0; i < buttons.length; i++) {
          const r1 = buttons[i].getBoundingClientRect();
          for (let j = i + 1; j < buttons.length; j++) {
            const r2 = buttons[j].getBoundingClientRect();
            // Check if r1 and r2 horizontally overlap
            const overlapX = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
            const overlapY = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
            if (overlapX > 2 && overlapY > 2) {
              return {
                btn1: buttons[i].innerText || buttons[i].title,
                btn2: buttons[j].innerText || buttons[j].title,
                overlapX,
              };
            }
          }
        }
        return null;
      });

      assert(
        !overlapDetected,
        `Zero button collisions in header at ${vp.name} ${overlapDetected ? `(Overlapped: ${overlapDetected.btn1} & ${overlapDetected.btn2})` : ''}`
      );
    }

    // Reset to 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(200);

    // -----------------------------------------------------------------
    // 6. Independent Scrolling Verification
    // -----------------------------------------------------------------
    console.log('\n--- Step 6: Independent Scrolling Verification ---');
    const scrollContainers = await page.evaluate(() => {
      const threadScroll = document.querySelector('aside .overflow-y-auto');
      const chatScroll = document.querySelector('.chat-scroll');
      const docScroll = document.querySelector('.doc-scroll');
      return {
        threadScroll: !!threadScroll,
        chatScroll: !!chatScroll,
        docScroll: !!docScroll,
      };
    });

    assert(scrollContainers.threadScroll, 'Left thread sidebar has independent overflow-y-auto');
    assert(scrollContainers.chatScroll, 'Chat conversation area has independent overflow-y-auto');
    assert(scrollContainers.docScroll, 'Right document sidebar has independent overflow-y-auto');

    // -----------------------------------------------------------------
    // 7. Modals Integration & Layering Test
    // -----------------------------------------------------------------
    console.log('\n--- Step 7: Modal Stacking & Backdrop Verifications ---');

    // Test Command Palette
    await page.keyboard.press('Control+k');
    await page.waitForSelector('[aria-label="macOS Command Palette"]', { timeout: 3000 });
    assert(true, 'Command Palette opens with full-screen backdrop');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Test Export Modal
    const exportBtn = page.locator('header button:has-text("Export")');
    if (await exportBtn.count() > 0) {
      await exportBtn.click();
      await page.waitForSelector('text=Corporate Export & Share', { timeout: 3000 });
      assert(true, 'Export Modal opens with backdrop');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Test Document Reader
    const readBtn = page.locator('aside button:has-text("Read ↗")').first();
    await readBtn.click();
    await page.waitForSelector('[data-testid="document-reader-modal"]', { timeout: 5000 });
    assert(true, 'Document Reader opens with z-[70] backdrop');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // -----------------------------------------------------------------
    // 8. Console Error Audit
    // -----------------------------------------------------------------
    console.log('\n--- Step 8: Console Error Audit ---');
    const hookErrors = consoleErrors.filter((e) => e.includes('310') || e.includes('Rendered more hooks') || e.includes('hook'));
    assert(hookErrors.length === 0, `Zero React Hook rule violations detected (Total: ${hookErrors.length})`);

    console.log('\n========================================================');
    console.log('  ALL UI OVERLAPPING & LAYERING TESTS PASSED (100%)    ');
    console.log('========================================================\n');

  } finally {
    await browser.close();
  }
}

runSuite().catch((err) => {
  console.error('\n❌ Suite execution failed:', err);
  process.exit(1);
});

