'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileJson, FileText, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  selected?: boolean;
  disabled?: boolean;
}

export interface FileTreeProps {
  /** Tree data */
  data: FileTreeNode[];
  /** Selected file IDs */
  selectedIds?: string[];
  /** Selection change handler */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** Whether selection is enabled */
  selectable?: boolean;
  /** Click handler for files */
  onFileClick?: (file: FileTreeNode) => void;
  /** Additional class names */
  className?: string;
}

interface TreeNodeProps {
  node: FileTreeNode;
  level: number;
  selectedIds: Set<string>;
  selectable: boolean;
  onToggle: (id: string) => void;
  onFileClick?: (file: FileTreeNode) => void;
}

function TreeNode({
  node,
  level,
  selectedIds,
  selectable,
  onToggle,
  onFileClick,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(level < 2);
  const isFolder = node.type === 'folder';
  const hasChildren = isFolder && node.children && node.children.length > 0;
  const isSelected = selectedIds.has(node.id);

  const handleClick = () => {
    if (isFolder) {
      setExpanded(!expanded);
    } else if (onFileClick) {
      onFileClick(node);
    }
  };

  const FileIcon = node.name.endsWith('.jsonl')
    ? FileJson
    : FileText;

  return (
    <div data-testid={`tree-node-${node.id}`}>
      <div
        className={cn(
          'flex items-center gap-1 py-1 px-2 rounded-md hover:bg-muted/50 cursor-pointer',
          isSelected && 'bg-primary/10'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Expand/collapse arrow */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Selection checkbox */}
        {selectable && !isFolder && (
          <Checkbox
            checked={isSelected}
            disabled={node.disabled}
            onCheckedChange={() => onToggle(node.id)}
            onClick={(e) => e.stopPropagation()}
            className="mr-1"
          />
        )}

        {/* Icon */}
        {isFolder ? (
          expanded ? (
            <FolderOpen className="h-4 w-4 text-info" />
          ) : (
            <Folder className="h-4 w-4 text-info" />
          )
        ) : (
          <FileIcon className="h-4 w-4 text-muted-foreground" />
        )}

        {/* Name */}
        <span className={cn(
          'text-sm truncate',
          isFolder ? 'text-foreground font-medium' : 'text-muted-foreground'
        )}>
          {node.name}
        </span>

        {/* Selected indicator */}
        {isSelected && !selectable && (
          <Check className="h-4 w-4 text-score-high ml-auto" />
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {node.children?.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedIds={selectedIds}
              selectable={selectable}
              onToggle={onToggle}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({
  data,
  selectedIds = [],
  onSelectionChange,
  selectable = true,
  onFileClick,
  className,
}: FileTreeProps) {
  const selectedSet = new Set(selectedIds);

  const handleToggle = (id: string) => {
    if (!onSelectionChange) return;

    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectionChange(Array.from(newSelected));
  };

  return (
    <div
      className={cn('rounded-lg border border-border bg-card p-2', className)}
      data-testid="file-tree"
    >
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No files found
        </p>
      ) : (
        data.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            level={0}
            selectedIds={selectedSet}
            selectable={selectable}
            onToggle={handleToggle}
            onFileClick={onFileClick}
          />
        ))
      )}
    </div>
  );
}
