import re

path = 'packages/db/src/services/document-service.ts'
with open(path, 'r') as f:
    content = f.read()

# Replace ?? null with || null for variantId and articleId to avoid empty strings
content = re.sub(r'variantId:\s*line\.variantId\s*\?\?\s*null', 'variantId: line.variantId || null', content)
content = re.sub(r'variantId:\s*line\.variantId,', 'variantId: line.variantId || null,', content)

# But wait, if we blindly replace variantId: line.variantId, we might mess up cases where it is actually non-null asserted or already has a fallback.
# Let's revert that and do it more carefully.
content = content.replace('variantId: line.variantId || null || null', 'variantId: line.variantId || null')
content = content.replace('variantId: line.variantId! || null', 'variantId: line.variantId || null')

with open(path, 'w') as f:
    f.write(content)

path_ui = 'packages/ui/components/document-editor.tsx'
with open(path_ui, 'r') as f:
    content_ui = f.read()

content_ui = content_ui.replace('articleId: l.articleId ?? null,', 'articleId: l.articleId || null,')
content_ui = content_ui.replace('variantId: l.variantId ?? null,', 'variantId: l.variantId || null,')

with open(path_ui, 'w') as f:
    f.write(content_ui)
