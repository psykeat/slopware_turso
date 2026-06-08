import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  LexicalCommand,
  DROP_COMMAND,
  PASTE_COMMAND,
} from "lexical";
import { useEffect } from "react";

import { $createImageNode, ImageNode, ImagePayload } from "./image-node";

export const INSERT_IMAGE_COMMAND: LexicalCommand<ImagePayload> =
  createCommand("INSERT_IMAGE_COMMAND");

export function ImagesPlugin(): React.JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([ImageNode])) {
      throw new Error("ImagesPlugin: ImageNode not registered on editor");
    }

    return mergeRegister(
      editor.registerCommand<ImagePayload>(
        INSERT_IMAGE_COMMAND,
        (payload) => {
          const imageNode = $createImageNode(payload);
          $insertNodes([imageNode]);
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand<DragEvent>(
        DROP_COMMAND,
        (event) => {
          return handleDragDropPaste(event, editor);
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand<ClipboardEvent>(
        PASTE_COMMAND,
        (event) => {
          return handleDragDropPaste(event, editor);
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [editor]);

  return null;
}

function handleDragDropPaste(event: DragEvent | ClipboardEvent, editor: any): boolean {
  const dataTransfer = "dataTransfer" in event ? event.dataTransfer : event.clipboardData;
  if (!dataTransfer) return false;

  const files = dataTransfer.files;
  if (files && files.length > 0) {
    const file = files[0];
    if (file && file.type.startsWith("image/")) {
      event.preventDefault();

      const formData = new FormData();
      formData.append("file", file);

      fetch("/api/email/attachments/upload", {
        method: "POST",
        body: formData,
      })
        .then((res) => res.json())
        .then((result) => {
          if (result && result.storageKey) {
            editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
              src: `/api/storage/preview/view?key=${encodeURIComponent(result.storageKey)}`,
              altText: file.name,
            });
          }
        })
        .catch(console.error);

      return true;
    }
  }
  return false;
}
