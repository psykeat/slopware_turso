import { Editor as TiptapEditor } from "@tiptap/react";
import {
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
  EditorContent,
  EditorRoot,
  type JSONContent,
} from "novel";
import { handleCommandNavigation } from "novel";
import { handleImageDrop } from "novel";
import { TextSelection } from "prosemirror-state";
import { useReducer, useRef } from "react";
import { useState } from "react";
import React from "react";
import { Markdown } from "tiptap-markdown";

import { cn } from "../lib/utils";
import { AutoComplete } from "./editor-autocomplete";
import EditorMenu from "./editor-menu";
import { TextButtons } from "./editor.text-buttons";
import { defaultExtensions } from "./extensions";
import { suggestionItems } from "./slash-command";
import { Toolbar } from "./toolbar";

export const defaultEditorContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [],
    },
  ],
};

interface EditorProps {
  initialValue?: JSONContent;
  onChange: (content: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
  onCommandEnter?: () => void;
  onAttachmentsChange?: (attachments: File[]) => void;
  myInfo?: {
    name?: string;
    email?: string;
  };
  senderInfo?: {
    name?: string;
    email?: string;
  };
  onTab?: () => boolean;
  onEditorReady?: (editor: TiptapEditor) => void;
  includeSignature?: boolean;
  onSignatureToggle?: (include: boolean) => void;
  signature?: string;
  hasSignature?: boolean;
  readOnly?: boolean;
  hideToolbar?: boolean;
}

interface EditorState {
  openNode: boolean;
  openColor: boolean;
  openLink: boolean;
  openAI: boolean;
}

type EditorAction =
  | { type: "TOGGLE_NODE"; payload: boolean }
  | { type: "TOGGLE_COLOR"; payload: boolean }
  | { type: "TOGGLE_LINK"; payload: boolean }
  | { type: "TOGGLE_AI"; payload: boolean };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "TOGGLE_NODE":
      return { ...state, openNode: action.payload };
    case "TOGGLE_COLOR":
      return { ...state, openColor: action.payload };
    case "TOGGLE_LINK":
      return { ...state, openLink: action.payload };
    case "TOGGLE_AI":
      return { ...state, openAI: action.payload };
    default:
      return state;
  }
}

