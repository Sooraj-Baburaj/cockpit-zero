'use client';

import { OpenAppDemo } from './OpenAppDemo';
import { RunCommandDemo } from './RunCommandDemo';
import { WorkflowDemo } from './WorkflowDemo';
import { MemoryDemo } from './MemoryDemo';

/**
 * Maps a "How it works" step (the shared STEPS order: Search → Actions →
 * Workflows → AI Cockpit) to its live demo. Used by the home stepper and the
 * product feature bands so both surfaces stay in sync.
 */
export function StepMedia({ index, frameless = false }: { index: number; frameless?: boolean }) {
  switch (index) {
    case 0:
      return <OpenAppDemo frameless={frameless} />;
    case 1:
      return <RunCommandDemo frameless={frameless} />;
    case 2:
      return <WorkflowDemo frameless={frameless} />;
    default:
      return <MemoryDemo frameless={frameless} />;
  }
}
