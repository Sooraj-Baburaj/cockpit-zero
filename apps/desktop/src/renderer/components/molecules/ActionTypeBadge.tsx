import type { ActionKind } from '@cockpitzero/shared';
import { Badge } from '../atoms/Badge.js';
import { actionTypeLabel } from '../../lib/format.js';

/** A Badge labelled with the human name of an action kind, in that kind's hue. */
export function ActionTypeBadge({ kind }: { kind: ActionKind }) {
  return <Badge>{actionTypeLabel[kind]}</Badge>;
}
