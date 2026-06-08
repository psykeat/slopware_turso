import re

path_mutations = 'packages/agent/src/mutations.ts'
with open(path_mutations, 'r') as f:
    mutations = f.read()
mutations = mutations.replace('variantId: line.articleId', 'variantId: line.variantId')
with open(path_mutations, 'w') as f:
    f.write(mutations)

path = 'packages/db/src/services/document-service.ts'
with open(path, 'r') as f:
    content = f.read()

content = content.replace('"articleId" | "documentLineId"', '"variantId" | "documentLineId"')
content = content.replace('articleIds.length', 'variantIds.length')

content = re.sub(r'(\s+variantId: line\.variantId \?\? null,\n)\1', r'\1', content)

content = content.replace('eq(inventoryMovement.articleId, line.variantId)', 'eq(inventoryMovement.variantId, line.variantId as any)')

content = content.replace('eq(serialNumber.articleId, line.variantId)', 'eq(serialNumber.articleId as any, line.variantId as any)')

with open(path, 'w') as f:
    f.write(content)
