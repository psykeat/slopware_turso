import re

path = 'packages/db/src/services/document-service.ts'
with open(path, 'r') as f:
    content = f.read()

content = content.replace('"documentLineId" | "articleId"', '"documentLineId" | "variantId"')

content = re.sub(r'(\s+variantId: line\.variantId \?\? null,\n)\1', r'\1', content)

with open(path, 'w') as f:
    f.write(content)
