// Preview content for surfaces whose backend endpoints do not exist yet
// (conversations, settings previews, and the analytics empty state).
// Everything here is clearly labelled "Preview" in the UI.

const daysAgo = (days, hour = 11, minute = 30) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

export const demoProducts = [
  {
    _id: "demo-p1",
    name: "Scented Soy Candle",
    description: "Hand-poured sandalwood and vanilla candle in a reusable glass jar.",
    price: 649,
    stock: 42,
    unit: "piece",
    isActive: true,
    createdAt: daysAgo(52)
  },
  {
    _id: "demo-p2",
    name: "Organic Cotton Tote",
    description: "Durable everyday tote with an inner pocket and reinforced handles.",
    price: 499,
    stock: 8,
    unit: "piece",
    isActive: true,
    createdAt: daysAgo(48)
  },
  {
    _id: "demo-p3",
    name: "Ceramic Coffee Mug",
    description: "Minimal stoneware mug, 350 ml, dishwasher and microwave safe.",
    price: 399,
    stock: 0,
    unit: "piece",
    isActive: true,
    createdAt: daysAgo(41)
  },
  {
    _id: "demo-p4",
    name: "Bamboo Desk Organiser",
    description: "Five-compartment organiser made from sustainably sourced bamboo.",
    price: 1249,
    stock: 17,
    unit: "piece",
    isActive: true,
    createdAt: daysAgo(36)
  },
  {
    _id: "demo-p5",
    name: "Cold Pressed Coconut Oil",
    description: "500 ml food-grade coconut oil, cold pressed in small batches.",
    price: 349,
    stock: 64,
    unit: "bottle",
    isActive: true,
    createdAt: daysAgo(30)
  },
  {
    _id: "demo-p6",
    name: "Masala Chai Blend",
    description: "Assam black tea blended with cardamom, ginger, and cloves.",
    price: 275,
    stock: 5,
    unit: "pack",
    isActive: true,
    createdAt: daysAgo(25)
  },
  {
    _id: "demo-p7",
    name: "Millet Cookies Gift Box",
    description: "Six packs of small-batch millet cookies in a gift-ready box.",
    price: 549,
    stock: 23,
    unit: "box",
    isActive: true,
    createdAt: daysAgo(18)
  },
  {
    _id: "demo-p8",
    name: "Linen Notebook Set",
    description: "Set of two A5 notebooks with 120 pages and lay-flat binding.",
    price: 449,
    stock: 31,
    unit: "set",
    isActive: false,
    createdAt: daysAgo(12)
  }
];

export const demoCustomers = [
  { _id: "demo-c1", name: "Aarav Sharma", phone: "+91 98765 43210", email: "aarav.sharma@example.com", address: "Indiranagar, Bengaluru", isActive: true, createdAt: daysAgo(57) },
  { _id: "demo-c2", name: "Priya Patel", phone: "+91 98220 11554", email: "priya.patel@example.com", address: "Bandra West, Mumbai", isActive: true, createdAt: daysAgo(49) },
  { _id: "demo-c3", name: "Rohan Mehta", phone: "+91 99887 65432", email: "rohan.mehta@example.com", address: "Koramangala, Bengaluru", isActive: true, createdAt: daysAgo(44) },
  { _id: "demo-c4", name: "Sneha Iyer", phone: "+91 90000 77881", email: "sneha.iyer@example.com", address: "Adyar, Chennai", isActive: true, createdAt: daysAgo(33) },
  { _id: "demo-c5", name: "Vikram Singh", phone: "+91 98111 22334", email: "vikram.singh@example.com", address: "Hauz Khas, New Delhi", isActive: true, createdAt: daysAgo(24) },
  { _id: "demo-c6", name: "Ananya Desai", phone: "+91 97654 32108", email: "ananya.desai@example.com", address: "Baner, Pune", isActive: false, createdAt: daysAgo(17) },
  { _id: "demo-c7", name: "Kabir Khan", phone: "+91 98980 45671", email: "kabir.khan@example.com", address: "Jubilee Hills, Hyderabad", isActive: true, createdAt: daysAgo(9) },
  { _id: "demo-c8", name: "Meera Nair", phone: "+91 94470 88231", email: "meera.nair@example.com", address: "Kochi, Kerala", isActive: true, createdAt: daysAgo(3) }
];

