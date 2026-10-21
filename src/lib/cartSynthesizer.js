import Product from "../models/Product.js";

const DEFAULT_CATALOG_SAMPLES = [
  { name: "Himaanix Classic Chronograph Watch", sku: "HIM-WAT-CHRONO-01", price: 1499 },
  { name: "Himaanix Urban Low-Top Sneakers", sku: "HIM-SHOE-URBAN-02", price: 2199 },
  { name: "Himaanix Premium Oxford Cotton Shirt", sku: "HIM-APP-OXFORD-03", price: 1299 },
  { name: "Himaanix Tailored Slim Chinos", sku: "HIM-APP-CHINO-04", price: 1699 },
  { name: "Himaanix Minimalist Leather Strap Watch", sku: "HIM-WAT-MIN-05", price: 999 },
  { name: "Himaanix Signature Runner Sneakers", sku: "HIM-SHOE-RUNNER-06", price: 2499 },
  { name: "Himaanix Casual Denim Jacket", sku: "HIM-APP-DENIM-07", price: 2999 },
  { name: "Himaanix Everyday Cotton Crewneck", sku: "HIM-APP-CREW-08", price: 799 },
  { name: "Himaanix Luxury Analog Watch", sku: "HIM-WAT-LUX-09", price: 3499 },
  { name: "Himaanix Lifestyle Collection Accessory", sku: "HIM-ACC-LIFESTYLE-10", price: 499 },
];

/**
 * Synthesizes an authentic shopping cart and shipping address matching the exact transaction amount.
 * Backed by real products from the Himaanix MongoDB catalog where possible.
 */
export async function synthesizeStorefrontCart({ amount, customer = {} }) {
  const targetAmount = Number(amount);
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    throw new Error("Invalid target amount for cart synthesis");
  }

  let dbProducts = [];
  try {
    dbProducts = await Product.find({ isActive: true, price: { $lte: targetAmount } })
      .limit(20)
      .select("name price slug images variants tags brand")
      .lean();
  } catch (err) {
    console.warn("Could not query DB products for synthesis, falling back to default catalog:", err.message);
  }

  const catalog = dbProducts.length > 0
    ? dbProducts.map((p) => ({
        id: p._id,
        name: p.name,
        sku: p.variants?.[0]?.sku || `HIM-${String(p._id).slice(-6).toUpperCase()}`,
        price: Number(p.price) || 999,
        image: p.images?.[0] || "",
        size: p.variants?.[0]?.size || "M",
        color: p.variants?.[0]?.color || "Default",
      }))
    : DEFAULT_CATALOG_SAMPLES;

  const items = [];
  let remainingAmount = Math.round(targetAmount * 100); // work in paise to avoid float errors

  // Greedily pick products that fit within remainingAmount
  const sortedCatalog = [...catalog].sort((a, b) => b.price - a.price);

  for (const prod of sortedCatalog) {
    const prodPaise = Math.round(prod.price * 100);
    if (prodPaise <= 0) continue;

    if (remainingAmount >= prodPaise) {
      const maxQty = Math.floor(remainingAmount / prodPaise);
      const qty = Math.min(maxQty, 3); // limit to reasonable quantity

      if (qty > 0) {
        const lineTotalPaise = prodPaise * qty;
        items.push({
          product: prod.id || undefined,
          name: prod.name,
          sku: prod.sku || `HIM-SKU-${items.length + 1}`,
          image: prod.image || "",
          size: prod.size || "M",
          color: prod.color || "Standard",
          quantity: qty,
          unitPrice: prod.price,
          lineTotal: (lineTotalPaise / 100),
        });
        remainingAmount -= lineTotalPaise;
      }
    }

    if (remainingAmount <= 0) break;
  }

  // If there's an exact remainder to make the total match 100%
  if (remainingAmount > 0) {
    const remainderRupees = remainingAmount / 100;
    // Add a legitimate accessory or fashion item for the remaining difference
    items.push({
      name: "Himaanix Lifestyle Collection Apparel",
      sku: `HIM-APP-${Date.now().toString().slice(-6)}`,
      image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=850&q=85",
      size: "OneSize",
      color: "Classic",
      quantity: 1,
      unitPrice: Number(remainderRupees.toFixed(2)),
      lineTotal: Number(remainderRupees.toFixed(2)),
    });
    remainingAmount = 0;
  }

  // Construct realistic shipping address
  const shippingAddress = {
    fullName: String(customer.name || "Customer").trim(),
    phone: String(customer.mobile || customer.phone || "9876543210").trim(),
    line1: "Plot No. 42, Himaanix Customer Delivery Point",
    line2: "Commercial Hub, Phase 2",
    city: "New Delhi",
    state: "Delhi",
    postalCode: "110001",
    country: "India",
  };

  return {
    items,
    shippingAddress,
    subtotal: targetAmount,
    discount: 0,
    shippingFee: 0,
    total: targetAmount,
  };
}
