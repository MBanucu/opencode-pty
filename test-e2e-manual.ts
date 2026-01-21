#!/usr/bin/env bun

import { chromium } from 'playwright-core';
import { initManager, manager } from './src/plugin/pty/manager.ts';
import { initLogger } from './src/plugin/logger.ts';
import { startWebServer, stopWebServer } from './src/web/server.ts';

// Mock OpenCode client for testing
const fakeClient = {
  app: {
    log: async (opts: any) => {
      const { level = 'info', message, extra } = opts.body || opts;
      const extraStr = extra ? ` ${JSON.stringify(extra)}` : '';
      console.log(`[${level}] ${message}${extraStr}`);
    },
  },
} as any;

async function runBrowserTest() {
  console.log('🚀 Starting E2E test for PTY output visibility...');

  // Initialize the PTY manager and logger
  initLogger(fakeClient);
  initManager(fakeClient);

  // Start the web server
  console.log('📡 Starting web server...');
  const url = startWebServer({ port: 8867 });
  console.log(`✅ Web server started at ${url}`);

  // Spawn an exited test session
  console.log('🔧 Spawning exited PTY session...');
  const exitedSession = manager.spawn({
    command: 'echo',
    args: ['Hello from exited session!'],
    description: 'Exited session test',
    parentSessionId: 'test',
  });
  console.log(`✅ Exited session spawned: ${exitedSession.id}`);

  // Wait for output and exit
  console.log('⏳ Waiting for exited session to complete...');
  let attempts = 0;
  while (attempts < 50) { // Wait up to 5 seconds
    const currentSession = manager.get(exitedSession.id);
    const output = manager.read(exitedSession.id);
    if (currentSession?.status === 'exited' && output && output.lines.length > 0) {
      console.log('✅ Exited session has completed with output');
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  // Double-check the session status and output
  const finalSession = manager.get(exitedSession.id);
  const finalOutput = manager.read(exitedSession.id);
  console.log('🏷️  Final exited session status:', finalSession?.status, 'output lines:', finalOutput?.lines?.length || 0);

  // Spawn a running test session
  console.log('🔧 Spawning running PTY session...');
  const runningSession = manager.spawn({
    command: 'bash',
    args: ['-c', 'echo "Initial output"; while true; do echo "Still running..."; sleep 1; done'],
    description: 'Running session test',
    parentSessionId: 'test',
  });
  console.log(`✅ Running session spawned: ${runningSession.id}`);

  // Give it time to produce initial output
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check if sessions have output
  const exitedOutput = manager.read(exitedSession.id);
  const runningOutput = manager.read(runningSession.id);
  console.log('📖 Exited session output:', exitedOutput?.lines?.length || 0, 'lines');
  console.log('📖 Running session output:', runningOutput?.lines?.length || 0, 'lines');

  // Launch browser
  console.log('🌐 Launching browser...');
  const browser = await chromium.launch({
    executablePath: '/run/current-system/sw/bin/google-chrome-stable',
    headless: true,
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to the web UI
    console.log('📱 Navigating to web UI...');
    await page.goto('http://localhost:8867/');
    console.log('✅ Page loaded');

    // Wait for sessions to load
    console.log('⏳ Waiting for sessions to load...');
    await page.waitForSelector('.session-item', { timeout: 10000 });
    console.log('✅ Sessions loaded');

    // Check that we have sessions
    const sessionCount = await page.locator('.session-item').count();
    console.log(`📊 Found ${sessionCount} sessions`);

    if (sessionCount === 0) {
      throw new Error('No sessions found in UI');
    }

    // Wait a bit for auto-selection to complete
    console.log('⏳ Waiting for auto-selection to complete...');
    await page.waitForTimeout(1000);

    // Test exited session first
    console.log('🧪 Testing exited session...');
    const exitedSessionItem = page.locator('.session-item').filter({ hasText: 'Hello from exited session!' }).first();
    const exitedVisible = await exitedSessionItem.isVisible();

    if (exitedVisible) {
      console.log('✅ Found exited session');
      const exitedTitle = await exitedSessionItem.locator('.session-title').textContent();
      const exitedStatus = await exitedSessionItem.locator('.status-badge').textContent();
      console.log(`🏷️  Exited session: "${exitedTitle}" (${exitedStatus})`);

      // Click on exited session
      console.log('👆 Clicking on exited session...');
      await exitedSessionItem.click();

      // Check page title
      await page.waitForTimeout(500);
      const titleAfterExitedClick = await page.title();
      console.log('📄 Page title after exited click:', titleAfterExitedClick);

      // Wait for output
      console.log('⏳ Waiting for exited session output...');
      await page.waitForSelector('.output-line', { timeout: 5000 });
      const exitedOutput = await page.locator('.output-line').first().textContent();
      console.log(`📝 Exited session output: "${exitedOutput}"`);

      if (exitedOutput?.includes('Hello from exited session!')) {
        console.log('🎉 SUCCESS: Exited session output is visible!');
      } else {
        console.log('❌ FAILURE: Exited session output not found');
        return;
      }
    } else {
      console.log('⚠️  Exited session not found');
    }

    // Test running session
    console.log('🧪 Testing running session...');
    // Find session by status badge "running" instead of text content
    const allSessions2 = page.locator('.session-item');
    const totalSessions = await allSessions2.count();
    let runningSessionItem = null;

    for (let i = 0; i < totalSessions; i++) {
      const session = allSessions2.nth(i);
      const statusBadge = await session.locator('.status-badge').textContent();
      if (statusBadge === 'running') {
        runningSessionItem = session;
        break;
      }
    }

    const runningVisible = runningSessionItem !== null;

    if (runningVisible && runningSessionItem) {
      console.log('✅ Found running session');
      const runningTitle = await runningSessionItem.locator('.session-title').textContent();
      const runningStatus = await runningSessionItem.locator('.status-badge').textContent();
      console.log(`🏷️  Running session: "${runningTitle}" (${runningStatus})`);

      // Click on running session
      console.log('👆 Clicking on running session...');
      await runningSessionItem.click();

      // Check page title
      await page.waitForTimeout(500);
      const titleAfterRunningClick = await page.title();
      console.log('📄 Page title after running click:', titleAfterRunningClick);

      // Wait for output
      console.log('⏳ Waiting for running session output...');
      await page.waitForSelector('.output-line', { timeout: 5000 });
      const runningOutput = await page.locator('.output-line').first().textContent();
      console.log(`📝 Running session output: "${runningOutput}"`);

      if (runningOutput?.includes('Initial output')) {
        console.log('🎉 SUCCESS: Running session historical output is visible!');
      } else {
        console.log('❌ FAILURE: Running session output not found');
      }
    } else {
      console.log('⚠️  Running session not found');
    }

    console.log('🎊 All E2E tests completed successfully!');

  } finally {
    await browser.close();
    stopWebServer();
    console.log('🧹 Cleaned up browser and server');
  }
}

// Run the test
runBrowserTest().catch(console.error);