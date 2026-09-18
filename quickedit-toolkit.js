// @toolkit-version 8.3
// GATE Overflow Quickedit Toolkit — Remote Payload
// Fetched & executed by the Loader userscript. Not meant to be installed directly in Tampermonkey.

(function () {
    'use strict';

    const TOOLKIT_VERSION = '8.3';

    /* ============================================================
       STATE
    ============================================================ */
    const state = {
        original: [],
        working: [],
        history: [],
        itemStatus: {},
        lockNonFailed: false,
        hasCompletedRun: false,
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
    :root {
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

    body.qa-modal-open > *:not(#qa-modal-overlay):not(#qa-extract-fab) { display: none !important; }

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
        position: fixed; bottom: 28px; left: 28px; z-index: 999998;
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
        z-index: 999999; display: flex; align-items: center; justify-content: center;
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
        opacity: 0; pointer-events: none; transition: all 0.25s ease; z-index: 10;
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
        state.working.forEach((item, idx) => {
            item.questionTitle = baseline.mode === 'colon'
                ? baseline.perItemPrefix[idx] + formatNumber(startVal + idx, padWidth) + baseline.suffix
                : baseline.prefix + formatNumber(startVal + idx, padWidth) + baseline.suffix;
            if (state.itemStatus[idx] === 'success') delete state.itemStatus[idx];
        });
    }

    function revertRenumbering() {
        if (!state.renumberBaseline) return;
        pushHistory();
        state.working.forEach((item, idx) => {
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
                const questionTitle = cells[3].lastChild.firstChild.value;
                const tag           = cells[5].firstChild.firstChild.value;
                list.push({ postID, questionTitle, tag });
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
        const data = state.working;
        if (!data.length) {
            return `<p style="color:var(--qa-text-secondary);text-align:center;padding:40px 0;">
                No data. Click "Extract Data" after selecting a tag on the page.
            </p>`;
        }

        return `<div class="qa-card-list">` + data.map((item, idx) => {
            const status   = state.itemStatus[idx];
            const isFailed = status === 'failed';
            const isLocked = state.lockNonFailed && status === 'success';
            const disabledAttr = isLocked ? 'disabled' : '';

            const cardClasses = ['qa-card'];
            if (isFailed) cardClasses.push('qa-card-failed');
            if (isLocked) cardClasses.push('qa-card-locked');

            const badge = isFailed
                ? `<span class="qa-status-badge qa-status-failed">Failed</span>`
                : (isLocked ? `<span class="qa-status-badge qa-status-locked">🔒 Locked</span>` : '');

            return `
            <div class="${cardClasses.join(' ')}" data-idx="${idx}">
                <div class="qa-card-meta">
                    <span class="qa-card-index">#${idx + 1}</span>
                    ${badge}
                </div>
                <div class="qa-card-row">
                    <span class="qa-card-label">Post ID</span>
                    <span class="qa-card-value qa-card-static">${escapeHtml(item.postID)}</span>
                </div>
                <div class="qa-card-row">
                    <span class="qa-card-label">Title</span>
                    <span class="qa-card-value">
                        <input class="qa-edit-input" type="text"
                            data-field="questionTitle" data-idx="${idx}"
                            value="${escapeHtml(item.questionTitle)}" ${disabledAttr}>
                    </span>
                </div>
                <div class="qa-card-row">
                    <span class="qa-card-label">Tags</span>
                    <span class="qa-card-value">
                        <input class="qa-edit-input" type="text"
                            data-field="tag" data-idx="${idx}"
                            value="${escapeHtml(item.tag)}" ${disabledAttr}>
                        <div class="qa-chip-preview" data-chip-preview="${idx}">${renderTagChips(item.tag)}</div>
                    </span>
                </div>
            </div>`;
        }).join('') + `</div>`;
    }

    /* ============================================================
       MODAL BUILD
    ============================================================ */
    function buildModal() {
        const overlay = document.createElement('div');
        overlay.id = 'qa-modal-overlay';
        overlay.innerHTML = `
            <div id="qa-modal">
                <div id="qa-toast"></div>

                <div id="qa-modal-header">
                    <h2>Quickedit Toolkit <span class="qa-header-version">v${TOOLKIT_VERSION}</span></h2>
                    <button id="qa-modal-close" title="Close">&#10005;</button>
                </div>

                <div id="qa-tabs">
                    <button class="qa-tab-btn qa-active" data-tab="visual">Visualized</button>
                    <button class="qa-tab-btn" data-tab="run">Run Updates</button>
                    <button class="qa-tab-btn" data-tab="hide" id="qa-tab-hide-btn">🔒 Hide Questions</button>
                </div>

                <div id="qa-toolbar">
                    <div class="qa-toolbar-group">
                        <div class="qa-field-stack">
                            <label>Field</label>
                            <select id="qa-fr-field">
                                <option value="questionTitle">Title</option>
                                <option value="tag">Tag</option>
                                <option value="both">Both</option>
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
                        <button class="qa-btn-sm" id="qa-fr-apply">Replace All</button>
                    </div>

                    <div class="qa-toolbar-group">
                        <div class="qa-field-stack">
                            <label>Range From</label>
                            <input type="number" id="qa-range-from" min="1" value="1">
                        </div>
                        <div class="qa-field-stack">
                            <label>To</label>
                            <input type="number" id="qa-range-to" min="1">
                        </div>
                        <button class="qa-btn-sm" id="qa-range-apply">Apply</button>
                        <button class="qa-btn-sm qa-secondary" id="qa-renumber-open">🔢 Smart Renumber</button>
                    </div>

                    <div class="qa-toolbar-group">
                        <div class="qa-field-stack">
                            <label>Bulk Tag</label>
                            <input type="text" id="qa-bulk-tag" placeholder="tag-name">
                        </div>
                        <button class="qa-btn-sm" id="qa-bulk-add">+ Add to All</button>
                        <button class="qa-btn-sm qa-danger" id="qa-bulk-remove">− Remove from All</button>
                    </div>

                    <div id="qa-toolbar-right">
                        <button class="qa-btn-sm qa-secondary" id="qa-undo-btn">↩ Undo</button>
                        <button class="qa-btn-sm qa-secondary" id="qa-reset-data">Reset to Original</button>
                    </div>
                </div>

                <div id="qa-modal-body">
                    <div class="qa-tab-panel qa-active" data-panel="visual">
                        <div id="qa-renumber-panel" class="qa-renumber-panel qa-hidden">
                            <div class="qa-renumber-header">
                                <strong>🔢 Smart Renumber</strong>
                                <div class="qa-renumber-header-actions">
                                    <button class="qa-btn-sm qa-secondary" id="qa-renumber-redetect">🔄 Re-detect Pattern</button>
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
                                <button class="qa-btn-sm qa-secondary" id="qa-view-toggle">🔧 Technical Log</button>
                                <div class="qa-run-buttons">
                                    <button class="qa-btn qa-btn-start" id="qa-run-start">▶ Start</button>
                                    <button class="qa-btn qa-btn-pause" id="qa-run-pause" disabled>⏸ Pause</button>
                                    <button class="qa-btn qa-btn-stop"  id="qa-run-stop"  disabled>■ Stop</button>
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
                                    Sends a request to <code>/create-st</code> with <code>onlyhideqns=1</code>
                                    to hide questions under the selected tag. The tag list is pulled live
                                    from your updated records.
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
                                    <input type="text" id="qa-hide-userid" placeholder="e.g. 181161">
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
                    <button id="qa-copy-btn">Copy JSON</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    /* ============================================================
       MODAL LOGIC
    ============================================================ */
    let overlayEl = null;

    function q(sel) { return overlayEl.querySelector(sel); }

    function pushHistory() {
        state.history.push(deepClone(state.working));
        if (state.history.length > 25) state.history.shift();
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
            showToast('🔢 Smart Renumber pattern detected — review before applying.');
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
            : `<code title="${escapeHtml(baseline.prefix)}">${escapeHtml(truncateMiddle(baseline.prefix, 42))}</code>
               <span class="qa-renumber-num-slot">[N]</span>
               <code title="${escapeHtml(suffix)}">${escapeHtml(truncateMiddle(suffix, 20)) || '(none)'}</code>`;

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
            html += commonTags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
            html += `</optgroup>`;
        }
        const otherTags = allTags.filter(t => !commonTags.includes(t));
        if (otherTags.length) {
            html += `<optgroup label="Other tags used">`;
            html += otherTags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
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
        q('#qa-hide-userid').value   = saved.userid   || tryDetectUserId() || '';
        q('#qa-hide-count').value    = saved.count    ?? (state.working.length || 60);
        q('#qa-hide-start').value    = saved.start    ?? 1;
        q('#qa-hide-onlyhideqns').checked = saved.onlyhideqns !== false;
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
        tabBtn.textContent = unlocked ? 'Hide Questions' : '🔒 Hide Questions';

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

    function renderAll() {
        q('#qa-cards-container').innerHTML = renderCards();
        renderLockBar();
        updateHideTabAvailability();

        const { total } = computeStats();
        q('#qa-record-count').textContent = `${total} record${total !== 1 ? 's' : ''}`;
        q('#qa-range-to').value = total || '';
        q('#qa-undo-btn').disabled = state.history.length === 0;
        q('#qa-undo-btn').style.opacity = state.history.length === 0 ? '0.5' : '1';
        updateProgressUI();
    }

    function switchTab(tabName) {
        overlayEl.querySelectorAll('.qa-tab-btn').forEach(b => b.classList.toggle('qa-active', b.dataset.tab === tabName));
        overlayEl.querySelectorAll('.qa-tab-panel').forEach(p => p.classList.toggle('qa-active', p.dataset.panel === tabName));
        q('#qa-toolbar').classList.toggle('qa-hidden', tabName === 'run' || tabName === 'hide');
    }

    function openModal() {
        if (overlayEl && state.isRunning) {
            document.body.classList.add('qa-modal-open');
            requestAnimationFrame(() => overlayEl.classList.add('qa-visible'));
            return;
        }

        const data = extractData();
        console.log(data);

        state.original               = data;
        state.working                = deepClone(data);
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
        q('#qa-view-toggle').textContent = '🔧 Technical Log';
        q('#qa-renumber-panel').classList.add('qa-hidden');
        hideBanner();
        initHideForm();
        updateRunButtons();
        switchTab('visual');

        document.body.classList.add('qa-modal-open');
        requestAnimationFrame(() => overlayEl.classList.add('qa-visible'));
    }

    function closeModal() {
        if (!overlayEl) return;
        overlayEl.classList.remove('qa-visible');
        setTimeout(() => document.body.classList.remove('qa-modal-open'), 260);
    }

    function wireModalEvents() {
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
            if (e.target.matches('.qa-edit-input[data-field="tag"]')) {
                const preview = overlayEl.querySelector(`[data-chip-preview="${e.target.dataset.idx}"]`);
                if (preview) preview.innerHTML = renderTagChips(e.target.value);
            }
        });

        visualPanel.addEventListener('change', (e) => {
            if (!e.target.matches('.qa-edit-input') || e.target.disabled) return;
            const idx   = parseInt(e.target.dataset.idx, 10);
            const field = e.target.dataset.field;
            const newVal = e.target.value;
            if (newVal === e.target.dataset.prev) return;

            pushHistory();
            state.working[idx][field] = newVal;

            let statusReverted = false;
            if (state.itemStatus[idx] === 'success') {
                delete state.itemStatus[idx];
                statusReverted = true;
            }

            renderAll();
            if (statusReverted) showToast('✏️ Edited a completed item — it will be resent on the next run.');
        });

        /* Find & Replace */
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

            state.working.forEach((item, idx) => {
                let itemChanged = false;
                const applyTo = (str) => {
                    if (typeof str !== 'string') return str;
                    let didMatch = false, result;
                    if (useRegex) {
                        result = str.replace(matcher, () => {
                            didMatch = true;
                            return useAutoNumber ? replaceRaw.replace('{{n}}', counter) : replaceRaw;
                        });
                    } else {
                        if (str.includes(find)) {
                            didMatch = true;
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

                if (itemChanged) {
                    changedIndices.push(idx);
                    if (state.itemStatus[idx] === 'success') delete state.itemStatus[idx];
                }
            });

            if (!changedIndices.length) {
                state.history.pop();
                return showToast('No matches found — nothing changed.');
            }

            renderAll();
            flashCards(changedIndices);
            showToast(`✅ Updated ${changedIndices.length} record${changedIndices.length !== 1 ? 's' : ''}.`);
        };

        /* Range slice */
        q('#qa-range-apply').onclick = () => {
            const from = parseInt(q('#qa-range-from').value, 10);
            const to   = parseInt(q('#qa-range-to').value,   10);
            if (!from || !to || from < 1 || to < from || to > state.working.length)
                return showToast(`⚠️ Enter a valid range between 1 and ${state.working.length}.`);

            pushHistory();
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
            openRenumberPanel(true, true);
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
                const tags = (item.tag || '').split(',').map(t => t.trim()).filter(Boolean);
                if (!tags.includes(tag)) {
                    tags.push(tag); item.tag = tags.join(','); count++;
                    if (state.itemStatus[idx] === 'success') delete state.itemStatus[idx];
                }
            });
            renderAll();
            showToast(`Added "${tag}" to ${count} record${count !== 1 ? 's' : ''}.`);
        };

        q('#qa-bulk-remove').onclick = () => {
            const tag = q('#qa-bulk-tag').value.trim();
            if (!tag) return showToast('⚠️ Enter a tag name first.');
            pushHistory();
            let count = 0;
            state.working.forEach((item, idx) => {
                const tags = (item.tag || '').split(',').map(t => t.trim()).filter(Boolean);
                if (tags.includes(tag)) {
                    item.tag = tags.filter(t => t !== tag).join(','); count++;
                    if (state.itemStatus[idx] === 'success') delete state.itemStatus[idx];
                }
            });
            renderAll();
            showToast(`Removed "${tag}" from ${count} record${count !== 1 ? 's' : ''}.`);
        };

        /* Undo */
        q('#qa-undo-btn').onclick = () => {
            if (!state.history.length) return;
            state.working = state.history.pop();
            renderAll();
            showToast('↩ Undone.');
        };

        /* Reset */
        q('#qa-reset-data').onclick = () => {
            if (!confirm('Discard all edits and restore the originally extracted data?')) return;
            pushHistory();
            state.working       = deepClone(state.original);
            state.itemStatus    = {};
            state.lockNonFailed = false;
            resetRenumberState(true);
            renderAll();
            showToast('Reset to original extracted data.');
        };

        /* Copy JSON */
        const copyBtn = q('#qa-copy-btn');
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(JSON.stringify(state.working, null, 2)).then(() => {
                const orig = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                copyBtn.classList.add('qa-copied');
                setTimeout(() => { copyBtn.textContent = orig; copyBtn.classList.remove('qa-copied'); }, 1500);
            });
        };

        /* View toggle */
        q('#qa-view-toggle').onclick = () => {
            const feed = q('#qa-simple-feed');
            const log  = q('#qa-log-console');
            const showingSimple = feed.classList.contains('qa-active');
            feed.classList.toggle('qa-active', !showingSimple);
            log.classList.toggle('qa-active',  showingSimple);
            q('#qa-view-toggle').textContent = showingSimple ? '🙂 Simple View' : '🔧 Technical Log';
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
            ? `<button class="qa-btn-sm"          id="qa-banner-resume">▶ Resume</button>
               <button class="qa-btn-sm qa-danger" id="qa-banner-stop">■ Stop</button>`
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

    function updateProgressUI() {
        if (!overlayEl) return;
        const { total, success, failed, remaining } = computeStats();
        const pct = total ? Math.round((success / total) * 100) : 0;

        q('#qa-progress-fill').style.width  = pct + '%';
        q('#qa-progress-text').textContent  = `${success} / ${total} (${pct}%)`;
        q('#qa-stat-success').textContent   = success;
        q('#qa-stat-failed').textContent    = failed;
        q('#qa-stat-remaining').textContent = remaining;
    }

    function updateRunButtons() {
        if (!overlayEl) return;
        q('#qa-run-start').disabled = state.isRunning;
        q('#qa-run-pause').disabled = !state.isRunning;
        q('#qa-run-stop').disabled  = !state.isRunning;
        q('#qa-run-pause').textContent = state.isPaused ? '▶ Resume' : '⏸ Pause';

        const { total, failed, remaining } = computeStats();
        let statusText = 'Idle';
        if (state.isRunning) statusText = state.isPaused ? 'Paused' : 'Running…';
        else if (total > 0 && remaining === 0) statusText = failed > 0 ? 'Needs Attention' : 'Completed';
        q('#qa-progress-status').textContent = statusText;
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
                showBanner('generic', `${stats.failed} item(s) failed. Fix them in the Visualized tab, then click Start to retry.`);
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

        state.minDelay = parseFloat(q('#qa-min-delay').value) || 0;
        state.maxDelay = parseFloat(q('#qa-max-delay').value) || state.minDelay;
        if (state.maxDelay < state.minDelay) state.maxDelay = state.minDelay;

        if (!confirm(`This will send LIVE update requests for ${toProcess} question(s) to GATE Overflow. Continue?`)) return;

        state.isPaused = false;
        runLoop();
    }

    function onPauseResume() {
        state.isPaused = !state.isPaused;
        appendLog(state.isPaused ? '⏸ Paused.' : '▶ Resumed.', 'warn');
        updateRunButtons();
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
        injectStyle();
        initTagSearch();
        addFab();
    }

    init();
})();