const orderSpecs = [
  [54, 0, [[0, 2]], "delivered", "paid"],
  [51, 1, [[1, 1], [4, 1]], "delivered", "paid"],
  [47, 2, [[3, 1]], "delivered", "paid"],
  [43, 0, [[5, 2], [4, 1]], "cancelled", "refunded"],
  [39, 3, [[6, 1], [0, 1]], "delivered", "paid"],
  [36, 4, [[2, 2]], "delivered", "paid"],
  [32, 1, [[4, 3]], "delivered", "paid"],
  [29, 5, [[3, 1], [6, 1]], "cancelled", "refunded"],
  [27, 2, [[1, 2]], "delivered", "paid"],
  [25, 6, [[6, 2], [5, 1]], "delivered", "paid"],
  [23, 0, [[4, 1], [7, 1]], "delivered", "paid"],
  [21, 3, [[0, 1]], "delivered", "paid"],
  [19, 7, [[5, 3]], "delivered", "paid"],
  [17, 4, [[3, 1]], "delivered", "paid"],
  [15, 1, [[4, 2], [6, 1]], "delivered", "paid"],
  [13, 2, [[6, 1]], "delivered", "paid"],
  [11, 5, [[0, 1], [1, 1]], "cancelled", "unpaid"],
  [9, 6, [[3, 1], [4, 1]], "delivered", "paid"],
  [8, 0, [[6, 1], [7, 1]], "delivered", "paid"],
  [7, 3, [[4, 2]], "confirmed", "pending"],
  [6, 7, [[0, 1], [5, 1]], "processing", "pending"],
  [5, 1, [[1, 1], [6, 2]], "dispatched", "paid"],
  [4, 4, [[4, 1], [5, 1]], "pending", "unpaid"],
  [3, 2, [[3, 1]], "pending", "unpaid"],
  [2, 0, [[6, 1], [4, 1]], "confirmed", "paid"],
  [2, 6, [[0, 2]], "processing", "pending"],
  [1, 7, [[1, 1], [5, 1]], "pending", "unpaid"],
  [1, 3, [[4, 2], [6, 1]], "dispatched", "paid"],
  [0, 0, [[7, 1], [0, 1]], "pending", "unpaid"],
  [0, 5, [[5, 2]], "confirmed", "pending"]
];

export const demoOrders = orderSpecs.map(([days, customerIndex, itemSpecs, status, paymentStatus], index) => {
  const customer = demoCustomers[customerIndex];
  const items = itemSpecs.map(([productIndex, quantity]) => {
    const product = demoProducts[productIndex];
    return { productId: product._id, name: product.name, quantity, price: product.price };
  });
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return {
    _id: `demo-o${index + 1}`,
    customerId: { _id: customer._id, name: customer.name, phone: customer.phone },
    items,
    totalAmount,
    status,
    paymentStatus,
    createdAt: daysAgo(days, 9 + (index % 9), (index * 13) % 60)
  };
});

