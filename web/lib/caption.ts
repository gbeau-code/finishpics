/**
 * caption.ts — auto-generated caption + hashtags for the Social Studio
 * (copy logic from the prototype, Photo Page v2.dc.html)
 */

import type { GraphicTag } from './graphic-spec'
import { TAG_LABELS } from './graphic-spec'

export interface CaptionInput {
  timeLabel:  string | null
  eventLabel: string
  meetName:   string
  team:       string | null
  tag:        GraphicTag
}

export function buildCaption(input: CaptionInput): { caption: string; hashtags: string } {
  const { timeLabel, eventLabel, meetName, team, tag } = input

  const tagLabel = TAG_LABELS[tag]
  // "Crossed the line in 8:45.06, Boys 3000 Meter Run, RI State Championships. Personal best."
  const caption = [
    timeLabel
      ? `Crossed the line in ${timeLabel}, ${eventLabel}, ${meetName}.`
      : `${eventLabel}, ${meetName}.`,
    tagLabel ? `${titleCase(tagLabel)}.` : null,
  ].filter(Boolean).join(' ')

  const teamTag = team ? `#${team.toLowerCase().replace(/[^a-z]/g, '')}` : null
  const hashtags = ['#trackandfield', '#photofinish', '#finishpics', teamTag]
    .filter(Boolean).join(' ')

  return { caption, hashtags }
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|\s)\w/g, (c) => c.toUpperCase())
}
