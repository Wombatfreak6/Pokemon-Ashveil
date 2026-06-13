import Phaser from "phaser";
import type { DialogueSequence } from "@systems/DialogueTypes";

/**
 * DialogueBox — GBA-style text box pinned to the bottom of the screen.
 *
 * LAYOUT (at 240×160 native resolution):
 *   ┌──────────────────────────────────────────┐  ← y = 108 (108px from top)
 *   │  [Speaker name]                          │
 *   │  Line text (word-wrapped, max ~34 chars  │
 *   │  per row at this font size)              │
 *   │                                      ▼  │  ← continue indicator
 *   └──────────────────────────────────────────┘  ← y = 160 (screen bottom)
 *
 * The box is 240×52 px — the bottom ~1/3 of the GBA screen.
 *
 * RENDERING
 * =========
 * Uses Phaser.GameObjects.Text with a pixel-art-friendly monospace font
 * (browser built-in "monospace" family — no external font file needed).
 * Word-wrap is configured via Phaser's built-in wordWrap style property.
 * All elements use setScrollFactor(0) so they stay fixed to the screen
 * regardless of camera position.
 *
 * TYPEWRITER EFFECT
 * =================
 * Text is revealed character-by-character at CHARS_PER_SEC speed.
 * While revealing: confirm = skip to full text instantly.
 * After fully revealed: confirm = advance to next line (or close box).
 *
 * CONFIRM INPUT
 * =============
 * Edge-triggered via InputController.getConfirmJustPressed().
 * DialogueBox.update() must be called each frame from OverworldScene.update().
 */

/** Pixels per second: one character revealed every ~35ms ≈ 28 chars/sec */
const CHARS_PER_SEC = 28;

/** Native GBA screen dimensions */
const SCREEN_W = 240;
const SCREEN_H = 160;

/** Dialogue box dimensions and position */
const BOX_H = 52;
const BOX_Y = SCREEN_H - BOX_H; // 108
const BOX_PADDING = 6;

/** Wrap width in pixels (box width minus left/right padding) */
const WRAP_WIDTH = SCREEN_W - BOX_PADDING * 2;

export class DialogueBox {
  // ─── Phaser GameObjects ─────────────────────────────────────────────────────
  private background: Phaser.GameObjects.Rectangle;
  private border: Phaser.GameObjects.Rectangle;
  private speakerText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private continueIndicator: Phaser.GameObjects.Text;

  // ─── State ───────────────────────────────────────────────────────────────────
  private active = false;
  private sequence: DialogueSequence | null = null;
  private lineIndex = 0;
  private pages: string[] = [];
  private pageIndex = 0;

  /** Revealed character count (float, accumulates fractional chars per frame) */
  private revealCount = 0;
  /** Full text of the current line */
  private fullText = "";
  /** Is the current line fully revealed? */
  private lineComplete = false;

  /** Timer for the blinking continue indicator */
  private blinkTimer = 0;
  private blinkVisible = true;

  constructor(scene: Phaser.Scene) {
    const depth = 20; // above everything else

    const bgX = Math.round(0);
    const bgY = Math.round(BOX_Y);
    const bgW = Math.round(SCREEN_W);
    const bgH = Math.round(BOX_H);

    const speakX = Math.round(BOX_PADDING);
    const speakY = Math.round(BOX_Y + 2);

    const bodyX = Math.round(BOX_PADDING);
    const bodyY = Math.round(BOX_Y + 16);

    const indX = Math.round(SCREEN_W - BOX_PADDING - 12);
    const indY = Math.round(SCREEN_H - 4);

    // ── Background ─────────────────────────────────────────────────────────────
    this.background = scene.add
      .rectangle(bgX, bgY, bgW, bgH, 0x0a0a1e, 0.9)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth);

    // ── Border ─────────────────────────────────────────────────────────────────
    this.border = scene.add
      .rectangle(bgX, bgY, bgW, bgH, 0x4466aa, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth)
      .setStrokeStyle(1.5, 0x6688cc, 1);

