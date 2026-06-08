import { Editor } from "@tiptap/core";
import { BoldIcon, ItalicIcon, UnderlineIcon, StrikethroughIcon, CodeIcon } from "lucide-react";
import { EditorBubbleItem, useEditor } from "novel";

import { cn } from "../lib/utils";
import { Button } from "./button";

export const TextButtons = () => {
  const { editor } = useEditor();
  if (!editor) return null;
  const items = [
    {
      name: "bold",
      isActive: (editor: Editor) => editor.isActive("bold"),
      command: (editor: Editor) => editor.chain().focus().toggleBold().run(),
      icon: BoldIcon,
    },
    {
      name: "italic",
      isActive: (editor: Editor) => editor.isActive("italic"),
      command: (editor: Editor) => editor.chain().focus().toggleItalic().run(),
      icon: ItalicIcon,
    },
    {
      name: "underline",
      isActive: (editor: Editor) => editor.isActive("underline"),
      command: (editor: Editor) => editor.chain().focus().toggleUnderline().run(),
      icon: UnderlineIcon,
    },
    {
      name: "strike",
      isActive: (editor: Editor) => editor.isActive("strike"),
      command: (editor: Editor) => editor.chain().focus().toggleStrike().run(),
      icon: StrikethroughIcon,
    },
    {
      name: "code",
      isActive: (editor: Editor) => editor.isActive("code"),
      command: (editor: Editor) => editor.chain().focus().toggleCode().run(),
      icon: CodeIcon,
    },
  ];
  return (
    <div className="flex">
      {items.map((item) => (
        <EditorBubbleItem
          key={item.name}
          onSelect={(editor) => {
            item.command(editor);
          }}
        >
          <Button size="sm" className="h-8 rounded-none px-2" variant="ghost">
            <item.icon
              className={cn("h-4 w-4", {
                "text-blue-500": item.isActive(editor),
              })}
            />
          </Button>
        </EditorBubbleItem>
      ))}
    </div>
  );
};
