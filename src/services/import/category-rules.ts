/**
 * Deterministic category detection rules for Indian bank and standard statement descriptions.
 * Deterministic rules run first and ALWAYS take precedence over AI suggestions.
 */

const KEYWORD_RULES: Array<{ keywords: string[]; category: string }> = [
  {
    category: "Food & Dining",
    keywords: [
      "swiggy", "zomato", "mcdonalds", "starbucks", "dominos", "pizza", "burger", "subway",
      "cafe", "restaurant", "bakers", "dining", "barbeque", "chai", "coffee", "eats",
      "blinkit", "zepto", "instamart", "bigbasket", "bb daily", "dmart", "natures basket", "supermarket", "grocery"
    ],
  },
  {
    category: "Transportation",
    keywords: [
      "uber", "ola", "rapido", "metro", "irctc", "railway", "train", "flight", "indigo",
      "air india", "petrol", "fuel", "hpcl", "bpcl", "iocl", "shell", "fastag", "toll"
    ],
  },
  {
    category: "Shopping",
    keywords: [
      "amazon", "flipkart", "myntra", "ajio", "nykaa", "meesho", "tata cliq", "croma",
      "reliance retail", "lifestyle", "shoppers stop", "zara", "h&m", "uniqlo", "retail"
    ],
  },
  {
    category: "Entertainment",
    keywords: [
      "netflix", "spotify", "prime video", "hotstar", "disney", "youtube", "bookmyshow",
      "pvr", "inox", "cinema", "apple.com/bill", "google play", "steam", "playstation"
    ],
  },
  {
    category: "Utilities",
    keywords: [
      "airtel", "jio", "vodafone", "vi ", "bescom", "tneb", "electricity", "broadband",
      "wifi", "water bill", "piped gas", "indane", "hp gas", "bharat gas", "act fibernet"
    ],
  },
  {
    category: "Healthcare",
    keywords: [
      "apollo", "pharmeasy", "1mg", "tata 1mg", "medplus", "netmeds", "hospital",
      "clinic", "dental", "pharmacy", "diagnostic", "dr ", "doctor", "lab"
    ],
  },
  {
    category: "Housing",
    keywords: ["rent", "maintenance", "society", "nobroker", "housing", "landlord", "flat maintenance"],
  },
  {
    category: "Salary",
    keywords: ["salary", "payroll", "stipend", "bonus", "wages", "salary credit"],
  },
  {
    category: "Investment",
    keywords: [
      "zerodha", "groww", "indmoney", "upstox", "angel one", "kite", "coin", "motilal",
      "mutual fund", "mf sip", "uti mf", "hdfc mf", "sbi mf", "ppf", "nps", "etmoney"
    ],
  },
  {
    category: "Financial",
    keywords: ["cred", "credit card", "cc payment", "loan emi", "hdfc credit", "sbi card", "icici credit", "billdesk"],
  },
  {
    category: "Interest",
    keywords: ["interest paid", "credit interest", "int.pd", "int.coll", "savings interest"],
  },
];

export function detectCategoryFromNarration(narration: string): string | null {
  if (!narration) return null;
  const lower = narration.toLowerCase();

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.category;
    }
  }

  return null;
}