const messagesFor = (conversationIndex) => {
  const conversations = [
    [
      ["incoming", "Hi! Is the scented candle available in a larger size?", 46, false],
      ["outgoing", "Hi Aarav! Yes — the 300 g jar is in stock. It's ₹899 and ships in 24 hours. Would you like me to reserve one for you?", 43, true],
      ["incoming", "Perfect, please reserve two.", 39, false],
      ["outgoing", "Done! I've reserved two 300 g candles. You'll get a payment link here in a moment. 🕯️", 36, true],
      ["incoming", "Payment done. Thank you!", 12, false]
    ],
    [
      ["incoming", "Do you deliver to Mumbai? How long does it take?", 121, false],
      ["outgoing", "Yes, we deliver across Mumbai. Standard delivery is 2–3 working days and orders above ₹999 ship free.", 118, true],
      ["incoming", "Great, ordering the tote and coconut oil now.", 96, false]
    ],
    [
      ["incoming", "Can I change the delivery address on my last order?", 190, false],
      ["outgoing", "Of course. Share the new address and I'll update it before dispatch. The order is still in processing.", 187, true],
      ["incoming", "Sent it on email. Thanks!", 150, false],
      ["outgoing", "Got it — address updated. You'll receive tracking details tomorrow.", 146, true]
    ],
    [
      ["incoming", "The mug arrived with a small chip on the rim.", 310, false],
      ["outgoing", "I'm really sorry about that, Sneha. I've raised a replacement — no need to return the damaged piece. It should reach you in 2 days.", 306, true],
      ["incoming", "That's very kind, thank you!", 300, false]
    ],
    [
      ["incoming", "Do you have corporate gifting options for 50+ boxes?", 410, false],
      ["outgoing", "Absolutely. We offer custom branding and volume pricing. For 50 boxes, the price is ₹449 per box with free delivery. Shall I connect you with our gifting specialist?", 405, true],
      ["incoming", "Yes please, that would help.", 388, false]
    ],
    [
      ["incoming", "What are your store timings?", 1400, false],
      ["outgoing", "We're open Monday to Saturday, 10 am – 7 pm. You can order on WhatsApp any time and we'll confirm the next morning.", 1395, true],
      ["incoming", "Noted, thanks!", 1380, false]
    ]
  ];

  return conversations[conversationIndex].map(([direction, text, minutes, aiGenerated], index) => ({
    _id: `demo-m${conversationIndex}-${index}`,
    direction,
    text,
    aiGenerated,
    status: direction === "outgoing" ? "read" : undefined,
    createdAt: new Date(Date.now() - minutes * 60 * 1000).toISOString()
  }));
};

export const demoConversations = [
  { _id: "demo-conv1", customer: demoCustomers[0], channel: "whatsapp", status: "open", unreadCount: 1, lastMessageAt: daysAgo(0, 10, 5), messages: messagesFor(0) },
  { _id: "demo-conv2", customer: demoCustomers[1], channel: "whatsapp", status: "open", unreadCount: 2, lastMessageAt: daysAgo(0, 8, 42), messages: messagesFor(1) },
  { _id: "demo-conv3", customer: demoCustomers[2], channel: "whatsapp", status: "resolved", unreadCount: 0, lastMessageAt: daysAgo(1, 16, 20), messages: messagesFor(2) },
  { _id: "demo-conv4", customer: demoCustomers[3], channel: "whatsapp", status: "open", unreadCount: 0, lastMessageAt: daysAgo(2, 11, 15), messages: messagesFor(3) },
  { _id: "demo-conv5", customer: demoCustomers[4], channel: "web", status: "open", unreadCount: 0, lastMessageAt: daysAgo(3, 14, 30), messages: messagesFor(4) },
  { _id: "demo-conv6", customer: demoCustomers[5], channel: "whatsapp", status: "archived", unreadCount: 0, lastMessageAt: daysAgo(9, 9, 10), messages: messagesFor(5) }
].map((conversation) => ({
  ...conversation,
  lastMessage: conversation.messages[conversation.messages.length - 1].text
}));

export const defaultAiSettings = {
  instructions:
    "You are the friendly sales assistant for our store. Answer questions about products, prices, and delivery in a warm, concise tone. Recommend related products when relevant. If a customer wants a refund, is upset, or asks something you are unsure about, hand the conversation to the owner.",
  tone: "friendly",
  language: "English",
  greeting: "Hi! 👋 Thanks for messaging us. How can I help you today?",
  fallback: "I'll check this with the team and get back to you shortly.",
  autoReply: true,
  handoff: true,
  takeOrders: true,
  afterHours: false,
  hoursStart: "10:00",
  hoursEnd: "19:00"
};

export const defaultWhatsAppSettings = {
  connected: true,
  phone: "+91 98765 43210",
  displayName: "Bloom & Co.",
  autoReply: true,
  readReceipts: true,
  webhookUrl: "https://api.bizassist.ai/webhooks/whatsapp",
  verifyToken: "bizassist_wh_7f3a91",
  templates: [
    { id: "t1", name: "order_confirmation", status: "approved", body: "Hi {{1}}, your order {{2}} is confirmed. We'll notify you when it ships." },
    { id: "t2", name: "shipping_update", status: "approved", body: "Good news {{1}}! Order {{2}} is on the way. Track it here: {{3}}" },
    { id: "t3", name: "abandoned_cart", status: "pending", body: "Hi {{1}}, you left {{2}} in your cart. Complete your order today and get free delivery." }
  ]
};

export const demoTemplates = defaultWhatsAppSettings.templates;
