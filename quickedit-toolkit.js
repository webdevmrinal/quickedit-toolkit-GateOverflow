// @toolkit-version 9.0.2
// GATE Overflow Quickedit Toolkit — Remote Payload
// Fetched & executed by the Loader userscript. Not meant to be installed directly in Tampermonkey.
// For direct installation use quickedit-toolkit-v9.0.user.js instead.
// Both sequence switches default OFF. Changes affect state.working (JSON and update payloads).
// Sort: numeric ascending Post ID. Number titles: final ": N" becomes ": 1", ": 2", ...
// Turning a switch off restores its prior order/numbers. Metadata never enters exported JSON.

(function () {
    'use strict';

    const TOOLKIT_VERSION = '9.0.2';

    /* ============================================================
       STATE
    ============================================================ */
    const state = {
        sortByPostID: false,
        sequenceTitles: false,
        rowMeta: new WeakMap(),
        nextRowOrder: 0,
        original: [],
        working: [],
        history: [],
        itemStatus: {},
        lockNonFailed: false,
        hasCompletedRun: false,
        runStartTime: null,
        runCompletedItems: 0,
        isRunning: false,
        isPaused: false,
        stopRequested: false,
        consecutiveFailures: 0,
        consecutiveAuthFailures: 0,
        minDelay: 10,
        maxDelay: 15,

        // Smart Renumber
        renumberBaseline: null,          // { mode, prefix/perItemPrefix, suffix, defaultPad, originalTitles }
        renumberDetectionFailReason: null,
        renumberCurrentStart: null,
        renumberCurrentPad: null,
    };

    const HIDE_DEFAULTS_KEY = 'qa_hide_defaults_v1';
    const FAB_POSITION_KEY  = 'qa_fab_position_v1';

    /* ============================================================
       STYLES
    ============================================================ */
    const STYLE = `
    #qa-modal-overlay, #qa-extract-fab, #qa-tag-search {
        --qa-blue: #0071e3;
        --qa-blue-hover: #0077ed;
        --qa-green: #34c759;
        --qa-green-hover: #2fb350;
        --qa-yellow: #ff9f0a;
        --qa-red: #ff3b30;
        --qa-bg: #ffffff;
        --qa-bg-secondary: #f5f5f7;
        --qa-text: #1d1d1f;
        --qa-text-secondary: #6e6e73;
        --qa-border: #d2d2d7;
        --qa-radius: 12px;
        --qa-font: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
    }

    body.qa-modal-open { overflow: hidden; }
    body.qa-modal-open #qa-extract-fab { visibility: hidden; }

    #qa-tag-search {
        display: block; margin-bottom: 6px; padding: 6px 10px; width: 250px;
        font-size: 14px; box-sizing: border-box; border: 1px solid var(--qa-border);
        border-radius: 8px; font-family: var(--qa-font);
    }
    #qa-tag-search:focus {
        outline: none; border-color: var(--qa-blue);
        box-shadow: 0 0 0 3px rgba(0,113,227,0.15);
    }

    #qa-extract-fab {
        position: fixed; bottom: 28px; left: 28px; z-index: 100000000;
        background: var(--qa-blue); color: #fff; border: none; border-radius: 980px;
        padding: 14px 22px; font-size: 15px; font-weight: 600; font-family: var(--qa-font);
        box-shadow: 0 4px 14px rgba(0,0,0,0.18); cursor: grab;
        transition: background 0.2s ease, box-shadow 0.2s ease;
        display: inline-flex; align-items: center; gap: 6px;
        user-select: none; -webkit-user-select: none; touch-action: none;
    }
    #qa-extract-fab:hover:not(:disabled) {
        background: var(--qa-blue-hover);
        box-shadow: 0 6px 18px rgba(0,0,0,0.22);
    }
    #qa-extract-fab:active:not(:disabled) { cursor: grabbing; }
    #qa-extract-fab.qa-fab-dragging {
        transition: none; cursor: grabbing;
        box-shadow: 0 10px 30px rgba(0,0,0,0.32);
    }
    #qa-extract-fab:disabled { background: #c7c7cc; cursor: not-allowed; box-shadow: none; }

    .qa-version-chip {
        display: inline-block; font-size: 10px; font-weight: 700;
        background: rgba(255,255,255,0.22); color: #fff;
        border-radius: 999px; padding: 2px 8px;
        letter-spacing: 0.02em; vertical-align: middle; line-height: 1.6;
        flex-shrink: 0;
    }
    .qa-header-version {
        display: inline-flex; align-items: center;
        font-size: 10px; font-weight: 600; color: var(--qa-text-secondary);
        background: var(--qa-bg); border: 1px solid var(--qa-border);
        border-radius: 999px; padding: 2px 9px; margin-left: 9px;
        letter-spacing: 0.01em; vertical-align: middle;
    }

    #qa-modal-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.35);
        backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
        z-index: 100000000; display: flex; align-items: center; justify-content: center;
        opacity: 0; pointer-events: none; transition: opacity 0.25s ease;
        font-family: var(--qa-font);
    }
    #qa-modal-overlay.qa-visible { opacity: 1; pointer-events: all; }

    #qa-modal {
        background: var(--qa-bg); width: min(860px, 92vw); height: min(660px, 88vh);
        border-radius: var(--qa-radius); box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        display: flex; flex-direction: column; overflow: hidden;
        transform: scale(0.94) translateY(10px);
        transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1); position: relative;
    }
    #qa-modal-overlay.qa-visible #qa-modal { transform: scale(1) translateY(0); }

    #qa-modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 18px; border-bottom: 1px solid var(--qa-border);
        background: var(--qa-bg-secondary); flex-shrink: 0;
    }
    #qa-modal-header h2 {
        margin: 0; font-size: 15px; font-weight: 600; color: var(--qa-text);
        display: flex; align-items: center;
    }
    #qa-modal-close {
        width: 26px; height: 26px; border-radius: 50%; border: none;
        background: #e8e8ed; color: var(--qa-text-secondary); font-size: 14px;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: background 0.15s ease;
    }
    #qa-modal-close:hover { background: #d8d8dd; }

    #qa-tabs {
        display: flex; gap: 4px; padding: 8px 18px 0;
        background: var(--qa-bg-secondary); flex-shrink: 0; flex-wrap: wrap;
    }
    .qa-tab-btn {
        border: none; background: transparent; padding: 6px 14px; font-size: 13px; font-weight: 500;
        color: var(--qa-text-secondary); cursor: pointer; border-radius: 7px 7px 0 0; transition: color 0.15s ease;
    }
    .qa-tab-btn.qa-active { color: var(--qa-blue); background: var(--qa-bg); }
    .qa-tab-btn.qa-tab-locked { opacity: 0.55; }

    #qa-toolbar {
        display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
        padding: 10px 18px; background: var(--qa-bg-secondary);
        border-bottom: 1px solid var(--qa-border); flex-shrink: 0;
    }
    #qa-toolbar.qa-hidden { display: none; }
    .qa-toolbar-group {
        display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
        background: var(--qa-bg); border: 1px solid var(--qa-border);
        border-radius: 9px; padding: 6px 9px;
    }
    .qa-field-stack { display: flex; flex-direction: column; gap: 2px; }
    .qa-field-stack label {
        font-size: 9.5px; color: var(--qa-text-secondary); font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.02em;
    }
    .qa-toolbar input[type="text"], .qa-toolbar input[type="number"], .qa-toolbar select {
        border: 1px solid var(--qa-border); border-radius: 6px; padding: 4px 7px;
        font-size: 12px; font-family: var(--qa-font);
    }
    .qa-toolbar input[type="number"] { width: 48px; }
    .qa-toolbar input[type="text"] { width: 120px; }
    .qa-btn-sm {
        border: none; border-radius: 7px; padding: 5px 11px; font-size: 12.5px; font-weight: 600;
        cursor: pointer; color: #fff; background: var(--qa-blue); transition: background 0.15s ease; height: 27px;
    }
    .qa-btn-sm:hover { background: var(--qa-blue-hover); }
    .qa-btn-sm.qa-secondary { background: #8e8e93; }
    .qa-btn-sm.qa-secondary:hover { background: #77777c; }
    .qa-btn-sm.qa-danger { background: var(--qa-red); }
    .qa-btn-sm.qa-danger:hover { background: #e0342b; }
    .qa-btn-sm:disabled { background: #c7c7cc !important; cursor: not-allowed; }
    .qa-checkbox-wrap {
        display: flex; align-items: center; gap: 4px;
        font-size: 11px; color: var(--qa-text-secondary); height: 27px;
    }
    #qa-toolbar-right { margin-left: auto; display: flex; gap: 6px; align-self: center; }

    #qa-fr-count {
        font-size: 12px; font-weight: 700; color: var(--qa-blue);
        padding: 4px 2px; min-width: 60px;
    }

    #qa-modal-body {
        flex: 1; overflow: auto; padding: 16px 18px;
        background: var(--qa-bg); position: relative;
    }
    .qa-tab-panel { display: none; height: 100%; }
    .qa-tab-panel.qa-active { display: flex; flex-direction: column; }

    /* ---- Smart Renumber panel ---- */
    .qa-renumber-panel {
        border: 1px solid var(--qa-border); background: var(--qa-bg-secondary);
        border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; flex-shrink: 0;
    }
    .qa-renumber-panel.qa-hidden { display: none; }
    .qa-renumber-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 10px; font-size: 13px; color: var(--qa-text);
    }
    .qa-renumber-header-actions { display: flex; gap: 6px; }
    .qa-renumber-fail {
        font-size: 12.5px; color: #86201b; background: #fdecea; border: 1px solid #f5c2c0;
        padding: 10px 12px; border-radius: 9px; line-height: 1.5;
    }
    .qa-renumber-fail-reason { display: block; margin-top: 4px; font-style: italic; opacity: 0.85; }
    .qa-renumber-pattern {
        font-size: 12.5px; margin-bottom: 12px; display: flex; align-items: center;
        gap: 6px; flex-wrap: wrap; color: var(--qa-text-secondary);
    }
    .qa-renumber-pattern code {
        background: #ececee; padding: 2px 6px; border-radius: 5px;
        font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 11.5px; color: var(--qa-text);
    }
    .qa-renumber-num-slot { font-weight: 700; color: var(--qa-blue); padding: 0 2px; }
    .qa-renumber-controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; margin-bottom: 12px; }
    .qa-renumber-controls input {
        border: 1px solid var(--qa-border); border-radius: 7px; padding: 5px 9px;
        font-size: 12.5px; width: 80px; font-family: var(--qa-font);
    }
    .qa-renumber-collision-warning {
        background: #fdecea; border: 1px solid #f5c2c0; color: #86201b;
        border-radius: 9px; padding: 9px 12px; font-size: 12px; margin-bottom: 12px; line-height: 1.55;
    }
    .qa-renumber-collision-item { margin-top: 3px; }
    .qa-renumber-preview { margin-bottom: 12px; }
    .qa-renumber-preview-title {
        font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.02em;
        color: var(--qa-text-secondary); font-weight: 700; margin-bottom: 5px;
    }
    #qa-renumber-preview-list {
        max-height: 170px; overflow-y: auto; border: 1px solid var(--qa-border);
        border-radius: 9px; background: var(--qa-bg);
    }
    .qa-renumber-row {
        display: flex; align-items: center; gap: 10px; padding: 5px 10px;
        font-size: 12px; border-bottom: 1px solid var(--qa-border);
    }
    .qa-renumber-row:last-child { border-bottom: none; }
    .qa-renumber-row-idx { color: var(--qa-text-secondary); font-weight: 600; min-width: 30px; }
    .qa-renumber-row-post { color: var(--qa-text-secondary); min-width: 80px; }
    .qa-renumber-row-nums { font-family: "SF Mono", Menlo, Consolas, monospace; font-weight: 600; }
    .qa-renumber-row-old { color: var(--qa-red); text-decoration: line-through; }
    .qa-renumber-row-arrow { color: var(--qa-text-secondary); margin: 0 4px; }
    .qa-renumber-row-new { color: #0a7d33; }
    .qa-renumber-actions { display: flex; justify-content: flex-end; gap: 8px; }

    /* Cards */
    .qa-card-list { display: flex; flex-direction: column; gap: 8px; }
    .qa-card {
        border: 1px solid var(--qa-border); border-radius: 10px; padding: 11px 14px;
        transition: box-shadow 0.15s ease, background 0.3s ease;
        background: var(--qa-bg-secondary); position: relative;
    }
    .qa-card:hover { box-shadow: 0 2px 10px rgba(0,0,0,0.06); }
    .qa-card.qa-flash { background: #fff6d8; }
    .qa-card.qa-card-failed { background: #fff3f2; border-color: #ffc7c2; }
    .qa-card.qa-card-locked { background: #f2f2f4; }
    .qa-card.qa-card-locked .qa-edit-input {
        background: #e9e9ec; color: #9a9a9e; cursor: not-allowed;
    }
    .qa-card.qa-card-locked .qa-edit-input:hover { background: #e9e9ec; border-color: transparent; }

    .qa-card-meta { position: absolute; top: 9px; right: 12px; display: flex; align-items: center; gap: 6px; }
    .qa-card-index { font-size: 10.5px; color: var(--qa-text-secondary); font-weight: 600; }
    .qa-status-badge {
        font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 999px;
        text-transform: uppercase; letter-spacing: 0.02em;
    }
    .qa-status-badge.qa-status-failed { background: #ffdcda; color: #c22b22; }
    .qa-status-badge.qa-status-locked { background: #e4e4e8; color: #6e6e73; }

    .qa-card-row {
        display: flex; gap: 8px; margin-bottom: 6px;
        font-size: 13px; align-items: flex-start;
    }
    .qa-card-row:last-child { margin-bottom: 0; }
    .qa-card-label { color: var(--qa-text-secondary); min-width: 58px; font-weight: 500; padding-top: 5px; }
    .qa-card-value { color: var(--qa-text); word-break: break-word; flex: 1; }
    .qa-card-static { padding-top: 5px; }

    .qa-postid-link {
        color: var(--qa-blue); text-decoration: none; font-weight: 600;
    }
    .qa-postid-link:hover { text-decoration: underline; color: var(--qa-blue-hover); }

    .qa-edit-input {
        width: 100%; box-sizing: border-box; border: 1px solid transparent;
        border-radius: 7px; padding: 5px 7px; font-size: 13px; font-family: var(--qa-font);
        background: transparent; color: var(--qa-text); transition: all 0.15s ease;
    }
    .qa-edit-input:hover { background: var(--qa-bg); border-color: var(--qa-border); }
    .qa-edit-input:focus {
        outline: none; background: var(--qa-bg); border-color: var(--qa-blue);
        box-shadow: 0 0 0 3px rgba(0,113,227,0.15);
    }

    .qa-tag-chip {
        display: inline-block; background: #e8f0fe; color: var(--qa-blue);
        border-radius: 5px; padding: 1px 6px; font-size: 10.5px;
        margin: 2px 3px 0 0; font-weight: 500;
    }
    .qa-chip-preview { margin-top: 4px; }

    #qa-modal-footer {
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px 18px; border-top: 1px solid var(--qa-border);
        background: var(--qa-bg-secondary); flex-shrink: 0;
    }
    #qa-record-count { font-size: 12.5px; color: var(--qa-text-secondary); }
    #qa-copy-btn {
        background: var(--qa-blue); color: #fff; border: none; border-radius: 980px;
        padding: 8px 18px; font-size: 13px; font-weight: 600;
        cursor: pointer; transition: background 0.15s ease;
    }
    #qa-copy-btn:hover { background: var(--qa-blue-hover); }
    #qa-copy-btn.qa-copied { background: var(--qa-green); }

    #qa-toast {
        position: absolute; top: 12px; left: 50%; transform: translate(-50%, -20px);
        background: #1d1d1f; color: #fff; padding: 9px 16px; border-radius: 980px;
        font-size: 12.5px; font-weight: 500; box-shadow: 0 8px 24px rgba(0,0,0,0.25);
        opacity: 0; pointer-events: none; transition: all 0.25s ease; z-index: 100000000;
        max-width: 80%; text-align: center;
    }
    #qa-toast.qa-show { opacity: 1; transform: translate(-50%, 0); }

    #qa-run-panel { display: flex; flex-direction: column; height: 100%; gap: 12px; min-height: 0; }
    .qa-run-config {
        display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end;
        background: var(--qa-bg-secondary); border: 1px solid var(--qa-border);
        border-radius: 10px; padding: 12px 14px; flex-shrink: 0;
    }
    .qa-run-field { display: flex; flex-direction: column; gap: 4px; }
    .qa-run-field label { font-size: 11.5px; color: var(--qa-text-secondary); font-weight: 500; }
    .qa-run-field input {
        border: 1px solid var(--qa-border); border-radius: 7px; padding: 6px 9px;
        font-size: 12.5px; width: 80px; font-family: var(--qa-font);
    }
    .qa-run-buttons { display: flex; gap: 8px; margin-left: auto; }
    .qa-btn {
        border: none; border-radius: 980px; padding: 8px 18px; font-size: 13px;
        font-weight: 600; cursor: pointer; color: #fff; transition: all 0.15s ease;
    }
    .qa-btn:disabled { background: #c7c7cc !important; cursor: not-allowed; }
    .qa-btn-start { background: var(--qa-green); }
    .qa-btn-start:hover:not(:disabled) { background: var(--qa-green-hover); }
    .qa-btn-pause { background: var(--qa-yellow); }
    .qa-btn-pause:hover:not(:disabled) { background: #e69009; }
    .qa-btn-stop { background: var(--qa-red); }
    .qa-btn-stop:hover:not(:disabled) { background: #e0342b; }

    .qa-progress-wrap { display: flex; flex-direction: column; gap: 7px; flex-shrink: 0; }
    .qa-progress-track {
        width: 100%; height: 5px; background: #e8e8ed;
        border-radius: 999px; overflow: hidden;
    }
    .qa-progress-fill {
        height: 100%; width: 0%; border-radius: 999px;
        background: linear-gradient(90deg, var(--qa-blue), #5ac8fa);
        transition: width 0.4s cubic-bezier(0.2,0.8,0.2,1);
        background-size: 200% 100%; animation: qa-shimmer 2s linear infinite;
    }
    @keyframes qa-shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }
    .qa-progress-meta {
        display: flex; justify-content: space-between;
        font-size: 12.5px; color: var(--qa-text-secondary);
    }

    .qa-stat-row { display: flex; gap: 8px; flex-shrink: 0; }
    .qa-stat-chip {
        flex: 1; text-align: center; border-radius: 9px; padding: 9px;
        background: var(--qa-bg-secondary); border: 1px solid var(--qa-border);
    }
    .qa-stat-chip .qa-stat-num { font-size: 18px; font-weight: 700; color: var(--qa-text); display: block; }
    .qa-stat-chip .qa-stat-label { font-size: 10.5px; color: var(--qa-text-secondary); }
    .qa-stat-chip.qa-success .qa-stat-num { color: var(--qa-green); }
    .qa-stat-chip.qa-failed  .qa-stat-num { color: var(--qa-red); }

    .qa-run-banner {
        display: flex; align-items: center; gap: 10px; padding: 10px 14px;
        border-radius: 10px; font-size: 12.5px; flex-shrink: 0;
    }
    .qa-run-banner.qa-hidden { display: none; }
    .qa-banner-icon { font-size: 16px; flex-shrink: 0; }
    .qa-banner-text { flex: 1; line-height: 1.4; }
    .qa-banner-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .qa-banner-auth, .qa-banner-generic {
        background: #fdecea; border: 1px solid #f5c2c0; color: #86201b;
    }
    .qa-banner-success {
        background: #e7f8ec; border: 1px solid #b7ebc6; color: #166534;
    }

    #qa-run-views { flex: 1; min-height: 0; display: flex; flex-direction: column; }
    .qa-run-view { display: none; flex: 1; overflow-y: auto; }
    .qa-run-view.qa-active { display: block; }

    #qa-simple-feed { padding-right: 2px; }
    .qa-feed-card {
        border: 1px solid var(--qa-border); border-radius: 9px; padding: 7px 11px;
        margin-bottom: 6px; background: var(--qa-bg-secondary);
    }
    .qa-feed-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
    .qa-feed-num    { font-size: 10.5px; font-weight: 700; color: var(--qa-text-secondary); }
    .qa-feed-postid { font-size: 10.5px; color: var(--qa-text-secondary); }
    .qa-feed-overall {
        margin-left: auto; font-size: 10px; font-weight: 700;
        padding: 2px 7px; border-radius: 999px;
    }
    .qa-feed-overall.qa-ok   { background: #d3f5df; color: #0a7d33; }
    .qa-feed-overall.qa-fail { background: #ffe3b3; color: #8a5a00; }
    .qa-feed-body  { display: flex; flex-direction: column; gap: 5px; }
    .qa-feed-item  { display: flex; gap: 8px; align-items: flex-start; }
    .qa-feed-icon  { font-size: 12px; line-height: 1.4; flex-shrink: 0; }
    .qa-feed-text  { flex: 1; min-width: 0; }
    .qa-feed-title-text {
        font-size: 12px; color: var(--qa-text); font-weight: 500;
        word-break: break-word; line-height: 1.35;
    }
    .qa-feed-tags  { margin-bottom: 1px; line-height: 1.2; }
    .qa-feed-sub   { font-size: 10.5px; color: var(--qa-text-secondary); margin-top: 1px; }
    .qa-feed-sub-error { color: var(--qa-red); font-weight: 600; }

    #qa-log-console {
        background: #1d1d1f; color: #d1d1d6; border-radius: 10px;
        padding: 10px 12px; font-family: "SF Mono", Menlo, Consolas, monospace;
        font-size: 12px; line-height: 1.65; height: 100%; box-sizing: border-box;
    }
    .qa-log-line    { white-space: pre-wrap; word-break: break-word; }
    .qa-log-info    { color: #8e8e93; }
    .qa-log-success { color: #32d74b; }
    .qa-log-error   { color: #ff453a; }
    .qa-log-warn    { color: #ffd60a; }
    .qa-log-done    { color: #64d2ff; font-weight: 700; }

    /* ---- Hide Questions tab ---- */
    .qa-hide-locked {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        text-align: center; gap: 9px; padding: 60px 20px;
        color: var(--qa-text-secondary); flex: 1;
    }
    .qa-hide-locked.qa-hidden { display: none; }
    .qa-hide-locked-icon { font-size: 30px; }
    .qa-hide-locked-text { max-width: 420px; font-size: 13px; line-height: 1.5; }

    #qa-hide-form-wrap.qa-hidden { display: none; }
    .qa-hide-intro h3 { margin: 0 0 4px; font-size: 15px; font-weight: 700; color: var(--qa-text); }
    .qa-hide-intro p  { margin: 0 0 14px; font-size: 12px; color: var(--qa-text-secondary); line-height: 1.5; }
    .qa-hide-intro code {
        background: #ececee; padding: 1px 5px; border-radius: 5px;
        font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 11px;
    }

    .qa-hide-grid {
        display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 16px;
        background: var(--qa-bg-secondary); border: 1px solid var(--qa-border);
        border-radius: 10px; padding: 14px;
    }
    .qa-hide-grid .qa-field-stack { gap: 5px; }
    .qa-hide-grid .qa-field-stack label {
        font-size: 11px; text-transform: none; letter-spacing: 0;
        font-weight: 600; color: var(--qa-text);
    }
    .qa-hide-grid input, .qa-hide-grid select {
        border: 1px solid var(--qa-border); border-radius: 7px; padding: 6px 9px;
        font-size: 12.5px; font-family: var(--qa-font); min-width: 130px; box-sizing: border-box;
    }
    .qa-hide-grid select { min-width: 220px; }
    .qa-hide-checkbox-row {
        display: flex; align-items: center; gap: 6px; font-size: 12.5px;
        color: var(--qa-text); align-self: flex-end; height: 32px;
    }

    .qa-hide-actions { display: flex; justify-content: flex-end; margin-bottom: 14px; }
    #qa-hide-result { margin-top: 4px; }
    #qa-hide-result.qa-hidden { display: none; }

    /* v9: quiet surfaces, compact table, progressive disclosure. */
    #qa-modal-overlay { --qa-border:#e5e5ea; --qa-bg-secondary:#f5f5f7; --qa-text-secondary:#68686e;
        --qa-radius:20px; background:rgba(28,30,36,.28); backdrop-filter:blur(16px);
        -webkit-backdrop-filter:blur(16px); color:var(--qa-text); line-height:1.45; }
    #qa-modal-overlay *, #qa-modal-overlay *::before, #qa-modal-overlay *::after { box-sizing:border-box; }
    #qa-modal-overlay button, #qa-modal-overlay input, #qa-modal-overlay select, #qa-modal-overlay textarea { font-family:var(--qa-font); }
    #qa-modal-overlay button { text-transform:none; letter-spacing:normal; }
    #qa-modal-overlay button:focus-visible, #qa-modal-overlay summary:focus-visible, #qa-modal-overlay a:focus-visible { outline:3px solid #90bcf3; outline-offset:3px; }
    #qa-modal-overlay [hidden], #qa-modal-overlay .qa-hidden { display:none !important; }
    #qa-modal { width:min(1180px,96vw); height:min(880px,94vh); height:min(880px,94dvh);
        box-shadow:0 32px 100px #0003,0 0 0 1px #ffffff80; }
    #qa-modal-header { padding:22px 26px 16px; background:#fafafc; border:0; }
    #qa-modal-header h2 { font-size:21px; letter-spacing:-.55px; font-weight:650; }
    .qa-subtitle { margin:4px 0 0; color:var(--qa-text-secondary); font-size:12px; }
    #qa-modal-close { width:30px; height:30px; font-size:15px; flex-shrink:0; }
    .qa-header-version { font-size:10px; border:0; background:#eaeaf0; }
    #qa-tabs { background:#fafafc; padding:0 26px 18px; gap:4px; border-bottom:1px solid var(--qa-border); }
    .qa-tab-btn { border-radius:9px; padding:8px 17px; font-size:12px; }
    .qa-tab-btn.qa-active { background:white; color:var(--qa-text); box-shadow:0 1px 4px #00000012,0 0 0 1px #00000006; }
    #qa-toolbar { padding:12px 26px; background:#fff; gap:8px; }
    .qa-workspace-label { font-size:12px; font-weight:600; color:var(--qa-text-secondary); }
    #qa-toolbar-right { flex-wrap:wrap; }
    #qa-modal-overlay .qa-btn-sm { height:auto; min-height:32px; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:550; }
    #qa-modal-overlay .qa-secondary { color:#414148; background:#eeeef2; }
    #qa-modal-overlay .qa-secondary:hover { background:#e3e3e9; }
    #qa-modal-overlay .qa-btn-sm.qa-danger { color:#bf312a; background:#fff0ef; }
    #qa-modal-overlay button:disabled { opacity:.48; cursor:not-allowed; }
    #qa-modal-body { padding:20px 26px; min-height:0; background:#fff; scrollbar-gutter:stable; }
    [data-panel="visual"] { height:auto; min-height:100%; }
    .qa-sequence-bar { display:grid; grid-template-columns:1fr 1fr; gap:0; border:1px solid var(--qa-border);
        border-radius:14px; background:#f7f7f9; margin-bottom:10px; flex-shrink:0; }
    .qa-switch-row { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px 18px; cursor:pointer; }
    .qa-switch-row + .qa-switch-row { border-left:1px solid var(--qa-border); }
    .qa-switch-copy { display:flex; flex-direction:column; gap:3px; }
    .qa-switch-copy strong { font-size:13px; font-weight:600; }
    .qa-switch-copy small { font-size:11px; color:var(--qa-text-secondary); }
    #qa-modal-overlay .qa-switch { appearance:none; -webkit-appearance:none; position:relative; width:38px; height:23px; min-width:38px;
        border:0; border-radius:20px; background:#d7d7dc; padding:0; margin:0; cursor:pointer; transition:background .18s ease; }
    #qa-modal-overlay .qa-switch::before { content:''; position:absolute; width:19px; height:19px; left:2px; top:2px;
        border-radius:50%; background:#fff; box-shadow:0 1px 3px #0003; transition:transform .18s ease; }
    #qa-modal-overlay .qa-switch:checked { background:#34c759; }
    #qa-modal-overlay .qa-switch:checked::before { transform:translateX(15px); }
    #qa-modal-overlay .qa-switch:focus-visible { outline:3px solid #90bcf3; outline-offset:3px; }
    .qa-sequence-note { min-height:18px; font-size:11px; color:var(--qa-text-secondary); margin:0 2px 15px; }
    .qa-advanced { margin-bottom:18px; border-bottom:1px solid var(--qa-border); padding-bottom:12px; }
    #qa-modal-overlay summary { cursor:pointer; user-select:none; }
    .qa-advanced > summary { font-size:12px; font-weight:600; color:#4c4c54; padding:3px 0; }
    .qa-tools-grid { display:grid; gap:10px; margin-top:12px; }
    .qa-tool-section { border:1px solid var(--qa-border); border-radius:10px; padding:10px 13px; background:#fafafc; }
    .qa-tool-section > summary { font-size:12px; font-weight:550; }
    .qa-toolbar-group { border:0; background:transparent; padding:12px 0 2px; gap:10px; align-items:flex-end; }
    .qa-field-stack { gap:5px; }
    .qa-field-stack label { font-size:10px; text-transform:none; letter-spacing:0; }
    #qa-modal-overlay .qa-toolbar-group input[type="text"], #qa-modal-overlay .qa-toolbar-group input[type="number"],
    #qa-modal-overlay .qa-toolbar-group select { border:1px solid #d9d9df; border-radius:7px; padding:6px 8px; font-size:12px; background:white; color:var(--qa-text); min-height:32px; }
    .qa-toolbar-group input[type="number"] { width:72px; }
    .qa-toolbar-group input[type="text"] { width:150px; }
    #qa-modal-overlay .qa-checkbox-wrap { height:32px; }
    .qa-table-wrap { border:1px solid var(--qa-border); border-radius:12px; overflow:auto; }
    .qa-data-table { border-collapse:separate; border-spacing:0; table-layout:fixed; width:100%; margin:0; font-size:12px; background:white; }
    .qa-data-table caption { text-align:left; padding:13px 15px; font-size:12px; font-weight:600; }
    .qa-data-table th { text-align:left; padding:10px 12px; font-size:10px; font-weight:600; color:#77777e; background:#f7f7f9; border-bottom:1px solid var(--qa-border); }
    .qa-data-table .qa-card { border:0; border-radius:0; background:white; box-shadow:none; }
    .qa-data-table td { padding:12px; vertical-align:top; border-bottom:1px solid #eeeef2; }
    .qa-data-table tr:last-child td { border-bottom:0; }
    .qa-data-table .qa-card:hover { background:#fafafd; box-shadow:none; }
    .qa-data-table .qa-card.qa-flash { background:#edf5ff; }
    .qa-data-table .qa-card.qa-card-failed { background:#fff6f5; }
    .qa-data-table .qa-card.qa-card-locked { background:#fafafa; }
    .qa-data-table .qa-status-badge { display:inline-block; margin-top:6px; font-size:8px; padding:2px 5px; }
    .qa-data-table .qa-card-index { line-height:30px; font-size:11px; font-variant-numeric:tabular-nums; }
    .qa-data-table .qa-postid-link { display:block; padding-top:5px; font-size:12px; font-variant-numeric:tabular-nums; }
    .qa-data-table .qa-edit-input { font-size:12px; line-height:1.55; padding:4px 6px; min-height:29px; }
    .qa-data-table textarea.qa-edit-input { resize:vertical; height:40px; min-height:36px; max-height:180px; display:block; }
    .qa-tag-details > summary { padding-top:5px; color:var(--qa-text-secondary); font-size:11px; }
    .qa-tag-details[open] > summary { margin-bottom:7px; }
    .qa-tag-details .qa-chip-preview { max-height:130px; overflow:auto; }
    .qa-tag-chip { background:#eeeef5; color:#646476; font-size:9px; font-weight:400; overflow-wrap:anywhere; }
    #qa-modal-footer { padding:14px 26px; background:#fafafc; gap:10px; }
    #qa-copy-btn, .qa-btn { border-radius:9px; font-size:12px; padding:9px 17px; }
    .qa-footer-actions { display:flex; gap:8px; align-items:center; }
    #qa-record-count { font-size:11px; }
    #qa-toast { border-radius:12px; top:16px; font-size:12px; }
    .qa-run-config, .qa-renumber-panel, .qa-hide-grid { border-radius:14px; background:#f7f7f9; padding:18px; }
    .qa-run-config { gap:16px; }
    .qa-run-buttons { flex-wrap:wrap; }
    .qa-btn-start { background:var(--qa-blue); }
    .qa-btn-start:hover:not(:disabled) { background:var(--qa-blue-hover); }
    .qa-btn-pause { color:#79520a; background:#fff1d0; }
    .qa-btn-stop { color:#bf312a; background:#ffebe9; }
    .qa-stat-chip { padding:16px; border:0; background:#f5f5f7; }
    .qa-stat-chip .qa-stat-num { font-size:26px; letter-spacing:-1px; font-weight:600; }
    .qa-progress-fill { animation:none; background:var(--qa-blue); }
    .qa-run-banner { flex-wrap:wrap; }
    #qa-extract-fab { border-radius:14px; padding:13px 19px; background:#242428; font-size:13px; box-shadow:0 5px 20px #0003; }
    @media(max-width:720px) {
        #qa-modal { width:100%; height:100dvh; max-height:100%; border-radius:0; }
        #qa-modal-header { padding:18px 16px 14px; }
        #qa-modal-header h2 { font-size:19px; }
        #qa-tabs { padding:0 16px 14px; gap:2px; }
        .qa-tab-btn { padding:8px 11px; }
        #qa-toolbar, #qa-modal-footer { padding:12px 16px; }
        #qa-modal-body { padding:16px; }
        .qa-workspace-label { display:none; }
        #qa-toolbar-right { margin-left:0; }
        .qa-sequence-bar { grid-template-columns:1fr; }
        .qa-switch-row { padding:13px 15px; }
        .qa-switch-row + .qa-switch-row { border-left:0; border-top:1px solid var(--qa-border); }
        .qa-data-table { min-width:670px; }
        #qa-record-count { max-width:110px; }
        .qa-run-buttons { margin-left:0; }
        .qa-hide-grid select { min-width:0; max-width:100%; }
    }
    @media(prefers-reduced-motion:reduce) {
        #qa-modal-overlay, #qa-modal-overlay *, #qa-extract-fab { animation:none !important; transition:none !important; scroll-behavior:auto !important; }
    }
    `;

    function injectStyle() {
        const style = document.createElement('style');
        style.textContent = STYLE;
        document.head.appendChild(style);
    }

    /* ============================================================
       UTILITIES
    ============================================================ */
    function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
    function randomBetween(min, max) { return Math.random() * (max - min) + min; }
    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    function escapeAttr(str) {
        return escapeHtml(str).replace(/"/g, '&quot;');
    }
    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

    async function interruptibleSleep(ms) {
        const step = 200;
        let elapsed = 0;
        while (elapsed < ms) {
            if (state.stopRequested) return;
            while (state.isPaused) {
                await sleep(200);
                if (state.stopRequested) return;
            }
            const chunk = Math.min(step, ms - elapsed);
            await sleep(chunk);
            elapsed += chunk;
        }
    }

    function computeStats() {
        const total = state.working.length;
        let success = 0, failed = 0;
        for (let i = 0; i < total; i++) {
            if (state.itemStatus[i] === 'success') success++;
            else if (state.itemStatus[i] === 'failed') failed++;
        }
        return { total, success, failed, remaining: total - success - failed };
    }

    /* Builds the direct post URL for a given postID (used for the clickable Post ID link). */
    function buildPostUrl(postID) {
        return `https://gateoverflow.in/${encodeURIComponent(postID)}`;
    }

    /* ============================================================
       SMART RENUMBER — pattern detection & helpers
    ============================================================ */
    function longestCommonPrefix(strings) {
        if (!strings.length) return '';
        let prefix = strings[0];
        for (let i = 1; i < strings.length; i++) {
            const s = strings[i];
            let j = 0;
            const maxLen = Math.min(prefix.length, s.length);
            while (j < maxLen && prefix[j] === s[j]) j++;
            prefix = prefix.slice(0, j);
            if (!prefix) break;
        }
        return prefix;
    }

    function longestCommonSuffix(strings) {
        if (!strings.length) return '';
        let suffix = strings[0];
        for (let i = 1; i < strings.length; i++) {
            const s = strings[i];
            let j = 0;
            const maxLen = Math.min(suffix.length, s.length);
            while (j < maxLen && suffix[suffix.length - 1 - j] === s[s.length - 1 - j]) j++;
            suffix = suffix.slice(suffix.length - j);
            if (!suffix) break;
        }
        return suffix;
    }

    /* Flexible-prefix detector: matches "...: <digits><optional trailing punctuation>"
       at the very end of the title. The text before the colon+number may differ
       freely between titles — only the trailing suffix (after the number) must match. */
    function detectColonNumberingPattern(titles) {
        const re = /^(.*:\s*)(\d+)(\D*)$/;
        const matches = titles.map(t => t.match(re));

        if (!matches.every(Boolean)) {
            return { success: false, reason: 'Not all titles end with a ": <number>" pattern.' };
        }

        const suffixes = matches.map(m => m[3]);
        const commonSuffix = suffixes.every(s => s === suffixes[0]) ? suffixes[0] : null;
        if (commonSuffix === null) {
            return { success: false, reason: 'The text after the number is inconsistent between titles.' };
        }

        const numStrs = matches.map(m => m[2]);
        const padWidth = Math.max(...numStrs.map(n => n.length));
        const hasLeadingZero = numStrs.some(n => n.length > 1 && n[0] === '0');
        const perItemPrefix = matches.map(m => m[1]);

        return {
            success: true,
            mode: 'colon',
            perItemPrefix,
            suffix: commonSuffix,
            padWidth,
            hasLeadingZero,
        };
    }

    /* Detects a "<static prefix><NUMBER><static suffix>" pattern across a list of titles.
       Tries the flexible colon-based pattern first (recommended for "...: N" style titles),
       then falls back to the original identical-prefix/suffix detection. */
    function detectNumberingPattern(titles) {
        if (!titles.length) return { success: false, reason: 'No titles to analyze.' };

        const colonResult = detectColonNumberingPattern(titles);
        if (colonResult.success) return colonResult;

        if (titles.length === 1) {
            const m = titles[0].match(/^(.*?)(\d+)(\D*)$/);
            if (!m) return { success: false, reason: colonResult.reason || 'No number found in the title.' };
            return {
                success: true,
                mode: 'common',
                prefix: m[1],
                suffix: m[3],
                padWidth: m[2].length,
                hasLeadingZero: m[2].length > 1 && m[2][0] === '0',
            };
        }

        let prefix = longestCommonPrefix(titles);
        let suffix = longestCommonSuffix(titles);

        const minLen = Math.min(...titles.map(t => t.length));
        if (prefix.length + suffix.length > minLen) {
            const allowedSuffixLen = Math.max(0, minLen - prefix.length);
            suffix = suffix.slice(suffix.length - allowedSuffixLen);
        }

        const middles = titles.map(t => t.slice(prefix.length, t.length - suffix.length));

        if (middles.every(m => m.length === 0)) {
            return { success: false, reason: 'No varying number segment detected — titles appear identical.' };
        }
        if (!middles.every(m => /^\d+$/.test(m))) {
            return { success: false, reason: colonResult.reason || "Titles don't share a consistent numbering pattern — something other than the number differs between them." };
        }

        const padWidth = Math.max(...middles.map(m => m.length));
        const hasLeadingZero = middles.some(m => m.length > 1 && m[0] === '0');

        return { success: true, mode: 'common', prefix, suffix, padWidth, hasLeadingZero };
    }

    function formatNumber(num, padWidth) {
        const str = String(num);
        if (padWidth > 0 && str.length < padWidth) return str.padStart(padWidth, '0');
        return str;
    }

    function extractMiddle(title, prefix, suffix) {
        if (title.length < prefix.length + suffix.length) return title;
        return title.slice(prefix.length, title.length - suffix.length);
    }

    function truncateMiddle(str, maxLen) {
        if (!str) return str;
        if (str.length <= maxLen) return str;
        const keep = Math.floor((maxLen - 3) / 2);
        return str.slice(0, keep) + '...' + str.slice(str.length - keep);
    }

    function ensureRenumberBaseline(forceRecapture) {
        if (!forceRecapture && state.renumberBaseline) return state.renumberBaseline;

        const titles = state.working.map(i => i.questionTitle);
        const detection = detectNumberingPattern(titles);

        if (detection.success) {
            state.renumberBaseline = detection.mode === 'colon'
                ? {
                    mode: 'colon',
                    perItemPrefix: detection.perItemPrefix,
                    suffix: detection.suffix,
                    defaultPad: detection.hasLeadingZero ? detection.padWidth : 0,
                    originalTitles: titles.slice(),
                }
                : {
                    mode: 'common',
                    prefix: detection.prefix,
                    suffix: detection.suffix,
                    defaultPad: detection.hasLeadingZero ? detection.padWidth : 0,
                    originalTitles: titles.slice(),
                };
            state.renumberDetectionFailReason = null;
        } else {
            state.renumberBaseline = null;
            state.renumberDetectionFailReason = detection.reason;
        }
        return state.renumberBaseline;
    }

    /* Scans items OUTSIDE the current working slice for the same pattern,
       returns (highest existing number found) + 1, or 1 if none found. */
    function suggestSmartStart(baseline) {
        const workingIds = new Set(state.working.map(i => i.postID));
        const others = state.original.filter(i => !workingIds.has(i.postID));
        let maxNum = 0, found = false;

        if (baseline.mode === 'colon') {
            const re = new RegExp(':\\s*(\\d+)' + escapeRegExp(baseline.suffix) + '$');
            others.forEach(item => {
                const m = (item.questionTitle || '').match(re);
                if (m) { found = true; maxNum = Math.max(maxNum, parseInt(m[1], 10)); }
            });
        } else {
            const { prefix, suffix } = baseline;
            others.forEach(item => {
                const t = item.questionTitle || '';
                if (t.length >= prefix.length + suffix.length && t.startsWith(prefix) && t.endsWith(suffix)) {
                    const mid = extractMiddle(t, prefix, suffix);
                    if (/^\d+$/.test(mid)) { found = true; maxNum = Math.max(maxNum, parseInt(mid, 10)); }
                }
            });
        }

        return found ? maxNum + 1 : 1;
    }

    /* Checks whether applying the numbering for the current slice would recreate
       a title that already exists elsewhere in the original data. */
    function checkRenumberCollisions(baseline, padWidth, start) {
        const workingIds = new Set(state.working.map(i => i.postID));
        const others = state.original.filter(i => !workingIds.has(i.postID));
        const conflicts = [];

        state.working.forEach((item, idx) => {
            const newTitle = baseline.mode === 'colon'
                ? baseline.perItemPrefix[idx] + formatNumber(start + idx, padWidth) + baseline.suffix
                : baseline.prefix + formatNumber(start + idx, padWidth) + baseline.suffix;
            const collidesWith = others.find(o => o.questionTitle === newTitle);
            if (collidesWith) conflicts.push({ idx, newTitle, collidesWith });
        });

        return conflicts;
    }

    function applyRenumbering(startVal, padWidth) {
        if (!state.renumberBaseline) return;
        const baseline = state.renumberBaseline;

        pushHistory();
        commitSequenceTitles();
        state.hasCompletedRun = false;
        state.working.forEach((item, idx) => {
            if (state.lockNonFailed && state.itemStatus[idx] === 'success') return;
            item.questionTitle = baseline.mode === 'colon'
                ? baseline.perItemPrefix[idx] + formatNumber(startVal + idx, padWidth) + baseline.suffix
                : baseline.prefix + formatNumber(startVal + idx, padWidth) + baseline.suffix;
            if (state.itemStatus[idx] === 'success') delete state.itemStatus[idx];
        });
    }

    function revertRenumbering() {
        if (!state.renumberBaseline) return;
        pushHistory();
        commitSequenceTitles();
        state.hasCompletedRun = false;
        state.working.forEach((item, idx) => {
            if (state.lockNonFailed && state.itemStatus[idx] === 'success') return;
            if (state.itemStatus[idx] === 'success') delete state.itemStatus[idx];
            item.questionTitle = state.renumberBaseline.originalTitles[idx];
        });
    }

    function resetRenumberState(hidePanel) {
        state.renumberBaseline = null;
        state.renumberDetectionFailReason = null;
        state.renumberCurrentStart = null;
        state.renumberCurrentPad = null;
        if (overlayEl) {
            const panel = q('#qa-renumber-panel');
            if (panel && hidePanel) panel.classList.add('qa-hidden');
        }
    }

    /* ============================================================
       TAG SEARCH (on the quickedit page itself)
    ============================================================ */
    function initTagSearch() {
        const select = document.getElementById('tag_selector');
        if (!select) return;

        const searchBox = document.createElement('input');
        searchBox.type = 'text';
        searchBox.id = 'qa-tag-search';
        searchBox.placeholder = 'Search tags...';
        select.parentNode.insertBefore(searchBox, select);

        const options = Array.from(select.options);

        searchBox.addEventListener('input', function () {
            const query = this.value.trim().toLowerCase();
            options.forEach(opt => {
                opt.style.display = opt.textContent.toLowerCase().includes(query) ? '' : 'none';
            });
        });

        searchBox.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const first = options.find(o => o.style.display !== 'none' && o.value !== '');
                if (first) first.selected = true;
            }
        });
    }

    /* ============================================================
       TABLE EXTRACTOR
    ============================================================ */
    function extractData() {
        const table = document.getElementById('quickedittable');
        const list = [];
        if (!table) return list;

        for (let i = 1; i < table.rows.length; i++) {
            try {
                const cells = table.rows[i].cells;
                const postID        = cells[1].innerText.trim();

                const answer = cells[2]?.querySelector('input, textarea')?.value || '';
                const titleInput = cells[3]?.querySelector('input, textarea');
                const tagInput = cells[5]?.querySelector('input, textarea');
                if (!titleInput || !tagInput) throw new Error('Missing title or tag input');
                const questionTitle = titleInput.value;
                const tag = tagInput.value;
                list.push({ postID, answer, questionTitle, tag });
            } catch (e) {
                console.warn('Skipping row', i, e);
            }
        }
        return list;
    }

    /* ============================================================
       CARD RENDERING
    ============================================================ */
    function renderTagChips(tagString) {
        const tags = (tagString || '').split(',').map(t => t.trim()).filter(Boolean);
        if (!tags.length) return `<span style="color:var(--qa-text-secondary);font-size:11px;">no tags</span>`;
        return tags.map(t => `<span class="qa-tag-chip">${escapeHtml(t)}</span>`).join('');
    }

    function renderCards() {
        if (!state.working.length) return '<p class="qa-subtitle">No records yet. Extract a table or import JSON to begin.</p>';
        return `<div class="qa-table-wrap"><table class="qa-data-table">
            <caption>Questions <span class="qa-subtitle">· Click a title or answer to edit</span></caption>
            <colgroup><col style="width:42px"><col style="width:100px"><col><col style="width:80px"><col style="width:160px"></colgroup>
            <thead><tr><th scope="col">#</th><th scope="col">Post ID</th><th scope="col">Question title</th><th scope="col">Answer</th><th scope="col">Tags</th></tr></thead>
            <tbody>${state.working.map((item, idx) => {
                const status = state.itemStatus[idx];
                const locked = state.lockNonFailed && status === 'success';
                const disabled = locked || state.isRunning ? 'disabled' : '';
                const tags = (item.tag || '').split(',').map(t => t.trim()).filter(Boolean);
                const badge = status === 'failed' ? '<span class="qa-status-badge qa-status-failed">Failed</span>'
                    : locked ? '<span class="qa-status-badge qa-status-locked">Locked</span>' : '';
                return `<tr class="qa-card ${status === 'failed' ? 'qa-card-failed' : ''} ${locked ? 'qa-card-locked' : ''}" data-idx="${idx}">
                    <td><span class="qa-card-index">${idx + 1}</span></td>
                    <td><a class="qa-postid-link" href="${escapeAttr(buildPostUrl(item.postID))}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.postID)}</a>${badge}</td>
                    <td><textarea class="qa-edit-input" data-field="questionTitle" data-idx="${idx}" aria-label="Title for post ${escapeAttr(item.postID)}" rows="2" ${disabled}>${escapeHtml(item.questionTitle)}</textarea></td>
                    <td><input class="qa-edit-input" type="text" data-field="answer" data-idx="${idx}" aria-label="Answer for post ${escapeAttr(item.postID)}" placeholder="—" value="${escapeAttr(item.answer || '')}" ${disabled}></td>
                    <td><details class="qa-tag-details"><summary>${tags.length} tag${tags.length === 1 ? '' : 's'}</summary>
                        <input class="qa-edit-input" type="text" data-field="tag" data-idx="${idx}" aria-label="Tags for post ${escapeAttr(item.postID)}" value="${escapeAttr(item.tag)}" ${disabled}>
                        <div class="qa-chip-preview" data-chip-preview="${idx}">${renderTagChips(item.tag)}</div>
                    </details></td>
                </tr>`;
            }).join('')}</tbody></table></div>`;
    }

    /* ============================================================
       MODAL BUILD
    ============================================================ */
    function buildModal() {
        const overlay = document.createElement('div');
        overlay.id = 'qa-modal-overlay';
        overlay.innerHTML = `
            <div id="qa-modal" role="dialog" aria-modal="true" aria-labelledby="qa-modal-title" tabindex="-1">
                <div id="qa-toast" role="status" aria-live="polite"></div>

                <div id="qa-modal-header">
                    <div><h2 id="qa-modal-title">Quickedit <span class="qa-header-version">v${TOOLKIT_VERSION}</span></h2><p class="qa-subtitle">Review, organize, and update your questions.</p></div>
                    <button id="qa-modal-close" title="Close" aria-label="Close Quickedit">&#10005;</button>
                </div>

                <div id="qa-tabs">
                    <button class="qa-tab-btn qa-active" data-tab="visual">Questions</button>
                    <button class="qa-tab-btn" data-tab="run">Run Updates</button>
                    <button class="qa-tab-btn" data-tab="hide" id="qa-tab-hide-btn">Hide Questions</button>
                </div>

                <div id="qa-toolbar">
                    <span class="qa-workspace-label">Your workspace</span>
                    <div id="qa-toolbar-right">
                        <button class="qa-btn-sm qa-secondary" id="qa-upload-json-btn">Import JSON</button>
                        <input type="file" id="qa-upload-json-file" accept="application/json,.json" style="display:none">
                        <button class="qa-btn-sm qa-secondary" id="qa-undo-btn">Undo</button>
                        <button class="qa-btn-sm qa-secondary" id="qa-reset-data">Reset</button>
                    </div>
                </div>

                <div id="qa-modal-body">
                    <div class="qa-tab-panel qa-active" data-panel="visual">
                        <div class="qa-sequence-bar">
                            <label class="qa-switch-row" for="qa-sort-postid">
                                <span class="qa-switch-copy"><strong>Sort by Post ID</strong><small>Lowest to highest</small></span>
                                <input class="qa-switch" type="checkbox" role="switch" id="qa-sort-postid" aria-describedby="qa-sequence-note">
                            </label>
                            <label class="qa-switch-row" for="qa-sequence-titles">
                                <span class="qa-switch-copy"><strong>Number titles from 1</strong><small>Follow the current row order</small></span>
                                <input class="qa-switch" type="checkbox" role="switch" id="qa-sequence-titles" aria-describedby="qa-sequence-note">
                            </label>
                        </div>
                        <p id="qa-sequence-note" class="qa-sequence-note" aria-live="polite"></p>
                        <details class="qa-advanced"><summary>Editing tools</summary><div class="qa-tools-grid"><details class="qa-tool-section"><summary>Find &amp; replace</summary><div class="qa-toolbar-group">
                        <div class="qa-field-stack">
                            <label>Field</label>
                            <select id="qa-fr-field">
                                <option value="questionTitle">Title</option>
                                <option value="tag">Tag</option>
                                <option value="answer">Answer</option>
                                <option value="both">Both (Title+Tag)</option>
                            </select>
                        </div>
                        <div class="qa-field-stack">
                            <label>Find</label>
                            <input type="text" id="qa-fr-find" placeholder="text to find">
                        </div>
                        <div class="qa-field-stack">
                            <label>Replace</label>
                            <input type="text" id="qa-fr-replace" placeholder="replacement">
                        </div>
                        <div class="qa-field-stack">
                            <label>Start # (optional)</label>
                            <input type="number" id="qa-fr-startnum" placeholder="1" style="width:55px;">
                        </div>
                        <div class="qa-checkbox-wrap">
                            <input type="checkbox" id="qa-fr-regex"> Regex
                        </div>
                        <div class="qa-field-stack">
                            <label>Matches</label>
                            <span id="qa-fr-count">0</span>
                        </div>
                        <button class="qa-btn-sm" id="qa-fr-apply">Replace All</button>
                    </div>

</details><details class="qa-tool-section"><summary>Range &amp; Smart Renumber</summary><div class="qa-toolbar-group">
                        <div class="qa-field-stack">
                            <label>Range From</label>
                            <input type="number" id="qa-range-from" min="1" value="1">
                        </div>
                        <div class="qa-field-stack">
                            <label>To</label>
                            <input type="number" id="qa-range-to" min="1">
                        </div>
                        <button class="qa-btn-sm" id="qa-range-apply">Apply</button>
                        <button class="qa-btn-sm qa-secondary" id="qa-renumber-open">Smart Renumber</button>
                        <button class="qa-btn-sm qa-secondary" id="qa-reextract">Extract table again</button>
                    </div>

</details><details class="qa-tool-section"><summary>Bulk tags</summary><div class="qa-toolbar-group">
                        <div class="qa-field-stack">
                            <label>Bulk Tag</label>
                            <input type="text" id="qa-bulk-tag" placeholder="tag-name">
                        </div>
                        <button class="qa-btn-sm" id="qa-bulk-add">+ Add to All</button>
                        <button class="qa-btn-sm qa-danger" id="qa-bulk-remove">− Remove from All</button>
                    </div>

</details></div></details>

                        <div id="qa-renumber-panel" class="qa-renumber-panel qa-hidden">
                            <div class="qa-renumber-header">
                                <strong>Smart Renumber</strong>
                                <div class="qa-renumber-header-actions">
                                    <button class="qa-btn-sm qa-secondary" id="qa-renumber-redetect">Detect again</button>
                                    <button class="qa-btn-sm qa-secondary" id="qa-renumber-close">Close</button>
                                </div>
                            </div>
                            <div id="qa-renumber-body"></div>
                        </div>

                        <div id="qa-lock-bar" class="qa-lock-bar qa-hidden"></div>
                        <div id="qa-cards-container"></div>
                    </div>

                    <div class="qa-tab-panel" data-panel="run">
                        <div id="qa-run-panel">
                            <div class="qa-run-config">
                                <div class="qa-run-field">
                                    <label>Min Delay (sec)</label>
                                    <input type="number" id="qa-min-delay" value="10" min="0">
                                </div>
                                <div class="qa-run-field">
                                    <label>Max Delay (sec)</label>
                                    <input type="number" id="qa-max-delay" value="15" min="0">
                                </div>
                                <button class="qa-btn-sm qa-secondary" id="qa-view-toggle">Technical Log</button>
                                <div class="qa-run-buttons">
                                    <button class="qa-btn qa-btn-start" id="qa-run-start">Start</button>
                                    <button class="qa-btn qa-btn-pause" id="qa-run-pause" disabled>Pause</button>
                                    <button class="qa-btn qa-btn-stop"  id="qa-run-stop"  disabled>Stop</button>
                                </div>
                            </div>

                            <div id="qa-run-banner" class="qa-run-banner qa-hidden"></div>

                            <div class="qa-progress-wrap">
                                <div class="qa-progress-track">
                                    <div class="qa-progress-fill" id="qa-progress-fill"></div>
                                </div>
                                <div class="qa-progress-meta">
                                    <span id="qa-progress-text">0 / 0 (0%)</span>
                                    <span id="qa-progress-status">Idle</span>
                                </div>
                                <div class="qa-progress-meta" style="justify-content: center; font-size: 11.5px; margin-top: 1px;">
                                    <span id="qa-progress-eta"></span>
                                </div>
                                <div class="qa-progress-meta" style="justify-content: center; font-size: 11px; color: #d97706; text-align: center; margin-top: 1px;">
                                    <span>⚠️ Keep this tab open and in focus to prevent the browser from suspending and slowing down the run.</span>
                                </div>
                            </div>

                            <div class="qa-stat-row">
                                <div class="qa-stat-chip qa-success">
                                    <span class="qa-stat-num" id="qa-stat-success">0</span>
                                    <span class="qa-stat-label">Succeeded</span>
                                </div>
                                <div class="qa-stat-chip qa-failed">
                                    <span class="qa-stat-num" id="qa-stat-failed">0</span>
                                    <span class="qa-stat-label">Failed</span>
                                </div>
                                <div class="qa-stat-chip">
                                    <span class="qa-stat-num" id="qa-stat-remaining">0</span>
                                    <span class="qa-stat-label">Remaining</span>
                                </div>
                            </div>

                            <div id="qa-run-views">
                                <div id="qa-simple-feed" class="qa-run-view qa-active"></div>
                                <div id="qa-log-console" class="qa-run-view"></div>
                            </div>
                        </div>
                    </div>

                    <div class="qa-tab-panel" data-panel="hide">
                        <div id="qa-hide-locked-msg" class="qa-hide-locked">
                            <div class="qa-hide-locked-icon">🔒</div>
                            <div class="qa-hide-locked-text">
                                Complete a full update run in the <strong>Run Updates</strong> tab first.
                                Once done, you can hide the questions you just added/updated from public view.
                            </div>
                        </div>

                        <div id="qa-hide-form-wrap" class="qa-hidden">
                            <div class="qa-hide-intro">
                                <h3>Hide Updated Questions</h3>
                                <p>
                                    Hide updated questions using a shared tag. Choose the tag and number of questions below.
                                </p>
                            </div>

                            <div class="qa-hide-grid">
                                <div class="qa-field-stack">
                                    <label>Title (optional)</label>
                                    <input type="text" id="qa-hide-title" placeholder="">
                                </div>
                                <div class="qa-field-stack">
                                    <label>Tag Name *</label>
                                    <select id="qa-hide-tagname"></select>
                                </div>
                                <div class="qa-field-stack">
                                    <label>Category</label>
                                    <input type="number" id="qa-hide-category" value="0">
                                </div>
                                <div class="qa-field-stack">
                                    <label>Tag (id)</label>
                                    <input type="number" id="qa-hide-tag" value="0">
                                </div>
                                <div class="qa-field-stack">
                                    <label>User ID *</label>
                                    <input type="text" id="qa-hide-userid" value="181161" placeholder="e.g. 181161">
                                </div>
                                <div class="qa-field-stack">
                                    <label>Count *</label>
                                    <input type="number" id="qa-hide-count" min="1">
                                </div>
                                <div class="qa-field-stack">
                                    <label>Start</label>
                                    <input type="number" id="qa-hide-start" min="1" value="1">
                                </div>
                                <div class="qa-hide-checkbox-row">
                                    <input type="checkbox" id="qa-hide-onlyhideqns" checked>
                                    Only hide questions (recommended)
                                </div>
                                <div class="qa-hide-checkbox-row">
                                    <input type="checkbox" id="qa-hide-hideqns" checked>
                                    Hide question in Q&A
                                </div>
                            </div>

                            <div class="qa-hide-actions">
                                <button class="qa-btn qa-btn-start" id="qa-hide-send">🙈 Hide Questions</button>
                            </div>

                            <div id="qa-hide-result" class="qa-run-banner qa-hidden"></div>
                        </div>
                    </div>
                </div>

                <div id="qa-modal-footer">
                    <span id="qa-record-count"></span>
                    <div class="qa-footer-actions"><button class="qa-btn-sm qa-secondary" id="qa-download-json">Download JSON</button><button id="qa-copy-btn">Copy JSON</button></div>
                </div>
            </div>
        `;
        overlay.querySelectorAll('.qa-field-stack, .qa-run-field').forEach(group => {
            const label = group.querySelector('label'), input = group.querySelector('input[id], select[id]');
            if (label && input) label.htmlFor = input.id;
        });
        document.body.appendChild(overlay);
        return overlay;
    }

    /* ============================================================
       MODAL LOGIC
    ============================================================ */
    let overlayEl = null;

    function q(sel) { return overlayEl.querySelector(sel); }

    function rowMeta(item) {
        if (!state.rowMeta.has(item)) state.rowMeta.set(item, { order: state.nextRowOrder++ });
        return state.rowMeta.get(item);
    }

    function resetSequenceState() {
        state.sortByPostID = false;
        state.sequenceTitles = false;
        state.rowMeta = new WeakMap();
        state.nextRowOrder = 0;
        state.working.forEach(rowMeta);
    }

    function pushHistory() {
        state.history.push(deepClone({
            working: state.working, meta: state.working.map(rowMeta), itemStatus: state.itemStatus,
            sortByPostID: state.sortByPostID, sequenceTitles: state.sequenceTitles,
            nextRowOrder: state.nextRowOrder, lockNonFailed: state.lockNonFailed,
            renumberBaseline: state.renumberBaseline, renumberCurrentStart: state.renumberCurrentStart,
            renumberCurrentPad: state.renumberCurrentPad,
        }));
        if (state.history.length > 25) state.history.shift();
    }

    function restoreHistory() {
        const snapshot = state.history.pop();
        if (!snapshot) return;
        // Undo is local. A previously saved server revision cannot be undone here.
        const current = new Map(state.working.map((item, i) => [rowMeta(item).order,
            { json: JSON.stringify(item), status: state.itemStatus[i] }]));
        state.working = snapshot.working;
        state.rowMeta = new WeakMap();
        state.working.forEach((item, i) => state.rowMeta.set(item, snapshot.meta[i]));
        state.itemStatus = {};
        state.working.forEach((item, i) => {
            const before = current.get(snapshot.meta[i].order);
            if (before?.json === JSON.stringify(item) && before.status) state.itemStatus[i] = before.status;
        });
        for (const key of ['sortByPostID', 'sequenceTitles', 'nextRowOrder', 'lockNonFailed',
            'renumberBaseline', 'renumberCurrentStart', 'renumberCurrentPad']) state[key] = snapshot[key];
        state.hasCompletedRun = false;
    }

    function markTitleChanged(item, idx, title) {
        if (item.questionTitle === title) return;
        item.questionTitle = title;
        if (state.itemStatus[idx] === 'success') delete state.itemStatus[idx];
        state.hasCompletedRun = false;
    }

    // Only the final colon-number is replaced. Test numbers in the prefix stay intact.
    const TITLE_SEQUENCE_PATTERN = /^(.*:\s*)(\d+)(\s*[.)\]]?\s*)$/;

    function syncSequenceTitles() {
        if (!state.sequenceTitles) return;
        const candidates = state.working.map(item => {
            const meta = rowMeta(item);
            const title = meta.sequenceTitle === item.questionTitle ? meta.titleBeforeSequence : item.questionTitle;
            return { item, meta, title, match: title.match(TITLE_SEQUENCE_PATTERN) };
        });
        if (candidates.some(c => !c.match)) {
            // A manual edit removed the pattern: retain that edit, restore other titles.
            candidates.forEach((c, idx) => {
                markTitleChanged(c.item, idx, c.title);
                delete c.meta.titleBeforeSequence; delete c.meta.sequenceTitle;
            });
            state.sequenceTitles = false;
            showToast('Title numbering turned off: every title must end in ": number". Your edit is kept.');
            return;
        }
        candidates.forEach((c, idx) => {
            c.meta.titleBeforeSequence = c.title;
            c.meta.sequenceTitle = c.match[1] + (idx + 1) + c.match[3];
            markTitleChanged(c.item, idx, c.meta.sequenceTitle);
        });
    }

    function setSortByPostID(enabled) {
        if (state.isRunning || (state.sequenceTitles && state.lockNonFailed && computeStats().success > 0)) return;
        if (enabled && state.working.some(item => !/^\d+$/.test(String(item.postID).trim()))) {
            updateSequenceControls();
            return showToast('Post IDs must be whole, non-negative numbers before sorting.');
        }
        pushHistory();
        const entries = state.working.map((item, idx) => ({ item, status: state.itemStatus[idx], meta: rowMeta(item) }));
        entries.sort((a, b) => {
            if (!enabled) return a.meta.order - b.meta.order;
            const x = BigInt(String(a.item.postID).trim()), y = BigInt(String(b.item.postID).trim());
            return x < y ? -1 : x > y ? 1 : a.meta.order - b.meta.order;
        });
        state.working = entries.map(e => e.item);
        state.itemStatus = {};
        entries.forEach((e, idx) => { if (e.status) state.itemStatus[idx] = e.status; });
        state.sortByPostID = enabled;
        resetRenumberState(true);
        renderAll();
    }

    function setSequenceTitles(enabled) {
        if (state.isRunning || (state.lockNonFailed && computeStats().success > 0)) return;
        if (enabled) {
            const invalid = state.working.filter(item => !TITLE_SEQUENCE_PATTERN.test(item.questionTitle));
            if (invalid.length) {
                updateSequenceControls();
                return showToast(`${invalid.length} title(s) do not end in ": number". No titles changed.`);
            }
        }
        pushHistory();
        if (!enabled) state.working.forEach((item, idx) => {
            const meta = rowMeta(item);
            if (meta.sequenceTitle === item.questionTitle) markTitleChanged(item, idx, meta.titleBeforeSequence);
            delete meta.titleBeforeSequence; delete meta.sequenceTitle;
        });
        state.sequenceTitles = enabled;
        resetRenumberState(true);
        renderAll();
    }

    function commitSequenceTitles() {
        // Explicit Smart Renumber replaces automatic numbering and keeps its own baseline.
        state.sequenceTitles = false;
        state.working.forEach(item => {
            const meta = rowMeta(item);
            delete meta.titleBeforeSequence; delete meta.sequenceTitle;
        });
    }

    function updateSequenceControls() {
        q('#qa-sort-postid').checked = state.sortByPostID;
        q('#qa-sequence-titles').checked = state.sequenceTitles;
        const locked = state.lockNonFailed && computeStats().success > 0;
        q('#qa-sort-postid').disabled = state.isRunning || !state.working.length || (locked && state.sequenceTitles);
        q('#qa-sequence-titles').disabled = state.isRunning || !state.working.length || locked;
        q('#qa-sequence-note').textContent = state.isRunning ? 'Updates in progress. Editing is available after the run stops.'
            : (state.lockNonFailed && computeStats().success > 0) ? 'Unlock successful items to change title numbering. JSON includes the current table.'
            : `${state.sortByPostID ? 'Post ID ↑' : 'Original order'} · ${state.sequenceTitles ? 'Titles numbered 1–' + state.working.length : 'Automatic numbering off'} · Changes are included in JSON and Run Updates.`;
    }

    function updateEditingAvailability() {
        if (!overlayEl) return;
        overlayEl.querySelectorAll('#qa-toolbar button, #qa-toolbar input, .qa-advanced input, .qa-advanced select, .qa-advanced button, #qa-renumber-panel input, #qa-renumber-panel button, #qa-lock-toggle').forEach(el => {
            el.disabled = state.isRunning || (el.id === 'qa-undo-btn' && !state.history.length);
        });
        overlayEl.querySelectorAll('.qa-edit-input').forEach(el => {
            el.disabled = state.isRunning || (state.lockNonFailed && state.itemStatus[Number(el.dataset.idx)] === 'success');
        });
        const revert = q('#qa-renumber-revert');
        if (revert) revert.disabled = state.isRunning || !state.renumberBaseline || !state.working.some((item, idx) => item.questionTitle !== state.renumberBaseline.originalTitles[idx]);
        updateSequenceControls();
    }

    function showToast(msg) {
        const toast = q('#qa-toast');
        toast.textContent = msg;
        toast.classList.add('qa-show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('qa-show'), 2400);
    }

    function flashCards(indices) {
        indices.forEach(idx => {
            const card = overlayEl.querySelector(`.qa-card[data-idx="${idx}"]`);
            if (!card) return;
            card.classList.add('qa-flash');
            setTimeout(() => card.classList.remove('qa-flash'), 900);
        });
    }

    function renderLockBar() {
        const bar = q('#qa-lock-bar');
        if (!bar) return;
        const { success, failed } = computeStats();

        if (success === 0 && failed === 0) {
            bar.classList.add('qa-hidden');
            bar.innerHTML = '';
            return;
        }

        bar.classList.remove('qa-hidden');
        const lockedCount = state.lockNonFailed ? success : 0;

        const summary = failed > 0
            ? `⚠️ <strong>${failed}</strong> item${failed !== 1 ? 's' : ''} failed — editable below`
            : `✅ All ${success} item${success !== 1 ? 's' : ''} succeeded`;

        const lockedNote = success > 0
            ? ` · <strong>${lockedCount}</strong> ${state.lockNonFailed ? 'locked' : 'succeeded (unlocked)'}`
            : '';

        bar.innerHTML = `
            <span class="qa-lock-bar-text">${summary}${lockedNote}</span>
            <button class="qa-btn-sm ${state.lockNonFailed ? 'qa-secondary' : ''}" id="qa-lock-toggle">
                ${state.lockNonFailed ? '🔓 Unlock All' : '🔒 Lock Successful Items'}
            </button>
        `;

        q('#qa-lock-toggle').onclick = () => {
            state.lockNonFailed = !state.lockNonFailed;
            renderAll();
            showToast(state.lockNonFailed ? '🔒 Successful items locked.' : '🔓 All items unlocked for editing.');
        };
    }

    /* ---- Smart Renumber panel rendering ---- */
    function openRenumberPanel(forceRecapture, autoOnlyIfSuccess) {
        if (!overlayEl) return;
        if (!state.working.length) {
            if (!autoOnlyIfSuccess) showToast('⚠️ No data available to renumber.');
            return;
        }

        const baseline = ensureRenumberBaseline(forceRecapture);

        if (!baseline) {
            if (autoOnlyIfSuccess) return;
            q('#qa-renumber-panel').classList.remove('qa-hidden');
            renderRenumberPanel();
            return;
        }

        if (autoOnlyIfSuccess) {
            showToast('Smart Renumber pattern detected — review before applying.');
        }
        q('#qa-renumber-panel').classList.remove('qa-hidden');
        renderRenumberPanel();
    }

    function renderRenumberPanel() {
        const body = q('#qa-renumber-body');
        if (!body) return;

        if (!state.renumberBaseline) {
            const reason = state.renumberDetectionFailReason || 'Could not detect a numbering pattern.';
            body.innerHTML = `
                <div class="qa-renumber-fail">
                    ⚠️ Couldn't detect a consistent numbering pattern in the current titles.
                    <span class="qa-renumber-fail-reason">${escapeHtml(reason)}</span>
                    Tip: Smart Renumber looks for a trailing "<code>: N</code>" style number at the
                    end of each title — the text before the colon may differ freely between questions.
                    You can still renumber manually using Find &amp; Replace with the {{n}} auto-number token.
                </div>`;
            return;
        }

        const baseline = state.renumberBaseline;
        const { suffix, defaultPad, originalTitles, mode } = baseline;
        const suggestedStart = suggestSmartStart(baseline);
        const currentStart = state.renumberCurrentStart != null ? state.renumberCurrentStart : suggestedStart;
        const currentPad   = state.renumberCurrentPad   != null ? state.renumberCurrentPad   : defaultPad;

        const rows = state.working.map((item, idx) => {
            const itemPrefix = mode === 'colon' ? baseline.perItemPrefix[idx] : baseline.prefix;
            return {
                idx,
                postID: item.postID,
                oldNum: extractMiddle(originalTitles[idx], itemPrefix, suffix),
                newNum: formatNumber(currentStart + idx, currentPad),
            };
        });

        const conflicts = checkRenumberCollisions(baseline, currentPad, currentStart);
        const canRevert = state.working.some((item, idx) => item.questionTitle !== originalTitles[idx]);

        const patternHtml = mode === 'colon'
            ? `<code>(text varies)</code> :
               <span class="qa-renumber-num-slot">[N]</span>
               <code>${escapeHtml(truncateMiddle(suffix, 20)) || '(none)'}</code>
               <span style="font-size:11px;opacity:0.7;">only the trailing number is renumbered</span>`
            : `<code title="${escapeAttr(baseline.prefix)}">${escapeHtml(truncateMiddle(baseline.prefix, 42))}</code>
               <span class="qa-renumber-num-slot">[N]</span>
               <code title="${escapeAttr(suffix)}">${escapeHtml(truncateMiddle(suffix, 20)) || '(none)'}</code>`;

        body.innerHTML = `
            <div class="qa-renumber-pattern">
                <span>Detected pattern:</span>
                ${patternHtml}
            </div>

            <div class="qa-renumber-controls">
                <div class="qa-field-stack">
                    <label>Start #</label>
                    <input type="number" id="qa-renumber-start" min="0" value="${currentStart}">
                </div>
                <button class="qa-btn-sm qa-secondary" id="qa-renumber-smart-start">
                    ✨ Continue from existing (start at ${suggestedStart})
                </button>
                <div class="qa-field-stack">
                    <label>Pad width (0 = none)</label>
                    <input type="number" id="qa-renumber-pad" min="0" value="${currentPad}">
                </div>
            </div>

            ${conflicts.length ? `
            <div class="qa-renumber-collision-warning">
                ⚠️ <strong>${conflicts.length}</strong> conflict${conflicts.length !== 1 ? 's' : ''} detected —
                these new titles already exist elsewhere in your extracted data:
                ${conflicts.slice(0, 5).map(c => `
                    <div class="qa-renumber-collision-item">
                        • New <strong>"${escapeHtml(c.newTitle)}"</strong> would duplicate Post ${escapeHtml(c.collidesWith.postID)}
                    </div>`).join('')}
                ${conflicts.length > 5 ? `<div class="qa-renumber-collision-item">…and ${conflicts.length - 5} more</div>` : ''}
            </div>` : ''}

            <div class="qa-renumber-preview">
                <div class="qa-renumber-preview-title">Preview (${rows.length} question${rows.length !== 1 ? 's' : ''})</div>
                <div id="qa-renumber-preview-list">
                    ${rows.map(r => `
                        <div class="qa-renumber-row">
                            <span class="qa-renumber-row-idx">#${r.idx + 1}</span>
                            <span class="qa-renumber-row-post">Post ${escapeHtml(r.postID)}</span>
                            <span class="qa-renumber-row-nums">
                                <span class="qa-renumber-row-old">${escapeHtml(r.oldNum)}</span>
                                <span class="qa-renumber-row-arrow">→</span>
                                <span class="qa-renumber-row-new">${escapeHtml(r.newNum)}</span>
                            </span>
                        </div>`).join('')}
                </div>
            </div>

            <div class="qa-renumber-actions">
                <button class="qa-btn-sm qa-secondary" id="qa-renumber-revert" ${canRevert ? '' : 'disabled'}>↩ Revert Titles</button>
                <button class="qa-btn qa-btn-start" id="qa-renumber-apply">Apply Renumbering</button>
            </div>
        `;
    }

    /* ---- Hide tab helpers ---- */
    function computeTagOptions() {
        const tagSets = state.working.map(item =>
            new Set((item.tag || '').split(',').map(t => t.trim()).filter(Boolean))
        );
        const allTagsSet = new Set();
        tagSets.forEach(s => s.forEach(t => allTagsSet.add(t)));
        const allTags = [...allTagsSet].sort();
        const commonTags = tagSets.length ? allTags.filter(t => tagSets.every(s => s.has(t))) : [];
        return { allTags, commonTags };
    }

    function populateHideTagOptions(preserveSelection) {
        const select = q('#qa-hide-tagname');
        if (!select) return;
        const prevValue = preserveSelection ? select.value : null;
        const { allTags, commonTags } = computeTagOptions();

        let html = '';
        if (commonTags.length) {
            html += `<optgroup label="Common to all records (recommended)">`;
            html += commonTags.map(t => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join('');
            html += `</optgroup>`;
        }
        const otherTags = allTags.filter(t => !commonTags.includes(t));
        if (otherTags.length) {
            html += `<optgroup label="Other tags used">`;
            html += otherTags.map(t => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join('');
            html += `</optgroup>`;
        }
        if (!allTags.length) html = `<option value="">No tags found</option>`;

        select.innerHTML = html;
        if (prevValue && allTags.includes(prevValue)) select.value = prevValue;
        else if (commonTags.length) select.value = commonTags[0];
    }

    function loadHideDefaults() {
        try { return JSON.parse(localStorage.getItem(HIDE_DEFAULTS_KEY)) || {}; }
        catch (e) { return {}; }
    }

    function saveHideDefaults(vals) {
        try { localStorage.setItem(HIDE_DEFAULTS_KEY, JSON.stringify(vals)); }
        catch (e) { /* ignore */ }
    }

    function tryDetectUserId() {
        try {
            const el = document.querySelector('input[name="userid"], input#userid');
            if (el && el.value) return el.value;
        } catch (e) { /* ignore */ }
        return null;
    }

    function initHideForm() {
        const saved = loadHideDefaults();
        q('#qa-hide-title').value    = saved.title    || '';
        q('#qa-hide-category').value = saved.category ?? 0;
        q('#qa-hide-tag').value      = saved.tag      ?? 0;
        q('#qa-hide-userid').value   = saved.userid   || tryDetectUserId() || '181161';
        q('#qa-hide-count').value    = saved.count    ?? (state.working.length || 60);
        q('#qa-hide-start').value    = saved.start    ?? 1;
        q('#qa-hide-onlyhideqns').checked = saved.onlyhideqns !== false;
        q('#qa-hide-hideqns').checked     = saved.hideqns !== false;
        populateHideTagOptions(false);
        renderHideResult(undefined, true);
    }

    function updateHideTabAvailability() {
        if (!overlayEl) return;
        const tabBtn    = q('#qa-tab-hide-btn');
        const lockedMsg = q('#qa-hide-locked-msg');
        const formWrap  = q('#qa-hide-form-wrap');
        if (!tabBtn) return;

        const unlocked = state.hasCompletedRun;
        tabBtn.classList.toggle('qa-tab-locked', !unlocked);
        tabBtn.textContent = 'Hide Questions';
        tabBtn.setAttribute('aria-disabled', String(!unlocked));

        if (lockedMsg && formWrap) {
            lockedMsg.classList.toggle('qa-hidden', unlocked);
            formWrap.classList.toggle('qa-hidden', !unlocked);
        }

        if (unlocked) populateHideTagOptions(true);
    }

    function renderHideResult(result, forceHide) {
        const box = q('#qa-hide-result');
        if (!box) return;

        if (forceHide || result === undefined) {
            box.className = 'qa-run-banner qa-hidden';
            box.innerHTML = '';
            return;
        }
        if (result === null) {
            box.className = 'qa-run-banner';
            box.classList.remove('qa-hidden');
            box.innerHTML = `<span class="qa-banner-icon">⏳</span><span class="qa-banner-text">Sending request…</span>`;
            return;
        }

        const cls  = result.ok ? 'qa-banner-success' : (result.isAuthError ? 'qa-banner-auth' : 'qa-banner-generic');
        const icon = result.ok ? '✅' : (result.isAuthError ? '🔒' : '⚠️');
        box.className = 'qa-run-banner ' + cls;
        box.classList.remove('qa-hidden');
        box.innerHTML = `
            <span class="qa-banner-icon">${icon}</span>
            <span class="qa-banner-text">
                ${result.ok ? 'Hide request sent successfully.' : escapeHtml(result.message)}
                <br><span style="opacity:0.75;font-size:12px;">
                    HTTP ${result.status} · Please verify on the site that the questions are hidden as expected.
                </span>
            </span>
        `;
    }

    /* ---- Find & Replace live match counter ---- */
    function computeFindMatchCount() {
        if (!overlayEl) return 0;
        const fieldEl = q('#qa-fr-field');
        const findEl  = q('#qa-fr-find');
        const regexEl = q('#qa-fr-regex');
        if (!fieldEl || !findEl || !regexEl) return 0;

        const field    = fieldEl.value;
        const find     = findEl.value;
        const useRegex = regexEl.checked;

        if (!find) return 0;

        let matcher = null;
        if (useRegex) {
            try { matcher = new RegExp(find, 'g'); }
            catch (e) { return null; } // invalid regex
        }

        let count = 0;
        const countIn = (str) => {
            if (typeof str !== 'string' || !str) return;
            if (useRegex) {
                const m = str.match(matcher);
                if (m) count += m.length;
            } else {
                if (str.includes(find)) count += str.split(find).length - 1;
            }
        };

        state.working.forEach((item, idx) => {
            if (state.lockNonFailed && state.itemStatus[idx] === 'success') return;
            if (field === 'questionTitle' || field === 'both') countIn(item.questionTitle);
            if (field === 'tag'           || field === 'both') countIn(item.tag);
            if (field === 'answer') countIn(item.answer);
        });

        return count;
    }

    function updateFindReplaceCount() {
        const el = q('#qa-fr-count');
        if (!el) return;
        const count = computeFindMatchCount();
        if (count === null) {
            el.textContent = 'invalid regex';
            el.style.color = 'var(--qa-red)';
        } else {
            el.textContent = String(count);
            el.style.color = count > 0 ? 'var(--qa-blue)' : 'var(--qa-text-secondary)';
        }
    }

    function fitTitleEditors() {
        const inputs = [...overlayEl.querySelectorAll('textarea[data-field="questionTitle"]')];
        inputs.forEach(el => { el.style.height = '0px'; });
        const heights = inputs.map(el => Math.min(180, Math.max(36, el.scrollHeight + 2)));
        inputs.forEach((el, i) => { el.style.height = heights[i] + 'px'; });
    }

    function renderAll() {
        syncSequenceTitles();
        q('#qa-cards-container').innerHTML = renderCards();
        fitTitleEditors();
        renderLockBar();
        updateHideTabAvailability();

        const { total } = computeStats();
        q('#qa-record-count').textContent = `${total} record${total !== 1 ? 's' : ''}`;
        q('#qa-range-to').value = total || '';
        q('#qa-undo-btn').disabled = state.history.length === 0;
        q('#qa-undo-btn').style.opacity = state.history.length === 0 ? '0.5' : '1';
        updateProgressUI();
        updateFindReplaceCount();
        updateEditingAvailability();
    }

    function switchTab(tabName) {
        overlayEl.querySelectorAll('.qa-tab-btn').forEach(b => b.classList.toggle('qa-active', b.dataset.tab === tabName));
        overlayEl.querySelectorAll('.qa-tab-panel').forEach(p => p.classList.toggle('qa-active', p.dataset.panel === tabName));
        q('#qa-toolbar').classList.toggle('qa-hidden', tabName === 'run' || tabName === 'hide');
        if (tabName === 'visual') fitTitleEditors();
    }

    function openModal() {
        if (overlayEl) {
            document.body.classList.add('qa-modal-open');
            clearTimeout(overlayEl._closeTimer);
            overlayEl.inert = false;
            overlayEl.removeAttribute('aria-hidden');
            requestAnimationFrame(() => { overlayEl.classList.add('qa-visible'); q('#qa-modal-close').focus(); });
            return;
        }

        const data = extractData();

        state.original               = data;
        state.working                = deepClone(data);
        resetSequenceState();
        state.history                = [];
        state.itemStatus             = {};
        state.lockNonFailed          = false;
        state.hasCompletedRun        = false;
        state.isRunning              = false;
        state.isPaused               = false;
        state.stopRequested          = false;
        state.consecutiveFailures    = 0;
        state.consecutiveAuthFailures = 0;
        state.renumberBaseline       = null;
        state.renumberDetectionFailReason = null;
        state.renumberCurrentStart   = null;
        state.renumberCurrentPad     = null;

        if (!overlayEl) overlayEl = buildModal();
        wireModalEvents();
        renderAll();
        q('#qa-log-console').innerHTML  = '';
        q('#qa-simple-feed').innerHTML  = '';
        q('#qa-simple-feed').classList.add('qa-active');
        q('#qa-log-console').classList.remove('qa-active');
        q('#qa-view-toggle').textContent = 'Technical Log';
        q('#qa-renumber-panel').classList.add('qa-hidden');
        hideBanner();
        initHideForm();
        updateRunButtons();
        switchTab('visual');

        document.body.classList.add('qa-modal-open');
        requestAnimationFrame(() => { overlayEl.classList.add('qa-visible'); q('#qa-modal-close').focus(); });
    }

    function closeModal() {
        if (!overlayEl) return;
        overlayEl.classList.remove('qa-visible');
        overlayEl.inert = true;
        overlayEl.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('qa-modal-open');
        document.getElementById('qa-extract-fab')?.focus();
        overlayEl._closeTimer = setTimeout(() => document.body.classList.remove('qa-modal-open'), 260);
    }

    function wireModalEvents() {
        if (overlayEl.dataset.wired) return;
        overlayEl.dataset.wired = '1';
        let resizeFrame;
        window.addEventListener('resize', () => {
            cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(() => { if (q('[data-panel="visual"]').classList.contains('qa-active')) fitTitleEditors(); });
        });
        q('#qa-reextract').onclick = () => {
            if (state.isRunning) return;
            if (!confirm('Replace this workspace with the current page table? You can Undo afterwards.')) return;
            pushHistory();
            state.working = extractData();
            resetSequenceState();
            state.itemStatus = {};
            state.lockNonFailed = false;
            state.hasCompletedRun = false;
            resetRenumberState(true);
            renderAll();
            showToast('Extracted the current page table.');
        };
        q('#qa-sort-postid').onchange = e => setSortByPostID(e.target.checked);
        q('#qa-sequence-titles').onchange = e => setSequenceTitles(e.target.checked);
        q('#qa-download-json').onclick = () => {
            const url = URL.createObjectURL(new Blob([JSON.stringify(state.working, null, 2)], { type: 'application/json' }));
            const link = document.createElement('a');
            link.href = url; link.download = 'quickedit-records.json'; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
        overlayEl.addEventListener('keydown', e => {
            if (e.key !== 'Tab') return;
            const els = [...overlayEl.querySelectorAll('button, input, select, textarea, a[href], summary')]
                .filter(el => !el.disabled && el.getClientRects().length);
            const first = els[0], last = els[els.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
            if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        });
        overlayEl.querySelectorAll('.qa-tab-btn').forEach(btn => {
            btn.onclick = () => {
                if (btn.dataset.tab === 'hide' && !state.hasCompletedRun) {
                    showToast('🔒 Complete a full update run first to unlock this step.');
                    return;
                }
                switchTab(btn.dataset.tab);
                if (btn.dataset.tab === 'hide') populateHideTagOptions(true);
            };
        });

        q('#qa-modal-close').onclick = closeModal;
        overlayEl.onclick = (e) => { if (e.target === overlayEl) closeModal(); };

        const visualPanel = q('[data-panel="visual"]');

        visualPanel.addEventListener('focusin', (e) => {
            if (e.target.matches('.qa-edit-input')) e.target.dataset.prev = e.target.value;
        });

        visualPanel.addEventListener('input', (e) => {
            if (e.target.matches('textarea.qa-edit-input')) {
                e.target.style.height = '0px';
                e.target.style.height = Math.min(180, Math.max(36, e.target.scrollHeight + 2)) + 'px';
            }
            if (e.target.matches('.qa-edit-input[data-field="tag"]')) {
                const preview = overlayEl.querySelector(`[data-chip-preview="${e.target.dataset.idx}"]`);
                if (preview) preview.innerHTML = renderTagChips(e.target.value);
                const summary = e.target.closest('details')?.querySelector('summary');
                const tagCount = e.target.value.split(',').map(t => t.trim()).filter(Boolean).length;
                if (summary) summary.textContent = `${tagCount} tag${tagCount === 1 ? '' : 's'}`;
            }
        });

        visualPanel.addEventListener('change', (e) => {
            if (!e.target.matches('.qa-edit-input') || e.target.disabled || state.isRunning) return;
            const idx   = parseInt(e.target.dataset.idx, 10);
            const field = e.target.dataset.field;
            const newVal = e.target.value;
            if (newVal === e.target.dataset.prev) return;

            pushHistory();
            state.working[idx][field] = newVal;
            state.hasCompletedRun = false;
            if (field === 'questionTitle') resetRenumberState(true);

            let statusReverted = false;
            if (state.itemStatus[idx] === 'success') {
                delete state.itemStatus[idx];
                statusReverted = true;
            }

            syncSequenceTitles();
            overlayEl.querySelectorAll('textarea[data-field="questionTitle"]').forEach(input => {
                input.value = state.working[Number(input.dataset.idx)].questionTitle;
            });
            fitTitleEditors();
            e.target.value = state.working[idx][field];
            e.target.dataset.prev = e.target.value;
            renderLockBar();
            updateHideTabAvailability();
            updateProgressUI();
            updateFindReplaceCount();
            updateEditingAvailability();
            if (statusReverted) showToast('✏️ Edited a completed item — it will be resent on the next run.');
        });

        /* Find & Replace */
        const frRecount = () => updateFindReplaceCount();
        q('#qa-fr-field').addEventListener('change', frRecount);
        q('#qa-fr-find').addEventListener('input', frRecount);
        q('#qa-fr-regex').addEventListener('change', frRecount);

        q('#qa-fr-apply').onclick = () => {
            const field      = q('#qa-fr-field').value;
            const find       = q('#qa-fr-find').value;
            const replaceRaw = q('#qa-fr-replace').value;
            const useRegex   = q('#qa-fr-regex').checked;
            const startNumStr = q('#qa-fr-startnum').value;
            const useAutoNumber = replaceRaw.includes('{{n}}') && startNumStr !== '';
            let counter = useAutoNumber ? parseInt(startNumStr, 10) : null;

            if (!find) return showToast('⚠️ Enter text to find first.');

            let matcher;
            try {
                matcher = useRegex ? new RegExp(find, 'g') : find;
            } catch (e) {
                return showToast('⚠️ Invalid regex: ' + e.message);
            }

            pushHistory();
            const changedIndices = [];
            let totalMatches = 0;

            state.working.forEach((item, idx) => {
                if (state.lockNonFailed && state.itemStatus[idx] === 'success') return;
                let itemChanged = false;
                const applyTo = (str) => {
                    if (typeof str !== 'string') return str;
                    let didMatch = false, result;
                    if (useRegex) {
                        result = str.replace(matcher, () => {
                            didMatch = true;
                            totalMatches++;
                            return useAutoNumber ? replaceRaw.replace('{{n}}', counter) : replaceRaw;
                        });
                    } else {
                        if (str.includes(find)) {
                            didMatch = true;
                            const occurrences = str.split(find).length - 1;
                            totalMatches += occurrences;
                            const rep = useAutoNumber ? replaceRaw.replace('{{n}}', counter) : replaceRaw;
                            result = str.split(find).join(rep);
                        } else {
                            result = str;
                        }
                    }
                    if (didMatch) { itemChanged = true; if (useAutoNumber) counter++; }
                    return result;
                };

                if (field === 'questionTitle' || field === 'both') item.questionTitle = applyTo(item.questionTitle);
                if (field === 'tag'           || field === 'both') item.tag           = applyTo(item.tag);
                if (field === 'answer') item.answer = applyTo(item.answer);

                if (itemChanged) {
                    changedIndices.push(idx);
                    if (state.itemStatus[idx] === 'success') delete state.itemStatus[idx];
                }
            });

            if (!changedIndices.length) {
                state.history.pop();
                return showToast('No matches found — nothing changed.');
            }

            state.hasCompletedRun = false;
            resetRenumberState(true);
            renderAll();
            flashCards(changedIndices);
            showToast(`✅ Updated ${changedIndices.length} record${changedIndices.length !== 1 ? 's' : ''} — ${totalMatches} total match${totalMatches !== 1 ? 'es' : ''} replaced.`);
        };

        /* Range slice */
        q('#qa-range-apply').onclick = () => {
            const from = parseInt(q('#qa-range-from').value, 10);
            const to   = parseInt(q('#qa-range-to').value,   10);
            if (!from || !to || from < 1 || to < from || to > state.working.length)
                return showToast(`⚠️ Enter a valid range between 1 and ${state.working.length}.`);

            if (state.sequenceTitles && state.lockNonFailed && computeStats().success > 0) return showToast('Unlock successful items before changing this numbered range.');
            pushHistory();
            state.hasCompletedRun = false;
            const oldStatus = state.itemStatus;
            state.working   = state.working.slice(from - 1, to);

            const newStatus = {};
            for (let i = from - 1; i < to; i++) {
                if (oldStatus[i]) newStatus[i - (from - 1)] = oldStatus[i];
            }
            state.itemStatus = newStatus;

            renderAll();
            showToast(`Sliced to records ${from}–${to} (${state.working.length} kept).`);

            // Fresh slice — recapture the Smart Renumber baseline and auto-open only if a pattern is found
            state.renumberCurrentStart = null;
            state.renumberCurrentPad = null;
            resetRenumberState(true);
        };

        /* Smart Renumber */
        q('#qa-renumber-open').onclick = () => {
            openRenumberPanel(false, false);
        };

        const renumberPanel = q('#qa-renumber-panel');

        q('#qa-renumber-close').onclick = () => {
            renumberPanel.classList.add('qa-hidden');
        };

        q('#qa-renumber-redetect').onclick = () => {
            state.renumberCurrentStart = null;
            state.renumberCurrentPad = null;
            openRenumberPanel(true, false);
            showToast('🔄 Pattern re-detected from current titles.');
        };

        renumberPanel.addEventListener('input', (e) => {
            if (e.target.id === 'qa-renumber-start') {
                const val = parseInt(e.target.value, 10);
                state.renumberCurrentStart = isNaN(val) ? 0 : val;
                renderRenumberPanel();
                const input = q('#qa-renumber-start');
                if (input) { input.focus(); input.select(); }
            }
            if (e.target.id === 'qa-renumber-pad') {
                const val = parseInt(e.target.value, 10);
                state.renumberCurrentPad = isNaN(val) ? 0 : val;
                renderRenumberPanel();
                const input = q('#qa-renumber-pad');
                if (input) { input.focus(); input.select(); }
            }
        });

        renumberPanel.addEventListener('click', (e) => {
            if (e.target.id === 'qa-renumber-smart-start') {
                state.renumberCurrentStart = suggestSmartStart(state.renumberBaseline);
                renderRenumberPanel();
            }

            if (e.target.id === 'qa-renumber-revert') {
                revertRenumbering();
                renderAll();
                renderRenumberPanel();
                showToast('↩ Reverted to pre-renumber titles.');
            }

            if (e.target.id === 'qa-renumber-apply') {
                const baseline = state.renumberBaseline;
                const start = state.renumberCurrentStart != null ? state.renumberCurrentStart : suggestSmartStart(baseline);
                const pad   = state.renumberCurrentPad   != null ? state.renumberCurrentPad   : baseline.defaultPad;
                const conflicts = checkRenumberCollisions(baseline, pad, start);

                if (conflicts.length) {
                    if (!confirm(`⚠️ ${conflicts.length} conflict(s) detected — this numbering would duplicate titles that already exist elsewhere in your extracted data. Apply anyway?`)) return;
                } else {
                    if (!confirm(`Renumber ${state.working.length} question title(s) starting at ${start}?`)) return;
                }

                applyRenumbering(start, pad);
                renderAll();
                renderRenumberPanel();
                showToast(`✅ Renumbered ${state.working.length} title(s) starting at ${start}.`);
            }
        });

        /* Bulk tag */
        q('#qa-bulk-add').onclick = () => {
            const tag = q('#qa-bulk-tag').value.trim();
            if (!tag) return showToast('⚠️ Enter a tag name first.');
            pushHistory();
            let count = 0;
            state.working.forEach((item, idx) => {
                if (state.lockNonFailed && state.itemStatus[idx] === 'success') return;
                const tags = (item.tag || '').split(',').map(t => t.trim()).filter(Boolean);
                if (!tags.includes(tag)) {
                    tags.push(tag); item.tag = tags.join(','); count++;
                    if (state.itemStatus[idx] === 'success') delete state.itemStatus[idx];
                }
            });
            if (count) state.hasCompletedRun = false;
            renderAll();
            showToast(`Added "${tag}" to ${count} record${count !== 1 ? 's' : ''}.`);
        };

        q('#qa-bulk-remove').onclick = () => {
            const tag = q('#qa-bulk-tag').value.trim();
            if (!tag) return showToast('⚠️ Enter a tag name first.');
            pushHistory();
            let count = 0;
            state.working.forEach((item, idx) => {
                if (state.lockNonFailed && state.itemStatus[idx] === 'success') return;
                const tags = (item.tag || '').split(',').map(t => t.trim()).filter(Boolean);
                if (tags.includes(tag)) {
                    item.tag = tags.filter(t => t !== tag).join(','); count++;
                    if (state.itemStatus[idx] === 'success') delete state.itemStatus[idx];
                }
            });
            if (count) state.hasCompletedRun = false;
            renderAll();
            showToast(`Removed "${tag}" from ${count} record${count !== 1 ? 's' : ''}.`);
        };

        /* Undo */
        q('#qa-undo-btn').onclick = () => {
            if (!state.history.length) return;
            restoreHistory();
            resetRenumberState(true);
            renderAll();
            showToast('Undone.');
        };

        /* Reset */
        q('#qa-reset-data').onclick = () => {
            if (!confirm('Discard all edits and restore the originally extracted data?')) return;
            pushHistory();
            state.working       = deepClone(state.original);
            resetSequenceState();
            state.hasCompletedRun = false;
            state.itemStatus    = {};
            state.lockNonFailed = false;
            resetRenumberState(true);
            renderAll();
            showToast('Reset to original extracted data.');
        };

        /* Upload manual JSON */
        q('#qa-upload-json-btn').onclick = () => {
            q('#qa-upload-json-file').click();
        };

        q('#qa-upload-json-file').onchange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    if (!Array.isArray(parsed)) throw new Error('JSON root must be an array of records.');
                    if (!parsed.length) throw new Error('JSON array is empty.');

                    const normalized = parsed.map((item, i) => {
                        if (!item || typeof item !== 'object' || Array.isArray(item)) {
                            throw new Error(`Item at index ${i} is not a valid object.`);
                        }
                        if (item.postID === undefined || item.postID === null || item.postID === '') {
                            throw new Error(`Item at index ${i} is missing a "postID" field.`);
                        }
                        return {
                            postID: String(item.postID),
                            answer: item.answer != null ? String(item.answer) : '',
                            questionTitle: item.questionTitle != null ? String(item.questionTitle) : '',
                            tag: item.tag != null ? String(item.tag) : '',
                        };
                    });

                    if (!confirm(`Load ${normalized.length} record(s) from "${file.name}"? This will replace the current working data (you can Undo afterwards).`)) {
                        e.target.value = '';
                        return;
                    }

                    pushHistory();
                    if (state.isRunning) throw new Error("Stop the update run before importing JSON.");
                    state.working       = normalized;
                    resetSequenceState();
                    state.hasCompletedRun = false;
                    state.itemStatus    = {};
                    state.lockNonFailed = false;
                    resetRenumberState(true);
                    renderAll();
                    showToast(`✅ Loaded ${normalized.length} record(s) from JSON.`);
                } catch (err) {
                    showToast('⚠️ Invalid JSON: ' + err.message);
                } finally {
                    e.target.value = '';
                }
            };
            reader.onerror = () => {
                showToast('⚠️ Could not read the selected file.');
                e.target.value = '';
            };
            reader.readAsText(file);
        };

        /* Copy JSON */
        const copyBtn = q('#qa-copy-btn');
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(JSON.stringify(state.working, null, 2)).then(() => {
                const orig = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                copyBtn.classList.add('qa-copied');
                setTimeout(() => { copyBtn.textContent = orig; copyBtn.classList.remove('qa-copied'); }, 1500);
            }).catch(() => showToast('Clipboard unavailable. Use Download JSON instead.'));
        };

        /* View toggle */
        q('#qa-view-toggle').onclick = () => {
            const feed = q('#qa-simple-feed');
            const log  = q('#qa-log-console');
            const showingSimple = feed.classList.contains('qa-active');
            feed.classList.toggle('qa-active', !showingSimple);
            log.classList.toggle('qa-active',  showingSimple);
            q('#qa-view-toggle').textContent = showingSimple ? 'Activity' : 'Technical Log';
        };

        /* Run controls */
        q('#qa-run-start').onclick = onStartRun;
        q('#qa-run-pause').onclick = onPauseResume;
        q('#qa-run-stop').onclick  = onStopRun;

        /* Hide Questions send */
        q('#qa-hide-send').onclick = async () => {
            const payload = {
                title:        q('#qa-hide-title').value,
                tagname:      q('#qa-hide-tagname').value,
                category:     parseInt(q('#qa-hide-category').value, 10) || 0,
                tag:          parseInt(q('#qa-hide-tag').value,      10) || 0,
                userid:       q('#qa-hide-userid').value.trim(),
                count:        parseInt(q('#qa-hide-count').value,    10) || 0,
                start:        parseInt(q('#qa-hide-start').value,    10) || 1,
                onlyhideqns:  q('#qa-hide-onlyhideqns').checked,
                hideqns:      q('#qa-hide-hideqns').checked,
            };

            if (!payload.tagname) return showToast('⚠️ Select a tag name first.');
            if (!payload.userid)  return showToast('⚠️ Enter a User ID first.');
            if (!payload.count || payload.count < 1) return showToast('⚠️ Enter a valid count.');

            saveHideDefaults(payload);

            if (!confirm(
                `This will send a LIVE request to hide up to ${payload.count} question(s) ` +
                `tagged "${payload.tagname}" (starting at #${payload.start}) for User ID ${payload.userid}. Continue?`
            )) return;

            const btn = q('#qa-hide-send');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Sending…';
            renderHideResult(null);

            const result = await sendHideRequest(payload);

            btn.disabled = false;
            btn.textContent = originalText;
            renderHideResult(result);
        };
    }

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    /* ============================================================
       RUN ENGINE
    ============================================================ */
    function appendLog(text, type = 'info') {
        if (!overlayEl) return;
        const con  = q('#qa-log-console');
        const line = document.createElement('div');
        line.className   = `qa-log-line qa-log-${type}`;
        line.textContent = text ? `[${new Date().toLocaleTimeString()}] ${text}` : '';
        con.appendChild(line);
        con.scrollTop = con.scrollHeight;
    }

    function appendFeedCard(idx, item, qRes, tRes, overallOk) {
        const feed = q('#qa-simple-feed');
        const card = document.createElement('div');
        card.className = 'qa-feed-card';
        card.innerHTML = `
            <div class="qa-feed-head">
                <span class="qa-feed-num">#${idx}</span>
                <span class="qa-feed-postid">Post ID ${escapeHtml(item.postID)}</span>
                <span class="qa-feed-overall ${overallOk ? 'qa-ok' : 'qa-fail'}">
                    ${overallOk ? '✅ Success' : '⚠️ Needs Attention'}
                </span>
            </div>
            <div class="qa-feed-body">
                <div class="qa-feed-item">
                    <span class="qa-feed-icon">${qRes.ok ? '✅' : '❌'}</span>
                    <div class="qa-feed-text">
                        <div class="qa-feed-title-text">${escapeHtml(item.questionTitle)}</div>
                        <div class="qa-feed-sub ${qRes.ok ? '' : 'qa-feed-sub-error'}">
                            ${qRes.ok ? 'Title saved successfully' : escapeHtml(qRes.message)}
                        </div>
                    </div>
                </div>
                <div class="qa-feed-item">
                    <span class="qa-feed-icon">${tRes.ok ? '✅' : '❌'}</span>
                    <div class="qa-feed-text">
                        <div class="qa-feed-tags">${renderTagChips(item.tag)}</div>
                        <div class="qa-feed-sub ${tRes.ok ? '' : 'qa-feed-sub-error'}">
                            ${tRes.ok ? 'Tags saved successfully' : escapeHtml(tRes.message)}
                        </div>
                    </div>
                </div>
            </div>
        `;
        feed.appendChild(card);
        feed.scrollTop = feed.scrollHeight;
    }

    function showBanner(type, message) {
        const banner = q('#qa-run-banner');
        banner.className = 'qa-run-banner qa-banner-' + type;
        const icon       = type === 'auth' ? '🔒' : type === 'success' ? '🎉' : '⚠️';
        const actionsHtml = type !== 'success'
            ? `<button class="qa-btn-sm"          id="qa-banner-resume">Resume</button>
               <button class="qa-btn-sm qa-danger" id="qa-banner-stop">Stop</button>`
            : `<button class="qa-btn-sm qa-secondary" id="qa-banner-dismiss">Dismiss</button>`;

        banner.innerHTML = `
            <span class="qa-banner-icon">${icon}</span>
            <span class="qa-banner-text">${escapeHtml(message)}</span>
            <span class="qa-banner-actions">${actionsHtml}</span>
        `;
        banner.classList.remove('qa-hidden');

        if (type !== 'success') {
            q('#qa-banner-resume').onclick = () => { onPauseResume(); hideBanner(); };
            q('#qa-banner-stop').onclick   = () => { onStopRun();    hideBanner(); };
        } else {
            q('#qa-banner-dismiss').onclick = hideBanner;
            setTimeout(hideBanner, 6000);
        }
    }

    function hideBanner() {
        const b = q('#qa-run-banner');
        if (b) b.classList.add('qa-hidden');
    }

    function formatETA(ms) {
        if (!isFinite(ms) || ms < 0) return '';
        const totalSecs = Math.floor(ms / 1000);
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;
        
        let parts = [];
        if (h > 0) parts.push(`${h} hrs`);
        if (m > 0 || h > 0) parts.push(`${m} mins`);
        parts.push(`${s} secs`);
        
        const finishTime = new Date(Date.now() + ms);
        const timeString = finishTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        return `estimated time completion (${parts.join(', ')}) | finishing by ${timeString}`;
    }

    function updateProgressUI() {
        if (!overlayEl) return;
        const { total, success, failed, remaining } = computeStats();
        const pct = total ? Math.round((success / total) * 100) : 0;

        q('#qa-progress-fill').style.width  = pct + '%';
        q('#qa-progress-text').textContent  = `${success} / ${total} (${pct}%)`;
        q('#qa-stat-success').textContent   = success;
        q('#qa-stat-failed').textContent    = failed;
        q('#qa-stat-remaining').textContent = remaining;

        const etaEl = q('#qa-progress-eta');
        if (etaEl) {
            if (state.isRunning && !state.isPaused && state.runCompletedItems > 0 && remaining > 0) {
                const elapsedMs = Date.now() - state.runStartTime;
                const msPerItem = elapsedMs / state.runCompletedItems;
                const remainingMs = remaining * msPerItem;
                etaEl.textContent = formatETA(remainingMs);
            } else if (!state.isRunning) {
                etaEl.textContent = '';
            } else if (state.isPaused) {
                etaEl.textContent = 'Paused';
            } else if (remaining === 0) {
                etaEl.textContent = '';
            } else {
                etaEl.textContent = 'calculating ETA...';
            }
        }
    }

    function updateRunButtons() {
        if (!overlayEl) return;
        q('#qa-run-start').disabled = state.isRunning;
        q('#qa-run-pause').disabled = !state.isRunning;
        q('#qa-run-stop').disabled  = !state.isRunning;
        q('#qa-run-pause').textContent = state.isPaused ? 'Resume' : 'Pause';

        const { total, failed, remaining } = computeStats();
        let statusText = 'Idle';
        if (state.isRunning) statusText = state.isPaused ? 'Paused' : 'Running…';
        else if (total > 0 && remaining === 0) statusText = failed > 0 ? 'Needs Attention' : 'Completed';
        q('#qa-progress-status').textContent = statusText;
        updateEditingAvailability();
    }

    function classifyResponse(res, bodyText) {
        const status = res.status;
        if (status === 401 || status === 403)
            return { ok: false, status, message: 'Unauthorized — you appear to be logged out.', isAuthError: true };
        if (res.redirected && /login|signin/i.test(res.url))
            return { ok: false, status, message: 'Redirected to login page — session expired.', isAuthError: true };
        if (/<input[^>]*type=["']?password["']?/i.test(bodyText) || /<form[^>]*login/i.test(bodyText))
            return { ok: false, status, message: 'Login form detected in response — session expired.', isAuthError: true };
        if (!res.ok)
            return { ok: false, status, message: `Server returned an error (HTTP ${status}).`, isAuthError: false };
        if ((bodyText || '').trim().startsWith('<'))
            return { ok: false, status, message: 'Unexpected page returned — you may need to log in again.', isAuthError: true };
        return { ok: true, status, message: 'Saved successfully.', isAuthError: false };
    }

    async function postAjax(id, postid, data) {
        const body = new URLSearchParams();
        body.set('ajaxdata', JSON.stringify({ id, postid: String(postid), data: String(data) }));
        try {
            const res = await fetch('https://gateoverflow.in/quickeditajax', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                },
                body: body.toString(),
            });
            let bodyText = '';
            try { bodyText = await res.text(); } catch (_) {}
            return classifyResponse(res, bodyText);
        } catch (e) {
            return { ok: false, status: 'ERR', message: 'Network error — check your internet connection.', isAuthError: false };
        }
    }

    async function runLoop() {
        state.isRunning     = true;
        state.stopRequested = false;
        state.runStartTime  = Date.now();
        state.runCompletedItems = 0;
        updateRunButtons();
        hideBanner();

        const queue = state.working
            .map((_, i) => i)
            .filter(i => state.itemStatus[i] !== 'success');

        for (let qi = 0; qi < queue.length; qi++) {
            const idx = queue[qi];

            if (state.stopRequested) break;
            while (state.isPaused) { await sleep(200); if (state.stopRequested) break; }
            if (state.stopRequested) break;

            const item       = state.working[idx];
            const displayNum = idx + 1;

            appendLog(`Question ${displayNum} (Post ${item.postID}) — sending title update...`, 'info');
            const qRes = await postAjax(1, item.postID, item.questionTitle);
            appendLog(`Question ${displayNum} title: HTTP ${qRes.status} — ${qRes.message}`, qRes.ok ? 'success' : 'error');

            await interruptibleSleep(randomBetween(state.minDelay, state.maxDelay) * 1000);
            if (state.stopRequested) break;
            while (state.isPaused) { await sleep(200); if (state.stopRequested) break; }
            if (state.stopRequested) break;

            appendLog(`Question ${displayNum} (Post ${item.postID}) — sending tag update...`, 'info');
            const tRes = await postAjax(2, item.postID, item.tag);
            appendLog(`Question ${displayNum} tag: HTTP ${tRes.status} — ${tRes.message}`, tRes.ok ? 'success' : 'error');
            appendLog('', 'info');

            const overallOk = qRes.ok && tRes.ok;
            state.itemStatus[idx] = overallOk ? 'success' : 'failed';
            state.runCompletedItems++;

            if (overallOk) {
                state.consecutiveFailures     = 0;
                state.consecutiveAuthFailures = 0;
            } else {
                state.consecutiveFailures++;
                if (qRes.isAuthError || tRes.isAuthError) state.consecutiveAuthFailures++;
                state.lockNonFailed = true;
            }

            appendFeedCard(displayNum, item, qRes, tRes, overallOk);
            renderAll();

            if (state.consecutiveAuthFailures >= 2) {
                state.isPaused = true;
                showBanner('auth', 'You appear to be logged out of GATE Overflow. Please log in, then click Resume to continue.');
                updateRunButtons();
            } else if (state.consecutiveFailures >= 4) {
                state.isPaused = true;
                showBanner('generic', 'Multiple updates failed in a row. Pausing — check details, then Resume or Stop.');
                updateRunButtons();
            }

            if (qi < queue.length - 1) {
                await interruptibleSleep(randomBetween(state.minDelay, state.maxDelay) * 1000);
            }
        }

        state.isRunning = false;
        state.isPaused  = false;
        updateRunButtons();
        updateProgressUI();

        const stats = computeStats();
        if (!state.stopRequested) {
            state.hasCompletedRun = true;
            updateHideTabAvailability();

            if (stats.failed === 0 && stats.remaining === 0) {
                appendLog(`🎉 All done! ${stats.success} succeeded, 0 failed.`, 'done');
                showBanner('success', `All ${stats.success} question(s) updated! You can now hide them in the "Hide Questions" tab.`);
            } else if (stats.failed > 0) {
                appendLog(`Run finished — ${stats.failed} item(s) still need attention.`, 'warn');
                showBanner('generic', `${stats.failed} item(s) failed. Fix them in the Questions tab, then click Start to retry.`);
            }
        } else {
            appendLog('⏹ Stopped by user.', 'warn');
        }
    }

    function onStartRun() {
        if (state.isRunning) return;
        if (!state.working.length) return showToast('⚠️ No data to run. Extract data first.');

        const { remaining, failed } = computeStats();
        const toProcess = remaining + failed;
        if (toProcess === 0) return showToast('✅ Everything is already up to date — nothing to run.');

        state.minDelay = Math.max(0, parseFloat(q('#qa-min-delay').value) || 0);
        state.maxDelay = Math.max(0, parseFloat(q('#qa-max-delay').value) || state.minDelay);
        if (state.maxDelay < state.minDelay) state.maxDelay = state.minDelay;

        if (!confirm(`This will send LIVE update requests for ${toProcess} question(s) to GATE Overflow. Continue?`)) return;

        state.isPaused = false;
        runLoop();
    }

    function onPauseResume() {
        state.isPaused = !state.isPaused;
        if (!state.isPaused) {
            state.runStartTime = Date.now();
            state.runCompletedItems = 0;
        }
        appendLog(state.isPaused ? 'Paused.' : 'Resumed.', 'warn');
        updateRunButtons();
        updateProgressUI();
    }

    function onStopRun() {
        state.stopRequested = true;
        state.isPaused      = false;
        updateRunButtons();
    }

    /* ============================================================
       HIDE QUESTIONS — /create-st request
    ============================================================ */
    function classifyPageResponse(res, bodyText) {
        const status = res.status;
        if (status === 401 || status === 403)
            return { ok: false, status, message: 'Unauthorized — you appear to be logged out.', isAuthError: true };
        if (res.redirected && /login|signin/i.test(res.url))
            return { ok: false, status, message: 'Redirected to login page — session expired.', isAuthError: true };
        if (/<input[^>]*type=["']?password["']?/i.test(bodyText) || /<form[^>]*login/i.test(bodyText))
            return { ok: false, status, message: 'Login form detected in response — session expired.', isAuthError: true };
        if (!res.ok)
            return { ok: false, status, message: `Server returned an error (HTTP ${status}).`, isAuthError: false };
        return { ok: true, status, message: 'Request sent successfully.', isAuthError: false };
    }

    async function sendHideRequest(payload) {
        const formData = new FormData();
        formData.append('title',       payload.title   || '');
        formData.append('tagname',     payload.tagname || '');
        formData.append('category',    String(payload.category));
        formData.append('tag',         String(payload.tag));
        formData.append('userid',      String(payload.userid));
        formData.append('count',       String(payload.count));
        formData.append('start',       String(payload.start));
        formData.append('onlyhideqns', payload.onlyhideqns ? '1' : '0');
        formData.append('hideqns',     payload.hideqns ? '1' : '0');

        const emptyFile = new File([], '', { type: 'application/octet-stream' });
        formData.append('file',          emptyFile);
        formData.append('questionimg[]', emptyFile);
        formData.append('submit',        '');

        try {
            const res = await fetch('https://gateoverflow.in/create-st', {
                method: 'POST',
                credentials: 'same-origin',
                body: formData,
            });
            let bodyText = '';
            try { bodyText = await res.text(); } catch (_) {}
            return classifyPageResponse(res, bodyText);
        } catch (e) {
            return { ok: false, status: 'ERR', message: 'Network error — check your internet connection.', isAuthError: false };
        }
    }

    /* ============================================================
       FAB (draggable, position persisted)
    ============================================================ */
    function loadFabPosition() {
        try { return JSON.parse(localStorage.getItem(FAB_POSITION_KEY)) || null; }
        catch (e) { return null; }
    }

    function saveFabPosition(pos) {
        try { localStorage.setItem(FAB_POSITION_KEY, JSON.stringify(pos)); }
        catch (e) { /* ignore */ }
    }

    function applyFabPosition(fab, left, top) {
        fab.style.left   = left + 'px';
        fab.style.top    = top + 'px';
        fab.style.right  = 'auto';
        fab.style.bottom = 'auto';
    }

    function clampFabToViewport(fab) {
        const rect = fab.getBoundingClientRect();
        const maxLeft = Math.max(4, window.innerWidth  - rect.width  - 4);
        const maxTop  = Math.max(4, window.innerHeight - rect.height - 4);
        const left = Math.min(Math.max(4, rect.left), maxLeft);
        const top  = Math.min(Math.max(4, rect.top),  maxTop);
        applyFabPosition(fab, left, top);
        saveFabPosition({ left, top });
    }

    function makeFabDraggable(fab) {
        let isDragging = false;
        let startX = 0, startY = 0, origLeft = 0, origTop = 0;
        const DRAG_THRESHOLD = 4;

        function onPointerMove(e) {
            const p = e.touches ? e.touches[0] : e;
            const dx = p.clientX - startX;
            const dy = p.clientY - startY;

            if (!isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
                isDragging = true;
                fab.dataset.dragged = '1';
                fab.classList.add('qa-fab-dragging');
            }

            if (isDragging) {
                if (e.cancelable) e.preventDefault();
                const rect = fab.getBoundingClientRect();
                const maxLeft = Math.max(4, window.innerWidth  - rect.width  - 4);
                const maxTop  = Math.max(4, window.innerHeight - rect.height - 4);
                const newLeft = Math.min(Math.max(4, origLeft + dx), maxLeft);
                const newTop  = Math.min(Math.max(4, origTop  + dy), maxTop);
                applyFabPosition(fab, newLeft, newTop);
            }
        }

        function onPointerUp() {
            document.removeEventListener('mousemove', onPointerMove);
            document.removeEventListener('mouseup', onPointerUp);
            document.removeEventListener('touchmove', onPointerMove);
            document.removeEventListener('touchend', onPointerUp);
            fab.classList.remove('qa-fab-dragging');

            if (isDragging) {
                const rect = fab.getBoundingClientRect();
                saveFabPosition({ left: rect.left, top: rect.top });
            }
        }

        function onPointerDown(e) {
            if (fab.disabled) return;
            isDragging = false;
            fab.dataset.dragged = '0';
            const p = e.touches ? e.touches[0] : e;
            startX = p.clientX;
            startY = p.clientY;
            const rect = fab.getBoundingClientRect();
            origLeft = rect.left;
            origTop  = rect.top;

            document.addEventListener('mousemove', onPointerMove);
            document.addEventListener('mouseup', onPointerUp);
            document.addEventListener('touchmove', onPointerMove, { passive: false });
            document.addEventListener('touchend', onPointerUp);
        }

        fab.addEventListener('mousedown', onPointerDown);
        fab.addEventListener('touchstart', onPointerDown, { passive: true });
    }

    function addFab() {
        const table = document.getElementById('quickedittable');
        const fab   = document.createElement('button');
        fab.id = 'qa-extract-fab';
        fab.innerHTML = (table ? 'Extract Data' : 'No Table Found')
            + `<span class="qa-version-chip">v${TOOLKIT_VERSION}</span>`;
        fab.disabled = !table;
        document.body.appendChild(fab);

        // Restore a previously dragged position; otherwise CSS default (bottom-left) applies.
        const saved = loadFabPosition();
        if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
            applyFabPosition(fab, saved.left, saved.top);
            clampFabToViewport(fab);
        }

        makeFabDraggable(fab);

        fab.addEventListener('click', (e) => {
            if (fab.dataset.dragged === '1') {
                fab.dataset.dragged = '0';
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            openModal();
        });

        window.addEventListener('resize', () => {
            if (fab.style.left) clampFabToViewport(fab);
        });
    }

    /* ============================================================
       INIT
    ============================================================ */
    function init() {
        if (document.getElementById('qa-extract-fab')) return;
        injectStyle();
        initTagSearch();
        addFab();
    }

    init();
})();