export default function Editor({
  initialValue,
  onChange,
  placeholder = "Start your email here",
  onFocus,
  onBlur,
  className,
  onCommandEnter,
  onTab,
  onAttachmentsChange,
  senderInfo,
  myInfo,
  readOnly,
}: EditorProps) {
  const [state, dispatch] = useReducer(editorReducer, {
    openNode: false,
    openColor: false,
    openLink: false,
    openAI: false,
  });

  const contentRef = useRef<string>("");
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { openAI } = state;

  // Function to focus the editor
  const focusEditor = () => {
    if (editor && !readOnly) {
      editor.commands.focus("end");
    }
  };

  // Function to clear editor content
  const clearEditorContent = React.useCallback(() => {
    if (editor) {
      editor.commands.clearContent(true);
      // Also update our reference and notify parent
      contentRef.current = "";
      onChange("");
    }
  }, [editor, onChange]);

  // Reset editor content when initialValue changes
  React.useEffect(() => {
    // We need to make sure both the editor reference exists AND initialValue is provided
    if (editor && initialValue !== undefined) {
      // Check if the incoming value actually differs from what's currently in the editor
      const currentHtml = editor.getHTML();
      if ((initialValue as any) === contentRef.current || (initialValue as any) === currentHtml) {
        return;
      }

      try {
        // Make sure the editor is ready before setting content
        setTimeout(() => {
          // Double-check that the editor still exists in case of unmounting
          if (editor?.commands?.setContent) {
            // Keep current selection if possible, but setContent typically resets it
            editor.commands.setContent(initialValue);

            const html = editor.getHTML();
            contentRef.current = html;
            // No need to trigger onChange here, it just loops back to the parent
          }
        }, 0);
      } catch (error) {
        console.error("Error setting editor content:", error);
      }
    }
  }, [initialValue, editor]);

  // Handle command+enter or ctrl+enter
  const handleCommandEnter = React.useCallback(() => {
    // Call the parent's onCommandEnter
    onCommandEnter?.();

    // Clear the editor content after sending
    setTimeout(() => {
      if (editor?.commands?.clearContent) {
        clearEditorContent();
      }
    }, 200);
  }, [onCommandEnter, clearEditorContent, editor]);

  return (
    <div
      className={`relative flex min-h-0 w-full flex-1 flex-col ${className || ""}`}
      onKeyDown={(e) => {
        if (readOnly) return;
        // Handle tab key
        if (e.key === "Tab" && !e.shiftKey) {
          if (onTab && onTab()) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }

        if (e.key === "Enter" && !e.shiftKey) {
          e.stopPropagation();
        }

        // Handle Command+Enter (Mac) or Ctrl+Enter (Windows/Linux)
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          e.stopPropagation();
          handleCommandEnter();
        }
      }}
    >
      <EditorRoot>
        <EditorContent
          immediatelyRender={false}
          initialContent={initialValue || defaultEditorContent}
          extensions={[
            ...defaultExtensions,
            Markdown,
            AutoComplete.configure({
              suggestions: {
                openers: [
                  "Hi there,",
                  "Hello,",
                  "Dear",
                  "Greetings,",
                  "Good morning,",
                  "Good afternoon,",
                  "Good evening,",
                ],
                closers: [
                  "Best regards,",
                  "Kind regards,",
                  "Sincerely,",
                  "Thanks,",
                  "Thank you,",
                  "Cheers,",
                ],
                custom: [
                  "I hope this email finds you well.",
                  "I look forward to hearing from you.",
                  "Please let me know if you have any questions.",
                ],
              },
              sender: senderInfo,
              myInfo: myInfo,
            }),
          ]}
          ref={containerRef}
          className="relative no-scrollbar max-h-[500px] min-h-[220px] cursor-text overflow-auto"
          editorProps={{
            editable: () => !readOnly,
            handleDOMEvents: {
              mousedown: (view, event) => {
                if (readOnly) return false;
                focusEditor();
                const coords = view.posAtCoords({
                  left: event.clientX,
                  top: event.clientY,
                });

                if (coords) {
                  const pos = coords.pos;
                  const tr = view.state.tr;
                  const selection = TextSelection.create(view.state.doc, pos);
                  tr.setSelection(selection);
                  view.dispatch(tr);
                }

                // Let the default handler also run
                return false;
              },
              keydown: (view, event) => {
                if (readOnly) return false;
                if (event.key === "Tab" && !event.shiftKey) {
                  if (onTab && onTab()) {
                    event.preventDefault();
                    return true;
                  }
                }

                // Prevent Command+Enter from adding a new line
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  return true;
                }

                return handleCommandNavigation(event);
              },
              focus: () => {
                if (!readOnly) onFocus?.();
                return false;
              },
              blur: () => {
                if (!readOnly) onBlur?.();
                return false;
              },
            },
            handleDrop: (view, event, _slice, moved) => {
              if (readOnly) return false;
              return handleImageDrop(view, event, moved, (file) => {
                onAttachmentsChange?.([file]);
              });
            },
            attributes: {
              class: cn(
                "prose dark:prose-invert prose-headings:font-title min-h-[200px] max-w-full focus:outline-none",
                readOnly && "pointer-events-none select-text",
              ),
              "data-placeholder": placeholder,
            },
          }}
          onCreate={({ editor: ed }) => {
            setEditor(ed);
          }}
          onDestroy={() => {
            setEditor(null);
          }}
          onUpdate={({ editor: ed }) => {
            if (readOnly) return;
            // Store the content in the ref to prevent losing it
            contentRef.current = ed.getHTML();
            onChange(ed.getHTML());
          }}
          slotAfter={null}
        >
          {/* Make sure the command palette doesn't cause a refresh */}
          <EditorCommand
            className="z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border border-muted bg-background px-1 py-2 shadow-md"
            onKeyDown={(e) => {
              // Prevent form submission on any key that might trigger it
              if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            {/* Rest of the command palette */}
            <EditorCommandEmpty className="px-2 text-muted-foreground">
              No results
            </EditorCommandEmpty>
            <EditorCommandList>
              {suggestionItems.map((item) => (
                <EditorCommandItem
                  value={item.title}
                  onCommand={(val) => {
                    // Prevent default behavior that might cause refresh
                    item.command?.(val);
                    return false;
                  }}
                  className="flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-[10px] hover:bg-accent aria-selected:bg-accent"
                  key={item.title}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-muted bg-background">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-xs font-medium">{item.title}</p>
                    <p className="text-[8px] text-muted-foreground">{item.description}</p>
                  </div>
                </EditorCommandItem>
              ))}
            </EditorCommandList>
          </EditorCommand>

          <EditorMenu
            open={openAI}
            onOpenChange={(open) => dispatch({ type: "TOGGLE_AI", payload: open })}
          >
            {editor && !readOnly && <Toolbar editor={editor} />}
          </EditorMenu>
        </EditorContent>
      </EditorRoot>
    </div>
  );
}
