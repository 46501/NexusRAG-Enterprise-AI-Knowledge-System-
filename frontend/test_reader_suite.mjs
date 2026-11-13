import { chromium } from 'playwright';

async function runTestSuite() {
  console.log('====================================================');
  console.log('  NEXUSRAG GLOBAL OPEN READER & PDF VIEWER SUITE    ');
  console.log('====================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 860 },
  });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('401 (Unauthorized)') && !text.includes('favicon')) {
        console.log('[BROWSER CONSOLE ERROR]:', text);
        errors.push(text);
      }
    }
  });

  page.on('pageerror', err => {
    console.error('[BROWSER UNCAUGHT PAGE ERROR]:', err.message);
    errors.push(err.message);
  });

  const testResults = [];
  function recordTest(name, passed, details = '') {
    testResults.push({ name, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${mark}] ${name} ${details ? '— ' + details : ''}`);
  }

  try {
    // -------------------------------------------------------------
    // Step 1: Login as HR User
    // -------------------------------------------------------------
    console.log('\n--- Step 1: Logging in as hr@demo.com ---');
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'hr@demo.com');
    await page.fill('input[type="password"]', 'hr-demo-2026');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/chat**', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    recordTest('User Login (HR Demo)', page.url().includes('/chat'));

    const readerModal = page.locator('[data-testid="document-reader-modal"]');

    // Wait for documents list to be rendered in sidebar
    await page.locator('aside ul li').first().waitFor({ state: 'visible', timeout: 10000 });
    const allDocNames = await page.locator('aside li p').allTextContents();
    console.log(`Sidebar loaded with ${allDocNames.length} documents:`, allDocNames);

    // -------------------------------------------------------------
    // Step 2: Test Document Sidebar "Read ↗" on Real Multi-Page PDF
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Testing Document Sidebar Read on PDF Document ---');
    const pdfDocRow = page.locator('aside li:has-text("benefits_summary_guide.pdf")').first();
    const hasPdfDocRow = await pdfDocRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasPdfDocRow) {
      const pdfReadBtn = pdfDocRow.locator('button:has-text("Read ↗")');
      await pdfReadBtn.click();
      console.log('Clicked Read ↗ on benefits_summary_guide.pdf');

      await readerModal.waitFor({ state: 'visible', timeout: 5000 });
      // Wait for reader's metadata fetching spinner
      await readerModal.locator('.animate-spin').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);

      // Verify PDF Viewer root is mounted
      const pdfViewerRoot = readerModal.locator('[data-testid="pdf-viewer-root"]');
      const hasPdfViewer = await pdfViewerRoot.isVisible();
      recordTest('PDF Viewer Mounted on PDF Document Open', hasPdfViewer);

      // Wait for PDF canvas rendering to complete
      const pdfCanvas = readerModal.locator('canvas[data-testid^="pdf-page-"]').first();
      await pdfCanvas.waitFor({ state: 'visible', timeout: 15000 });
      const canvasVisible = await pdfCanvas.isVisible();
      const pageCanvasCount = await readerModal.locator('canvas[data-testid^="pdf-page-"]').count();
      recordTest(
        'PDF Multi-Page Canvas Rendered',
        canvasVisible && pageCanvasCount >= 1,
        `${pageCanvasCount} rendered page canvas(es)`
      );

      // Verify PDF View Button is present and active in segmented toolbar
      const btnPdfView = readerModal.locator('[data-testid="btn-pdf-view"]');
      const hasBtnPdfView = await btnPdfView.isVisible();
      recordTest('Segmented Toolbar "PDF View" Option Present', hasBtnPdfView);

      // Verify Zoom In & Label
      const initialZoomText = await readerModal.locator('[data-testid="pdf-zoom-label"]').textContent();
      const zoomInBtn = readerModal.locator('[data-testid="pdf-zoom-in"]');
      await zoomInBtn.click();
      await page.waitForTimeout(300);
      const newZoomText = await readerModal.locator('[data-testid="pdf-zoom-label"]').textContent();
      recordTest(
        'PDF Zoom Controls',
        newZoomText !== initialZoomText,
        `Zoom changed from ${initialZoomText} to ${newZoomText}`
      );

      // Test Fit Width
      const fitWidthBtn = readerModal.locator('[data-testid="pdf-fit-width"]');
      await fitWidthBtn.click();
      await page.waitForTimeout(300);
      const fitZoomText = await readerModal.locator('[data-testid="pdf-zoom-label"]').textContent();
      recordTest('PDF Fit Width Action', !!fitZoomText, `Fit-width scale: ${fitZoomText}`);

      // Test Switching to Chunk View on the PDF document
      const btnChunkView = readerModal.locator('[data-testid="btn-chunk-view"]');
      await btnChunkView.click();
      await page.waitForTimeout(400);
      const chunksVisible = await readerModal.locator('[data-testid="reader-chunks-view"]').isVisible();
      const chunksCount = await readerModal.locator('div:has-text("Chunk ")').count();
      recordTest(
        'Switch to Extracted Chunks on PDF Document',
        chunksVisible && chunksCount > 0,
        `${chunksCount} vector chunks rendered`
      );

      // Test Switching to Continuous Text
      const btnFullText = readerModal.locator('[data-testid="btn-continuous-text"]');
      await btnFullText.click();
      await page.waitForTimeout(400);
      const fullTextVisible = await readerModal.locator('[data-testid="reader-fulltext-view"]').isVisible();
      recordTest('Switch to Continuous Text on PDF Document', fullTextVisible);

      // Switch back to PDF view
      await btnPdfView.click();
      await page.waitForTimeout(500);
      const pdfViewRestored = await pdfViewerRoot.isVisible();
      recordTest('Switch Back to PDF View Mode', pdfViewRestored);

      // Verify Download button exists
      const downloadBtn = readerModal.locator('[data-testid="pdf-download-btn"]');
      const hasDownloadBtn = await downloadBtn.isVisible();
      recordTest('PDF Download Button Present', hasDownloadBtn);

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      recordTest('Close PDF Reader via Escape Key', !(await readerModal.isVisible()));
    } else {
      recordTest('PDF Document Found in Sidebar', false, 'benefits_summary_guide.pdf not in sidebar');
    }

    // -------------------------------------------------------------
    // Step 3: Test Document Sidebar "Read ↗" on TXT Document
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Testing Document Sidebar Read on TXT Document ---');
    const txtDocRow = page.locator('aside li:has-text(".txt")').first();
    if (await txtDocRow.isVisible()) {
      const txtReadBtn = txtDocRow.locator('button:has-text("Read ↗")');
      await txtReadBtn.click();
      await readerModal.waitFor({ state: 'visible', timeout: 5000 });
      await readerModal.locator('.animate-spin').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(500);

      const txtChunksVisible = await readerModal.locator('[data-testid="reader-chunks-view"]').isVisible();
      const txtChunksCount = await readerModal.locator('div:has-text("Chunk ")').count();
      recordTest(
        'TXT Document Opens in Chunk View (No Blank Screen)',
        txtChunksVisible && txtChunksCount > 0,
        `${txtChunksCount} chunks rendered`
      );

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // -------------------------------------------------------------
    // Step 4: Send Query & Test Grounding "Open Reader"
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Sending query and testing Grounding "Open Reader" ---');
    const input = page.locator('textarea, input[placeholder*="Ask"]');
    await input.fill('What is the vacation PTO and leave policy?');
    await page.keyboard.press('Enter');

    console.log('Waiting for RAG answer and Grounding badge...');
    const groundingBadge = page.locator('button:has-text("Grounded")').first();
    await groundingBadge.waitFor({ state: 'visible', timeout: 35000 });
    console.log('Grounding badge visible! Clicking badge...');
    await groundingBadge.click();
    await page.waitForTimeout(600);

    const groundingOpenReader = page.locator('button:has-text("Open Reader")').first();
    const hasGroundingBtn = await groundingOpenReader.isVisible();
    recordTest('Grounding Popover "Open Reader" Button Present', hasGroundingBtn);

    if (hasGroundingBtn) {
      await groundingOpenReader.click();
      await readerModal.waitFor({ state: 'visible', timeout: 5000 });
      await readerModal.locator('.animate-spin').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(500);

      const groundingReaderVisible = await readerModal.isVisible();
      const groundingChunksCount = await readerModal.locator('div:has-text("Chunk ")').count();
      const citedChunkCount = await readerModal.locator('span:has-text("Cited Source Chunk")').count();

      recordTest(
        'Grounding Popover Open Reader Action',
        groundingReaderVisible && groundingChunksCount > 0,
        `${groundingChunksCount} chunks rendered, ${citedChunkCount} cited highlighted chunk`
      );

      // In-reader search
      const searchInput = readerModal.locator('input[placeholder*="Find"]');
      await searchInput.fill('leave');
      await page.waitForTimeout(400);
      const matchCountBadge = await readerModal.locator('span:has-text("chunk match")').textContent();
      recordTest('In-Reader Text Search Filter', !!matchCountBadge, matchCountBadge?.trim());

      // Close reader with traffic light close button
      const closeBtn = readerModal.locator('button[title*="Close window"]').first();
      await closeBtn.click();
      await page.waitForTimeout(500);
    }

    // -------------------------------------------------------------
    // Step 5: Test Citation Drawer "View in Reader"
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Testing Citation Drawer "View in Reader" ---');
    const citationChip = page.locator('button:has-text("[1]")').first();
    if (await citationChip.isVisible()) {
      await citationChip.click();
      await page.waitForTimeout(800);

      const drawerVisible = await page.locator('h3:has-text("Citation Inspector")').isVisible();
      const viewInReaderBtn = page.locator('button:has-text("View in Reader")').first();
      const hasViewInReader = await viewInReaderBtn.isVisible();

      recordTest('Citation Drawer Opened', drawerVisible && hasViewInReader);

      if (hasViewInReader) {
        await viewInReaderBtn.click();
        await readerModal.waitFor({ state: 'visible', timeout: 5000 });
        await readerModal.locator('.animate-spin').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(500);

        const drawerReaderVisible = await readerModal.isVisible();
        const drawerChunksCount = await readerModal.locator('div:has-text("Chunk ")').count();
        recordTest(
          'Citation Drawer "View in Reader" Action',
          drawerReaderVisible && drawerChunksCount > 0,
          `${drawerChunksCount} chunks rendered`
        );

        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    // -------------------------------------------------------------
    // Step 5b: Test Document Comparison Modal & Matrix Generation
    // -------------------------------------------------------------
    console.log('\n--- Step 5b: Testing Document Comparison Modal ---');
    const compareBtn = page.locator('button[title*="Compare documents side-by-side"]').first();
    if (await compareBtn.isVisible()) {
      await compareBtn.click();
      await page.waitForTimeout(500);

      const comparisonModal = page.locator('text=Multi-Document Comparison Matrix');
      const hasComparisonModal = await comparisonModal.isVisible();
      recordTest('Document Comparison Modal Opened', hasComparisonModal);

      if (hasComparisonModal) {
        const generateBtn = page.locator('button:has-text("Generate Matrix")').first();
        if (await generateBtn.isVisible()) {
          console.log('Clicking Generate Matrix...');
          await generateBtn.click();
          const resultSelector = page.locator('table, [data-testid="comparison-fallback-text"], div:has-text("Executive Summary")').first();
          await resultSelector.waitFor({ state: 'visible', timeout: 35000 });
          const hasTableOrSummary = await resultSelector.isVisible();
          recordTest('Document Comparison Matrix Generated (No 502 / No Error)', hasTableOrSummary);
        }

        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    // -------------------------------------------------------------
    // Step 6: Test Admin Ingested Documents "Read ↗" on PDF
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Testing Admin Ingested Documents "Read ↗" on PDF ---');
    const adminContext = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    const adminPage = await adminContext.newPage();

    await adminPage.goto('http://localhost:5173/login');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.fill('input[type="email"]', 'admin@example.com');
    await adminPage.fill('input[type="password"]', 'admin-demo-2026');
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForURL('**/admin-panel**', { timeout: 15000 });
    recordTest('Admin Login Success', adminPage.url().includes('/admin-panel'));

    // Switch to Documents tab
    const docsTabBtn = adminPage.locator('button:has-text("Documents")').first();
    await docsTabBtn.click();
    await adminPage.locator('table').waitFor({ state: 'visible', timeout: 10000 });
    await adminPage.waitForTimeout(500);

    // Look for PDF row in admin table
    const adminPdfRow = adminPage.locator('table tr:has-text(".pdf")').first();
    if (await adminPdfRow.isVisible()) {
      const adminReadBtn = adminPdfRow.locator('button:has-text("Read ↗")');
      await adminReadBtn.click();
      const adminModal = adminPage.locator('[data-testid="document-reader-modal"]');
      await adminModal.waitFor({ state: 'visible', timeout: 8000 });
      await adminModal.locator('.animate-spin').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
      const pdfViewerLocator = adminModal.locator('[data-testid="pdf-viewer-root"]');
      await pdfViewerLocator.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

      const adminReaderVisible = await adminModal.isVisible();
      const adminPdfViewerVisible = await pdfViewerLocator.isVisible();
      recordTest(
        'Admin Ingested PDF "Read ↗" Action',
        adminReaderVisible && adminPdfViewerVisible,
        'Rendered PDF viewer directly in admin panel modal'
      );

      await adminPage.keyboard.press('Escape');
      await adminPage.waitForTimeout(500);
    }
    await adminContext.close();

    // -------------------------------------------------------------
    // Step 7: Backend Binary PDF Serving API Direct Verification (Authenticated)
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Testing Backend Binary PDF Endpoint ---');
    const apiTest = await page.evaluate(async () => {
      try {
        const resp = await fetch('/api/v1/documents/benefits_summary_guide.pdf/file', {
          credentials: 'include',
        });
        const ct = resp.headers.get('content-type');
        const blob = await resp.blob();
        return {
          status: resp.status,
          contentType: ct,
          sizeBytes: blob.size,
          ok: resp.ok,
        };
      } catch (e) {
        return { error: e.message };
      }
    });

    recordTest(
      'Binary PDF API Response (/file)',
      apiTest.status === 200 && apiTest.contentType?.includes('application/pdf') && apiTest.sizeBytes > 1000,
      `Status: ${apiTest.status}, Content-Type: ${apiTest.contentType}, Size: ${apiTest.sizeBytes} bytes`
    );

    // -------------------------------------------------------------
    // Step 8: React Invariant / Console Error Audit
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Console Error & Invariant Audit ---');
    const hookErrors = errors.filter(e => e.includes('Rendered more hooks') || e.includes('Rules of Hooks'));
    recordTest('Zero React Hook Rule Violations', hookErrors.length === 0, `${hookErrors.length} violations detected`);

  } catch (err) {
    console.error('Test execution error:', err);
    recordTest('Test Suite Complete Execution', false, err.message);
  } finally {
    await browser.close();
    console.log('\n====================================================');
    console.log('               TEST RUN SUMMARY                     ');
    console.log('====================================================');
    const passedCount = testResults.filter(t => t.passed).length;
    const totalCount = testResults.length;
    console.log(`Total Tests: ${totalCount} | Passed: ${passedCount} | Failed: ${totalCount - passedCount}`);
    console.log('====================================================');
  }
}

runTestSuite();
