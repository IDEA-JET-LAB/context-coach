'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';

export type RuleOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'matches';
export type RuleJoiner = 'AND' | 'OR';

export interface Rule {
  id: string;
  field: string;
  operator: RuleOperator;
  value: string;
}

export interface RuleGroup {
  id: string;
  joiner: RuleJoiner;
  rules: Rule[];
}

export interface RuleEditorProps {
  /** Current rules */
  value: RuleGroup;
  /** Change handler */
  onChange: (value: RuleGroup) => void;
  /** Available fields to select from */
  fields: { value: string; label: string }[];
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

const OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'greater_than', label: 'is greater than' },
  { value: 'less_than', label: 'is less than' },
  { value: 'matches', label: 'matches regex' },
];

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function RuleEditor({
  value,
  onChange,
  fields,
  disabled = false,
  className,
}: RuleEditorProps) {
  const addRule = () => {
    const firstField = fields[0];
    if (!firstField) return;

    const newRule: Rule = {
      id: generateId(),
      field: firstField.value,
      operator: 'equals',
      value: '',
    };
    onChange({
      ...value,
      rules: [...value.rules, newRule],
    });
  };

  const updateRule = (ruleId: string, updates: Partial<Rule>) => {
    onChange({
      ...value,
      rules: value.rules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...updates } : rule
      ),
    });
  };

  const removeRule = (ruleId: string) => {
    onChange({
      ...value,
      rules: value.rules.filter((rule) => rule.id !== ruleId),
    });
  };

  const toggleJoiner = () => {
    onChange({
      ...value,
      joiner: value.joiner === 'AND' ? 'OR' : 'AND',
    });
  };

  return (
    <div className={cn('space-y-4', className)} data-testid="rule-editor">
      {value.rules.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Match</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleJoiner}
            disabled={disabled}
            className="h-7 px-2"
          >
            {value.joiner === 'AND' ? 'ALL' : 'ANY'}
          </Button>
          <span className="text-sm text-muted-foreground">of the following rules</span>
        </div>
      )}

      <div className="space-y-3">
        {value.rules.map((rule, index) => (
          <div
            key={rule.id}
            className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card"
            data-testid={`rule-${index}`}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />

            {index > 0 && (
              <span className="text-xs font-medium text-primary px-2 py-0.5 rounded bg-primary/10">
                {value.joiner}
              </span>
            )}

            <Select
              value={rule.field}
              onValueChange={(val) => updateRule(rule.id, { field: val })}
              disabled={disabled}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fields.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={rule.operator}
              onValueChange={(val) => updateRule(rule.id, { operator: val as RuleOperator })}
              disabled={disabled}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={rule.value}
              onChange={(e) => updateRule(rule.id, { value: e.target.value })}
              placeholder="Enter value..."
              disabled={disabled}
              className="flex-1"
            />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeRule(rule.id)}
              disabled={disabled || value.rules.length === 1}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRule}
        disabled={disabled}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Rule
      </Button>
    </div>
  );
}
