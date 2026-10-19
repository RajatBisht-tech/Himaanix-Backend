export const categoryDefinitions = {
  women: { name: "Women", slug: "women" },
  men: { name: "Men", slug: "men" },
  kids: { name: "Kids", slug: "kids" },
  other: { name: "Other", slug: "other" },
};

export const classifyProductCategory = (product) => {
  const text = [
    product.name,
    product.description,
    product.brand,
    typeof product.category === "string" ? product.category : "",
    ...(Array.isArray(product.tags) ? product.tags : []),
  ]
    .filter(Boolean)
    .join(" ");

  const kidsPattern = /\b(kids?|children|boys?|girls?|junior|toddlers?|little|mini)\b/i;
  const menPattern = /\b(men(?:['’]s|s{1,2})?|man|male|groom|sherwani|pathani|bandhgala|nehru|jodhpuri|dhoti|safari)\b/i;
  const womenPattern = /\b(women|woman|female|ladies?|girls?|saree|sari|lehenga|anarkali|kurti|kurtis|salwar|dupatta|gown|dress|ethnic|indie|fusion)\b/i;

  if (
    /^Kidsville$/i.test(product.brand || "") ||
    kidsPattern.test(text)
  ) {
    return "kids";
  }

  if (
    /^KISAH$/i.test(product.brand || "") ||
    menPattern.test(text)
  ) {
    return "men";
  }

  if (
    /^(SHREE\s*-\s*She Is Special|INDIESSENCE)$/i.test(product.brand || "") ||
    womenPattern.test(text)
  ) {
    return "women";
  }

  return null;
};
