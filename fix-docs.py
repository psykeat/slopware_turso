import re

with open('packages/db/src/services/document-service.ts', 'r') as f:
    content = f.read()

# Replace documentLine.articleId with documentLine.variantId
content = re.sub(r'documentLine\.articleId', 'documentLine.variantId', content)

# Replace inventoryMovement.articleId with inventoryMovement.variantId
content = re.sub(r'inventoryMovement\.articleId', 'inventoryMovement.variantId', content)

# Update types and object literals where document lines are mapped
content = re.sub(r'articleId: (line|row|movement|documentLine)\.articleId', r'variantId: \1.variantId', content)

content = re.sub(r'articleId: string \| null;', r'variantId: string | null;', content)
content = re.sub(r'articleId\?: string \| null;', r'variantId?: string | null;', content)

# Also fix the inner references
content = re.sub(r'\!line\.articleId', r'!line.variantId', content)
content = re.sub(r'line\.articleId \?\?', r'line.variantId ??', content)
content = re.sub(r'line\.articleId &&', r'line.variantId &&', content)

with open('packages/db/src/services/document-service.ts', 'w') as f:
    f.write(content)
