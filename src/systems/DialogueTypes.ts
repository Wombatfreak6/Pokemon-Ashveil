/**
 * DialogueTypes.ts — TypeScript interfaces for the JSON-driven dialogue system.
 *
 * The dialogue data lives in /src/data/dialogue/*.json.
 * These interfaces define the shape of that data and are imported by
 * DialogueBox.ts and OverworldScene.ts.
 *
 * Future extensions (branching choices, flags, etc.) should be added here
 * rather than hardcoded in scene logic.
 */

/** A single line of dialogue shown in the text box. */
export interface DialogueLine {
  /** Optional speaker name shown above the text area (e.g. "Old Man"). */
  speaker?: string;
  /** The text content of this line. Long text will be word-wrapped by DialogueBox. */
  text: string;
}

/** An ordered sequence of dialogue lines triggered by a single NPC interaction. */
export interface DialogueSequence {
  /** Unique identifier — must match the dialogueId custom property on the Tiled NPC object. */
  id: string;
  /** Lines shown one at a time, advancing on confirm input. */
  lines: DialogueLine[];
}
