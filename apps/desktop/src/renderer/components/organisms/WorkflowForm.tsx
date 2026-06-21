import { useState } from 'react';
import { createId, type Action, type Workflow } from '@cockpitzero/shared';
import { Button } from '../atoms/Button.js';
import { Field } from '../atoms/Field.js';
import { Input } from '../atoms/Input.js';
import { Dropdown } from '../molecules/Dropdown.js';
import { EmptyState } from '../atoms/EmptyState.js';

/**
 * Create/edit a workflow: a name plus an ordered list of steps, each step an
 * existing action. Steps can be added, reordered and removed. Validation is
 * light (a name + at least one step) — WorkflowSchema enforces the rest on save.
 */
export function WorkflowForm({
  initial,
  actions,
  onSubmit,
  onCancel,
}: {
  initial?: Workflow;
  actions: Action[];
  onSubmit: (workflow: Workflow) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [steps, setSteps] = useState<string[]>(initial?.steps ?? []);

  const addStep = () => {
    const first = actions[0];
    if (first) setSteps((s) => [...s, first.id]);
  };
  const setStep = (index: number, id: string) =>
    setSteps((s) => s.map((value, i) => (i === index ? id : value)));
  const removeStep = (index: number) => setSteps((s) => s.filter((_, i) => i !== index));
  const move = (index: number, dir: -1 | 1) =>
    setSteps((s) => {
      const target = index + dir;
      if (target < 0 || target >= s.length) return s;
      const copy = [...s];
      [copy[index], copy[target]] = [copy[target]!, copy[index]!];
      return copy;
    });

  const canSave = name.trim() !== '' && steps.length > 0;
  const save = () => {
    if (!canSave) return;
    onSubmit({ id: initial?.id ?? createId('wf'), name: name.trim(), steps });
  };

  if (actions.length === 0) {
    return (
      <EmptyState
        title="No actions to chain"
        hint="Create an action first, then build a workflow."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Morning routine"
        />
      </Field>

      <div className="space-y-2">
        <span className="block text-sm font-medium text-fg">Steps</span>
        {steps.length === 0 && <p className="text-xs text-subtle">Add actions to run in order.</p>}

        {steps.map((stepId, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-center text-xs text-subtle">{index + 1}</span>
            <Dropdown
              ariaLabel={`Step ${index + 1} action`}
              className="flex-1"
              value={stepId}
              options={actions.map((a) => ({ value: a.id, label: a.title }))}
              onChange={(v) => setStep(index, v)}
            />
            <Button
              size="sm"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label="Move up"
            >
              ↑
            </Button>
            <Button
              size="sm"
              onClick={() => move(index, 1)}
              disabled={index === steps.length - 1}
              aria-label="Move down"
            >
              ↓
            </Button>
            <Button variant="danger" size="sm" onClick={() => removeStep(index)}>
              Remove
            </Button>
          </div>
        ))}

        <Button onClick={addStep}>Add step</Button>
      </div>

      <div className="flex gap-2">
        <Button variant="primary" onClick={save} disabled={!canSave}>
          Save workflow
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
