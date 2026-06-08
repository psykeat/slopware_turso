import { Editor } from "@tiptap/core";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  TextQuote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  RemoveFormatting,
  FileCode2,
} from "lucide-react";
import React from "react";

import { cn } from "../lib/utils";
import { Button } from "./button";

const preventFocus = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

interface ToolbarProps {
  editor: Editor;
}

export function Toolbar({ editor }: ToolbarProps) {
  if (!editor) {
    return null;
  }

  const toggleBold = () => editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.chain().focus().toggleItalic().run();
  const toggleUnderline = () => editor.chain().focus().toggleUnderline().run();
  const toggleStrike = () => editor.chain().focus().toggleStrike().run();

  const toggleBulletList = () => editor.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor.chain().focus().toggleOrderedList().run();
  const toggleBlockquote = () => editor.chain().focus().toggleBlockquote().run();
  const clearFormat = () => editor.chain().focus().unsetAllMarks().clearNodes().run();

  const toggleCodeBlock = () => {
    if (editor.can().toggleCodeBlock()) {
      editor.chain().focus().toggleCodeBlock().run();
    }
  };

  const setAlign = (alignment: "left" | "center" | "right" | "justify") => {
    if (editor.can().setTextAlign(alignment)) {
      editor.chain().focus().setTextAlign(alignment).run();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-hairline bg-canvas p-1">
      {/* Font Family & Color */}
      <div className="mr-1 flex items-center gap-1 border-r border-hairline pr-1">
        <select
          onChange={(e) => (editor.chain().focus() as any).setFontFamily(e.target.value).run()}
          className="h-7 w-24 rounded-sm border border-hairline bg-canvas px-1 text-[11px] outline-none hover:bg-canvas-soft focus:border-primary"
          title="Font Family"
        >
          <option value="">Default Font</option>
          <option value="Inter, sans-serif">Inter</option>
          <option value="Arial, Helvetica, sans-serif">Arial</option>
          <option value="'Courier New', Courier, monospace">Courier New</option>
          <option value="Georgia, serif">Georgia</option>
        </select>

        <div
          className="relative flex h-7 items-center rounded-sm border border-hairline bg-canvas px-1 hover:bg-canvas-soft"
          title="Text Color"
        >
          <span className="mr-1 text-[11px] font-bold text-ink-secondary">A</span>
          <input
            type="color"
            onInput={(e) => editor.chain().focus().setColor(e.currentTarget.value).run()}
            className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
          />
        </div>
      </div>

      {/* Font & Style */}
      <div className="mr-1 flex items-center gap-0.5 border-r border-hairline pr-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={preventFocus}
          onClick={toggleBold}
          className={cn(
            "h-7 w-7 rounded-sm",
            editor.isActive("bold") && "bg-canvas-soft text-primary",
          )}
          title="Bold (Cmd+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={preventFocus}
          onClick={toggleItalic}
          className={cn(
            "h-7 w-7 rounded-sm",
            editor.isActive("italic") && "bg-canvas-soft text-primary",
          )}
          title="Italic (Cmd+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={preventFocus}
          onClick={toggleUnderline}
          className={cn(
            "h-7 w-7 rounded-sm",
            editor.isActive("underline") && "bg-canvas-soft text-primary",
          )}
          title="Underline (Cmd+U)"
        >
          <Underline className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={preventFocus}
          onClick={toggleStrike}
          className={cn(
            "h-7 w-7 rounded-sm",
            editor.isActive("strike") && "bg-canvas-soft text-primary",
          )}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={preventFocus}
          onClick={clearFormat}
          className="h-7 w-7 rounded-sm"
          title="Clear Formatting"
        >
          <RemoveFormatting className="h-4 w-4" />
        </Button>
      </div>

      {/* Alignment */}
      <div className="mr-1 flex items-center gap-0.5 border-r border-hairline pr-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={preventFocus}
          onClick={() => setAlign("left")}
          className={cn(
            "h-7 w-7 rounded-sm",
            editor.isActive({ textAlign: "left" }) && "bg-canvas-soft text-primary",
          )}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={preventFocus}
          onClick={() => setAlign("center")}
          className={cn(
            "h-7 w-7 rounded-sm",
            editor.isActive({ textAlign: "center" }) && "bg-canvas-soft text-primary",
          )}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={preventFocus}
          onClick={() => setAlign("right")}
          className={cn(
            "h-7 w-7 rounded-sm",
            editor.isActive({ textAlign: "right" }) && "bg-canvas-soft text-primary",
          )}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Lists & Indent */}
      <div className="mr-1 flex items-center gap-0.5 border-r border-hairline pr-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={preventFocus}
          onClick={toggleBulletList}
          className={cn(
            "h-7 w-7 rounded-sm",
            editor.isActive("bulletList") && "bg-canvas-soft text-primary",
          )}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={preventFocus}
          onClick={toggleOrderedList}
          className={cn(
            "h-7 w-7 rounded-sm",
            editor.isActive("orderedList") && "bg-canvas-soft text-primary",
          )}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={preventFocus}
          onClick={toggleBlockquote}
          className={cn(
            "h-7 w-7 rounded-sm",
            editor.isActive("blockquote") && "bg-canvas-soft text-primary",
          )}
          title="Blockquote"
        >
          <TextQuote className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={preventFocus}
          onClick={toggleCodeBlock}
          className={cn(
            "h-7 w-7 rounded-sm",
            editor.isActive("codeBlock") && "bg-canvas-soft text-primary",
          )}
          title="Code Block"
        >
          <FileCode2 className="h-4 w-4" />
        </Button>
      </div>

      {/* AI Features */}
      <div className="ml-auto flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          onMouseDown={preventFocus}
          className="h-7 px-2 text-[11px] font-medium text-purple-600 hover:bg-purple-50 hover:text-purple-700 dark:text-purple-400 dark:hover:bg-purple-900/30"
          title="AI Assistant (Type '/' in editor)"
          onClick={() => editor.chain().focus().insertContent("/").run()}
        >
          Ask AI ✨
        </Button>
      </div>
    </div>
  );
}
