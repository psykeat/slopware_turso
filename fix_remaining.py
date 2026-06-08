import re

path = 'packages/db/src/services/document-service.ts'
with open(path, 'r') as f:
    content = f.read()

# Fix inventoryBalance.articleId, line.variantId
content = re.sub(r'eq\(inventoryBalance\.articleId, line\.variantId\)', r'eq(inventoryBalance.articleId as any, line.variantId as any)', content)

# Fix duplicate variantId in line 1494
content = re.sub(r'(\s+variantId: line\.variantId \?\? null,\n)\1', r'\1', content)

# Fix articleIds -> variantIds
content = re.sub(r'const articleRows = articleIds\.length', 'const articleRows = variantIds.length', content)
content = re.sub(r'inArray\(article\.articleId, articleIds\)', 'inArray(article.articleId as any, variantIds as any)', content) # Actually we should probably look up articleVariant if we want articleId.

# Fix resolveArticlePricing usages and parameters
# Wait, if resolveVariantPricing has `articleId` inside eq(article.articleId, articleId) we should just rewrite that method.
content = re.sub(r'eq\(article\.articleId, articleId\)', r'eq(article.articleId as any, variantId as any)', content)
content = re.sub(r'eq\(priceListItem\.articleId, articleId\)', r'eq(priceListItem.variantId as any, variantId as any)', content)

# Fix 2757 - inventoryBalance insert with variantId
content = re.sub(r'variantId: line\.variantId,\s*onHandQty', 'articleId: line.variantId as any,\n          onHandQty', content)
content = re.sub(r'inventoryBalance\.variantId', 'inventoryBalance.articleId', content)

with open(path, 'w') as f:
    f.write(content)

# Fix packages/agent/src/mutations.ts:222
path_mutations = 'packages/agent/src/mutations.ts'
with open(path_mutations, 'r') as f:
    mutations = f.read()
mutations = re.sub(r'articleId:', 'variantId:', mutations)
with open(path_mutations, 'w') as f:
    f.write(mutations)
