import { ChevronRightIcon, ChevronDownIcon, FolderIcon, FolderOpenIcon } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/utils";
import { useFocus } from "../platform/focus-manager";
import { Skeleton } from "./skeleton";

export interface TreeNode {
  id: string;
  label: string;
  count?: number;
  children?: TreeNode[];
  level?: number;
}

export interface NavigationTreeProps {
  entityName: string;
  panelId?: string;
  data: TreeNode[];
  header?: string;
  className?: string;
  isLoading?: boolean;
  onSelect?: (id: string) => void;
  onSelectCommit?: (id: string) => void;
}

export function NavigationTree({
  entityName,
  data,
  panelId = "nav-tree",
  header,
  className,
  isLoading,
  onSelect,
  onSelectCommit,
}: NavigationTreeProps) {
  const { t } = useTranslation("ui");
  const { state: focusState, setFocus } = useFocus();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const treeRef = useRef<HTMLDivElement>(null);

  const flatNodes = useMemo(() => {
    const nodes: TreeNode[] = [];
    const walk = (items: TreeNode[]) => {
      for (const item of items) {
        nodes.push(item);
        if (item.children && (expanded[item.id] ?? false)) {
          walk(item.children);
        }
      }
    };
    walk(data);
    return nodes;
  }, [data, expanded]);

  const currentTreeId = focusState.treePanel === panelId ? focusState.treeRecordId : null;
  const currentIndex = currentTreeId
    ? flatNodes.findIndex((node) => node.id === currentTreeId)
    : -1;

  const commitSelection = useCallback(
    (id: string) => {
      onSelect?.(id);
      requestAnimationFrame(() => onSelectCommit?.(id));
    },
    [onSelect, onSelectCommit],
  );

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelect = useCallback(
    (node: TreeNode) => {
      setFocus({
        area: "tree",
        treeEntity: entityName,
        treePanel: panelId,
        treeRecordId: node.id,
        panel: panelId,
      });
      commitSelection(node.id);
    },
    [commitSelection, entityName, panelId, setFocus],
  );

  const navigate = useCallback(
    (delta: number) => {
      if (flatNodes.length === 0) return;
      const base = currentIndex < 0 ? (delta > 0 ? -1 : flatNodes.length) : currentIndex;
      const nextIndex = Math.max(0, Math.min(base + delta, flatNodes.length - 1));
      const node = flatNodes[nextIndex];
      if (!node) return;
      handleSelect(node);
    },
    [currentIndex, flatNodes, handleSelect],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || !treeRef.current || !treeRef.current.contains(active)) return;
      if (!e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        navigate(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        navigate(-1);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  const renderTree = (nodes: TreeNode[], level = 0): React.ReactNode => {
    return nodes.map((node) => {
      const hasChildren = Boolean(node.children && node.children.length > 0);
      const isExpanded = expanded[node.id] ?? false;
      const isSelected = focusState.treeRecordId === node.id && focusState.treePanel === panelId;
      const effectiveLevel = node.level ?? level;

      return (
        <React.Fragment key={node.id}>
          <div
            role="treeitem"
            aria-selected={isSelected}
            aria-expanded={hasChildren ? isExpanded : undefined}
            tabIndex={0}
            className={cn(
              "flex h-7 cursor-pointer items-center gap-1.5 text-[13px] transition-colors select-none",
              !isSelected && "hover:bg-canvas",
            )}
            style={{
              paddingLeft: `${8 + effectiveLevel * 14}px`,
              ...(isSelected ? { background: "var(--primary)", color: "var(--primary-fg)" } : {}),
            }}
            onClick={() => handleSelect(node)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleSelect(node);
            }}
          >
            {hasChildren ? (
              <button
                type="button"
                aria-label={isExpanded ? "Collapse" : "Expand"}
                className="flex size-3 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
                onClick={(e) => toggleExpand(node.id, e)}
              >
                {isExpanded ? (
                  <ChevronDownIcon size={12} strokeWidth={1.5} />
                ) : (
                  <ChevronRightIcon size={12} strokeWidth={1.5} />
                )}
              </button>
            ) : (
              <span className="size-3 shrink-0" style={{ display: "inline-block", width: 12 }} />
            )}

            <span className="flex size-3.5 shrink-0 items-center justify-center">
              {isExpanded ? (
                <FolderOpenIcon size={13} strokeWidth={1.4} />
              ) : (
                <FolderIcon size={13} strokeWidth={1.4} />
              )}
            </span>

            <span className="flex-1 truncate">{node.label}</span>

            {node.count !== undefined && (
              <span
                className="mr-2 text-[11px] tabular-nums"
                style={{
                  color: isSelected
                    ? "color-mix(in oklab, var(--primary-fg) 70%, transparent)"
                    : "var(--ink-mute)",
                }}
              >
                {node.count.toLocaleString()}
              </span>
            )}
          </div>

          {hasChildren && isExpanded && renderTree(node.children!, effectiveLevel + 1)}
        </React.Fragment>
      );
    });
  };

  const resolvedHeader = header ?? t("nav.categories");

  return (
    <div
      ref={treeRef}
      className={cn(
        "flex h-full w-full flex-col overflow-hidden border-r border-hairline bg-canvas-soft",
        className,
      )}
    >
      <div className="flex h-8 shrink-0 items-center border-b border-hairline px-3 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
        {resolvedHeader}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <>
            {[8, 22, 14, 28, 8, 22, 14].map((indent, i) => (
              <div
                key={i}
                className="flex h-7 items-center gap-1.5"
                style={{ paddingLeft: indent }}
              >
                <Skeleton className="size-3 shrink-0" />
                <Skeleton className="h-2.5" style={{ width: 80 + ((i * 13) % 60) }} />
                <Skeleton className="mr-2 ml-auto h-2 w-6" />
              </div>
            ))}
          </>
        ) : (
          renderTree(data)
        )}
      </div>
    </div>
  );
}
