import re

def main():
    with open("packages/ui/components/entity-mask.tsx", "r") as f:
        content = f.read()

    # 1. F10 / Update not closing mask (add onSaved to onSubmit)
    old_submit = """        } else {
          throw new Error(errorText || `Save failed: ${res.status}`);
        }
      }
      return res.json();
    },
  });"""
    new_submit = """        } else {
          throw new Error(errorText || `Save failed: ${res.status}`);
        }
      }
      const result = await res.json();
      toast.success(recordId ? t("form.updateSuccess") : t("form.createSuccess"));
      queryClient.invalidateQueries({ queryKey: ["data", entityName] });
      onSaved?.(result);
      return result;
    },
  });"""
    content = content.replace(old_submit, new_submit)

    # 2. FieldInput UUID patching -> enforce lookup if ends with Id
    old_field_input = """function FieldInput({
  field,
  value,
  disabled,
  onChange,
  onBlur,
}: {
  field: FieldDef;
  value: any;
  disabled: boolean;
  onChange: (val: any) => void;
  onBlur?: () => void;
}) {"""
    new_field_input = """function FieldInput({
  field: originalField,
  value,
  disabled,
  onChange,
  onBlur,
}: {
  field: FieldDef;
  value: any;
  disabled: boolean;
  onChange: (val: any) => void;
  onBlur?: () => void;
}) {
  const field = useMemo(() => {
    if (originalField.type !== "lookup" && originalField.key.endsWith("Id") && originalField.key !== "id") {
       return { ...originalField, type: "lookup" as const, lookupTable: originalField.lookupTable || originalField.key.replace(/Id$/, "") };
    }
    // Also enforce UUIDs that are passed to a text field without 'Id' to be hidden or handled?
    // The user said: "input fields with uuid fks must always resolve the uuid". Above fixes it by key.
    // If it's still a text field but value is a uuid, we can blank it, but key inference is safest.
    return originalField;
  }, [originalField]);"""
    content = content.replace(old_field_input, new_field_input)

    # 3. Maximum update depth exceeded in Design Mode
    # Fix the dependency array in useLayoutEffect for editorOverlay
    old_layout_deps = """    isDesignMode,
    selectedFieldKey,
    form.state.values,
    fields.length,
    overlayStyle,
  ]);"""
    new_layout_deps = """    isDesignMode,
    selectedFieldKey,
    fields.length,
  ]); // Removed form.state.values and overlayStyle to prevent infinite loops"""
    content = content.replace(old_layout_deps, new_layout_deps)

    # 4. Global error display
    # Add globalError rendering above childSectionNode
    # Let's find childSectionNode
    old_child_section_node = """  const childSectionNode = hasChildContent ? ("""
    new_child_section_node = """  const globalErrorNode = globalError ? (
    <div className="mb-4 rounded-md bg-destructive/10 p-3 text-[13px] text-destructive">
      {globalError}
    </div>
  ) : null;

  const childSectionNode = hasChildContent ? ("""
    content = content.replace(old_child_section_node, new_child_section_node)
    
    # Render globalErrorNode
    old_render_footer = """          {childSectionNode}
          {footerButtons}
        </div>"""
    new_render_footer = """          {childSectionNode}
          {globalErrorNode}
          {footerButtons}
        </div>"""
    content = content.replace(old_render_footer, new_render_footer)

    # 5. Tabulator selecting labels
    # Find the button rendering the label
    old_label_button = """                  <button
                    type="button"
                    onClick={isDesignMode ? () => openFieldEditor(field.key, "expanded") : undefined}
                    className={cn("truncate text-left", getFieldLabelClasses(field))}
                  >"""
    new_label_button = """                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={isDesignMode ? () => openFieldEditor(field.key, "expanded") : undefined}
                    className={cn("truncate text-left", getFieldLabelClasses(field))}
                  >"""
    content = content.replace(old_label_button, new_label_button)

    with open("packages/ui/components/entity-mask.tsx", "w") as f:
        f.write(content)

if __name__ == "__main__":
    main()