    // ── Speaker name ───────────────────────────────────────────────────────────
    this.speakerText = scene.add
      .text(speakX, speakY, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffdd66",
      })
      .setScrollFactor(0)
      .setDepth(depth + 1);

    // ── Body text ──────────────────────────────────────────────────────────────
    this.bodyText = scene.add
      .text(bodyX, bodyY, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#e8e8f0",
        wordWrap: { width: WRAP_WIDTH, useAdvancedWrap: true },
        lineSpacing: 1,
      })
      .setScrollFactor(0)
      .setDepth(depth + 1);

    // ── Continue indicator ─────────────────────────────────────────────────────
    // A small blinking "▼" in the bottom-right corner of the box
    this.continueIndicator = scene.add
      .text(indX, indY, "▼", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#aabbdd",
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(depth + 1)
      .setVisible(false);

    this.hide();
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Begin displaying a dialogue sequence.
   * Resets all state and shows the first line.
   */
  show(sequence: DialogueSequence): void {
    this.sequence = sequence;
    this.lineIndex = 0;
    this.active = true;
    this.setAllVisible(true);
    this.showLine(0);
  }

  /**
   * Advance the dialogue:
   * - If the current line is still revealing → skip to full text
   * - If the current line is fully revealed → go to next line or close
   *
   * Call this when the confirm key is just-pressed.
   */
  advance(): void {
    if (!this.active || !this.sequence) return;

    if (!this.lineComplete) {
      // Skip reveal: show all text immediately
      this.revealCount = this.fullText.length;
      this.bodyText.setText(this.fullText);
      this.lineComplete = true;
      this.continueIndicator.setVisible(true);
      return;
    }

    // Check if there are more pages in the current line
    const nextPageIndex = this.pageIndex + 1;
    if (nextPageIndex < this.pages.length) {
      this.showPage(nextPageIndex);
      return;
    }

    // Move to next line
    const nextLineIndex = this.lineIndex + 1;
    if (nextLineIndex < this.sequence.lines.length) {
      this.showLine(nextLineIndex);
    } else {
      this.hide();
    }
  }

  /** Returns true while the dialogue box is visible and blocking input. */
  isActive(): boolean {
    return this.active;
  }

  /** Immediately closes the dialogue box and resets state. */
  hide(): void {
    this.active = false;
    this.sequence = null;
    this.setAllVisible(false);
  }

  /**
   * Call every frame from OverworldScene.update().
   * Handles typewriter reveal timing and continue indicator blinking.
   *
   * @param delta — frame delta in milliseconds (from Phaser's update signature)
   */
  update(delta: number): void {
    if (!this.active) return;

    // ── Typewriter reveal ──────────────────────────────────────────────────────
    if (!this.lineComplete) {
      this.revealCount += (CHARS_PER_SEC * delta) / 1000;
      const charsToShow = Math.min(
        Math.floor(this.revealCount),
        this.fullText.length
      );
      this.bodyText.setText(this.fullText.substring(0, charsToShow));

      if (charsToShow >= this.fullText.length) {
        this.lineComplete = true;
        this.continueIndicator.setVisible(true);
      }
    }

    // ── Blink the continue indicator ───────────────────────────────────────────
    if (this.lineComplete) {
      this.blinkTimer += delta;
      if (this.blinkTimer >= 500) {
        this.blinkTimer = 0;
        this.blinkVisible = !this.blinkVisible;
        this.continueIndicator.setVisible(this.blinkVisible);
      }
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private showLine(index: number): void {
    if (!this.sequence) return;

    this.lineIndex = index;
    const line = this.sequence.lines[index];

    // Speaker name (empty string hides it)
    this.speakerText.setText(line.speaker ?? "");

    // Pre-process current line into pages (maximum 2 lines per page)
    const rawText = line.text;
    const wrapped = this.bodyText.runWordWrap(rawText);
    const lines = wrapped.split("\n");

    this.pages = [];
    for (let i = 0; i < lines.length; i += 2) {
      const pageLines = lines.slice(i, i + 2);
      this.pages.push(pageLines.join("\n"));
    }
    if (this.pages.length === 0) {
      this.pages.push("");
    }

    this.showPage(0);
  }

  private showPage(index: number): void {
    this.pageIndex = index;
    this.fullText = this.pages[index];

    // Reset typewriter state
    this.revealCount = 0;
    this.lineComplete = false;
    this.bodyText.setText("");
    this.continueIndicator.setVisible(false);
    this.blinkTimer = 0;
    this.blinkVisible = true;
  }

  private setAllVisible(visible: boolean): void {
    this.background.setVisible(visible);
    this.border.setVisible(visible);
    this.speakerText.setVisible(visible);
    this.bodyText.setVisible(visible);
    this.continueIndicator.setVisible(false); // always starts hidden
  }
}
