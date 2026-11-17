import type { Dictionary } from "./en";

/** النصوص العربية. نفس مفاتيح en.ts بالضبط. */
export const ar: Dictionary = {
  meta: {
    title: "أنظر UNZUR — أثاث وإضاءة نحتية",
    description:
      "أنظر يصمّم أثاثًا وإضاءة نحتية تستلهم أشكالها من العمارة والخيال. تسوّق كراسي وطاولات ورفوف وأباجورات صُنعت لتُرى.",
    bestSellersList: "الأكثر مبيعًا في أنظر",
  },
  common: {
    skipToContent: "تخطَّ إلى المحتوى",
    close: "إغلاق",
    home: "الرئيسية",
    arrow: "←",
    tagline: "انظر أو كُفّ عن النظر",
  },
  nav: {
    main: "التنقل الرئيسي",
    mobile: "قائمة الجوال",
    menu: "القائمة",
    bestSellers: "الأكثر مبيعًا",
    account: "حسابي",
    search: "بحث",
    cart: "السلة: {count}",
    cartLabel: {
      zero: "السلة فارغة",
      one: "السلة، قطعة واحدة",
      two: "السلة، قطعتان",
      few: "السلة، {count} قطع",
      many: "السلة، {count} قطعة",
      other: "السلة، {count} قطعة",
    },
    homeLabel: "الصفحة الرئيسية لأنظر",
    language: "EN",
    languageLabel: "Read the site in English",
    marquee: ["UNZUR", "انظر أو كُفّ عن النظر", "Look, or stop looking", "أثاث وإضاءة"],
  },
  theme: {
    night: "ليل",
    day: "نهار",
    toNight: "التبديل للوضع الليلي",
    toDay: "التبديل للوضع النهاري",
  },
  hero: {
    titleLine1: "انظر",
    titleLine2: "عن قُرب.",
    eyebrow: "أثاث وإضاءة نحتية",
    body: "كراسٍ وطاولات وإضاءة تستلهم أشكالها من العمارة والخيال. كل قطعة صُنعت لتُرى.",
    cta: "تسوّق القطع",
    collections: "المجموعات",
    rulerStart: "انظر",
    rulerEnd: "انظر عن قُرب",
    scrollHint: "مرّر لتطير للداخل",
  },
  concept: {
    title: "الفكرة",
    intro: "قطع مصنوعة بحرية الفن. أنظر لا يصمّم الأثاث ليملأ الغرفة، بل ليمنحها شخصية.",
    body: "قطع متجرّدة في الفن، حرّة في التعبير، تتجاوز المألوف لتعيد تعريف العلاقة بين الأثاث والمساحة. تستلهم أشكالها من العمارة والهندسة والخيال، وتجمع بين الجرأة والبساطة في تفاصيل تحمل طابعًا خاصًا. أنظر لا يصمّم الأثاث ليملأ الفراغ، بل ليمنحه شخصية؛ كل قطعة حضور مستقل، وكل زاوية فرصة لرؤية الأشياء بشكل مختلف.",
    bodyLang: "ar",
  },
  pieces: {
    title: "الأكثر مبيعًا",
    count: {
      zero: "لا توجد قطع",
      one: "قطعة واحدة",
      two: "قطعتان",
      few: "{count} قطع",
      many: "{count} قطعة",
      other: "{count} قطعة",
    },
    shopAll: "تسوّق الكل",
    empty: "قطع جديدة في الطريق. اشترك في النشرة بالأسفل لتعرف أولًا.",
  },
  collections: {
    eyebrow: "تسوّق حسب الفئة",
    title: "المجموعات",
  },
  product: {
    was: "بدلًا من",
  },
  search: {
    dialog: "بحث",
    label: "ابحث في القطع",
    placeholder: "ابحث في القطع",
    hint: "اكتب حرفين على الأقل — عربي أو English",
    unavailable: "البحث غير متاح الآن. حاول مرة أخرى بعد قليل.",
    noMatch: "لا توجد قطع تطابق «{q}». جرّب كلمة أخرى.",
  },
  newsletter: {
    title: "النشرة البريدية",
    blurb: "قطع جديدة وأخبار الاستوديو، بضع مرات في الموسم.",
    label: "البريد الإلكتروني",
    placeholder: "البريد الإلكتروني",
    submit: "اشترك",
    submitting: "جارٍ الاشتراك…",
    CREATED: "تم اشتراكك. راجع بريدك.",
    REACTIVATED: "أهلًا بعودتك. تم تفعيل اشتراكك من جديد.",
    ALREADY_SUBSCRIBED: "أنت مشترك بالفعل.",
  },
  footer: {
    columns: [
      {
        title: "الشركة",
        links: [
          { href: "/contact", label: "تواصل معنا" },
          { href: "/care", label: "العناية بالقطع" },
          { href: "/faq", label: "الأسئلة الشائعة" },
        ],
      },
      {
        title: "السياسات",
        links: [
          { href: "/customer-care", label: "رعاية العملاء" },
          { href: "/returns", label: "الاسترجاع والاستبدال" },
          { href: "/warranty", label: "الإصلاح والضمان" },
        ],
      },
      {
        title: "خدمة العملاء",
        links: [
          { href: "/stories", label: "حكايات" },
          { href: "/careers", label: "الوظائف" },
          { href: "/terms", label: "الشروط والأحكام" },
          { href: "/privacy", label: "سياسة الخصوصية" },
        ],
      },
    ],
    rights: "© أنظر UNZUR",
  },
  notFound: {
    title: "لا شيء لتنظر إليه هنا.",
    body: "الصفحة غير موجودة أو انتقلت. القطع ما زالت في مكانها.",
    back: "العودة للصفحة الرئيسية",
  },
  errors: {
    network: "لا يمكن الوصول للمتجر الآن. تأكد من الاتصال وحاول مرة أخرى.",
    generic: "حدث خطأ. حاول مرة أخرى.",
    sessionExpired: "انتهت جلستك. سجّل الدخول مرة أخرى للمتابعة.",
  },
  orderStatus: {
    PENDING_PAYMENT: "في انتظار الدفع",
    CONFIRMED: "تم التأكيد",
    PREPARING: "قيد التجهيز",
    SHIPPED: "في الطريق",
    DELIVERED: "تم التوصيل",
    CANCELLED: "ملغي",
    REFUNDED: "تم الاسترداد",
  },
  paymentStatus: {
    UNPAID: "غير مدفوع",
    PENDING: "الدفع قيد المعالجة",
    PAID: "مدفوع",
    FAILED: "فشل الدفع",
    REFUNDED: "تم الاسترداد",
    PARTIALLY_REFUNDED: "استرداد جزئي",
  },
  paymentMethod: {
    COD: "الدفع عند الاستلام",
    PAYMOB_CARD: "بطاقة بنكية",
    PAYMOB_WALLET: "محفظة إلكترونية",
  },
};
