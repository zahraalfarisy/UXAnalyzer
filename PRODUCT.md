# UX Analyzer

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

UX researchers and evaluators conducting usability sessions for a thesis project. The user confirmed this audience and purpose on 25 October 2026.

## Product Purpose

Support the workflow of calibrating webcam eye tracking, recording a participant's screen together with gaze and mouse activity, and reviewing the resulting evidence to evaluate a user interface.

## Operating Context

- Local research workspace with a React/Vite frontend and Python/FastAPI backend.
- Current development environment is Windows. Recording uses the local webcam and main screen.
- Workflow: Calibrate → Record → Sessions → review screenshots, heatmaps, playback and friction events.
- Session data is stored locally under `data/sessions/<session_id>/`.

## Capabilities and Constraints

- Calibration, validation and preview precede recording; the most recently saved calibration can be reused.
- Recording combines screen video, timestamped gaze samples, gaze-quality diagnostics and mouse events.
- Playback synchronizes screen video with gaze and mouse markers.
- The Heatmap tab uses static screenshots for distinct visible page layouts. Gaze from matching visits is combined on each screenshot.
- Heatmap smoothing is fixed; the user explicitly requested no customization controls.
- Screenshots are grouped by visual similarity, not browser URL or DOM. Different scroll positions can be separate layouts.
- Existing recordings can supply screenshots; sessions with no valid gaze cannot recover eye-tracking evidence retrospectively.
- Friction events are heuristic candidates, including rage clicks and gaze–mouse mismatch. They are not proof of a usability problem.
- Accuracy depends on calibration, camera visibility and consistent recording conditions. Missing gaze and tracking failures must remain visible.

## Brand Commitments

The product name is UX Analyzer. No new visual direction was requested during initialization; existing appearance is evidence for future refinement, not a newly confirmed brand constraint.

## Evidence on Hand

- Implemented frontend routes and local API in `frontend/src/` and `api/`.
- Local calibration reports and session artifacts in `data/`.
- Hardware-free regression tests for session recording, screenshot grouping and gaze timelines in `tests/` and frontend component tests.
- Earlier screenshots shared by the user and a code-based Stroom audit in `output/ui-audit/`.
- No confirmed external customers, testimonials, validated research outcomes or independently established product benchmarks. Do not invent them.

## Product Principles

1. Preserve the complete calibrate–record–review workflow.
2. Relate gaze to the screen content visible at that time.
3. Make recording readiness, tracking quality and missing evidence understandable.
4. Keep screenshot heatmap review simple, with fixed smoothing.
5. Keep local research evidence and heuristic interpretations distinguishable.

## Open Decisions

Deployment beyond the local environment, additional user roles, formal accessibility targets and semantic page identification have not been confirmed.
