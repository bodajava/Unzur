import type { Locale } from "@/i18n/config";

/**
 * Store policies (returns, shipping, privacy, terms) in both languages.
 * Plain data so the store owner can review and edit the wording here; the
 * page at /[lang]/legal/[slug] renders it. Numbers (days, hours) must match
 * how the store actually works; shipping fees live in the dashboard.
 */
export const LEGAL_SLUGS = ["returns", "shipping", "privacy", "terms"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export type LegalSection = { heading: string; body: string[]; list?: string[] };
export type LegalDoc = { title: string; summary: string; sections: LegalSection[] };

/** When the texts were last reviewed (shown on every page). */
export const LEGAL_UPDATED = "2026-11-19";

export const legal: Record<Locale, Record<LegalSlug, LegalDoc>> = {
  ar: {
    returns: {
      title: "الاسترجاع والاستبدال",
      summary: "عندك 14 يوم من استلام القطعة علشان ترجّعها أو تستبدلها، طبقًا لقانون حماية المستهلك المصري.",
      sections: [
        {
          heading: "مدة الاسترجاع",
          body: [
            "تقدر تطلب استرجاع أو استبدال أي قطعة خلال 14 يوم من يوم استلامها.",
            "ابعتلنا طلبك من صفحة التواصل أو على الإيميل، ومعاه رقم الطلب وسبب الاسترجاع.",
          ],
        },
        {
          heading: "شروط القطعة المرتجعة",
          body: ["علشان نقبل الاسترجاع لازم القطعة تكون:"],
          list: [
            "مش مستخدمة، وبحالتها اللي وصلتك بيها.",
            "في تغليفها الأصلي ومعاها كل ملحقاتها.",
            "معاها إيصال الطلب أو رقمه.",
          ],
        },
        {
          heading: "قطع ما ينفعش ترجع",
          body: ["القطع المعمولة مخصوص على طلبك (مقاس أو لون أو خامة مختلفة) ما ينفعش ترجع، إلا لو فيها عيب صناعة."],
        },
        {
          heading: "لو القطعة وصلت فيها عيب أو كسر",
          body: [
            "افحص القطعة وقت الاستلام. لو فيها كسر أو عيب، بلّغنا خلال 48 ساعة من الاستلام ومعاك صور واضحة.",
            "في الحالة دي إحنا بنتحمّل مصاريف الشحن كلها، وبنبدّل القطعة أو بنرجّعلك فلوسك كاملة، حسب اختيارك.",
          ],
        },
        {
          heading: "مصاريف الشحن",
          body: ["لو الاسترجاع لسبب غير العيب (غيّرت رأيك مثلًا)، مصاريف شحن الإرجاع على العميل، ومصاريف الشحن الأصلية ما بترجعش."],
        },
        {
          heading: "رجوع الفلوس",
          body: [
            "بعد ما القطعة توصلنا ونتأكد من حالتها، بنرجّع المبلغ خلال 14 يوم:",
          ],
          list: [
            "الدفع بالكارت: على نفس الكارت اللي دفعت بيه (البنك ممكن ياخد أيام زيادة علشان يظهر).",
            "الدفع عند الاستلام: تحويل بنكي أو محفظة إلكترونية، حسب اللي يناسبك.",
          ],
        },
        {
          heading: "إلغاء الطلب",
          body: [
            "تقدر تلغي طلبك من صفحة حسابك أو تتواصل معانا طول ما الطلب لسه ما اتشحنش.",
            "لو كنت دفعت بالكارت، بنرجّعلك المبلغ كامل. بعد الشحن، الطلب بيتعامل كاسترجاع.",
          ],
        },
      ],
    },
    shipping: {
      title: "الشحن والتوصيل",
      summary: "بنوصّل لكل محافظات مصر. سعر الشحن ومدته بيظهروا قبل ما تأكد الطلب.",
      sections: [
        {
          heading: "فين بنوصّل",
          body: ["بنوصّل لكل محافظات مصر (27 محافظة)."],
        },
        {
          heading: "سعر الشحن",
          body: [
            "سعر الشحن بيختلف حسب المحافظة، وبيتحسب لوحده في صفحة إتمام الشراء أول ما تختار محافظتك، قبل ما تدفع أي حاجة.",
            "ساعات بيكون فيه شحن مجاني فوق مبلغ معيّن، ولو موجود هيظهرلك في السلة.",
          ],
        },
        {
          heading: "مدة التوصيل",
          body: ["المدة بتبدأ من تأكيد الطلب، وبتكون تقريبًا:"],
          list: [
            "القاهرة والجيزة: من يوم ليومين شغل.",
            "الإسكندرية والقليوبية: من يومين لـ 3 أيام.",
            "محافظات الدلتا والقناة: من يومين لـ 4 أيام.",
            "الصعيد والمحافظات الحدودية: من 3 لـ 7 أيام.",
          ],
        },
        {
          heading: "القطع المعمولة على الطلب",
          body: ["لو القطعة بتتعمل مخصوص ليك، مدة التنفيذ هتتكتب في صفحة المنتج أو هنبلّغك بيها قبل التأكيد، وبعدها مدة الشحن العادية."],
        },
        {
          heading: "تتبّع الطلب",
          body: [
            "هيوصلك إيميل في كل مرحلة: التأكيد، والتجهيز، والشحن، والتسليم.",
            "تقدر كمان تتابع طلبك من صفحة تتبّع الطلب برقم الطلب.",
          ],
        },
        {
          heading: "وقت الاستلام",
          body: [
            "اتأكد إن العنوان ورقم الموبايل صح، علشان المندوب هيكلّمك قبل ما يوصل.",
            "افحص القطعة قدام المندوب لو تقدر. لو فيه أي كسر، بلّغنا خلال 48 ساعة (شوف سياسة الاسترجاع).",
          ],
        },
      ],
    },
    privacy: {
      title: "سياسة الخصوصية",
      summary: "إحنا بنجمع أقل بيانات محتاجينها علشان نوصّلك طلبك، ومش بنبيعها لحد. السياسة دي ماشية مع قانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020.",
      sections: [
        {
          heading: "البيانات اللي بنجمعها",
          body: ["لما تطلب أو تعمل حساب، بنحتفظ بـ:"],
          list: [
            "اسمك وإيميلك ورقم موبايلك.",
            "عنوان التوصيل.",
            "طلباتك وسلّتك وقايمة المفضلة.",
            "الرسائل اللي بتبعتهالنا من صفحة التواصل.",
          ],
        },
        {
          heading: "بيانات الدفع",
          body: ["الدفع بالكارت بيتم بالكامل عن طريق Paymob. إحنا ما بنشوفش ولا بنخزّن رقم الكارت أو الـ CVV."],
        },
        {
          heading: "بنستخدم البيانات في إيه",
          list: [
            "تنفيذ طلبك وتوصيله والتواصل معاك بخصوصه.",
            "إيميلات حالة الطلب، وإشعارات المتصفح لو وافقت عليها.",
            "النشرة البريدية والعروض، بس لو اشتركت، وتقدر تلغي الاشتراك من أي إيميل.",
            "تحسين الموقع ومعرفة القطع اللي الناس بتحبها.",
            "حماية الموقع من الاحتيال والاستخدام الغلط.",
          ],
          body: [],
        },
        {
          heading: "مين بيشوف البيانات",
          body: ["ما بنبيعش بياناتك ولا بنأجّرها. بنشارك بس اللي لازم مع:"],
          list: [
            "شركة الشحن: اسمك وعنوانك ورقمك علشان توصّل الطلب.",
            "Paymob: لتنفيذ الدفع بالكارت.",
            "مزوّدي الخدمة اللي الموقع شغال عليهم (الاستضافة والإيميل والإشعارات)، وبيلتزموا يحافظوا عليها.",
            "الجهات الرسمية لو القانون طلب ده.",
          ],
        },
        {
          heading: "الكوكيز",
          body: ["بنستخدم كوكيز ضرورية بس: علشان تفضل مسجّل دخول، وعلشان سلّتك ما تضيعش. ما بنستخدمش كوكيز إعلانات."],
        },
        {
          heading: "حقوقك",
          body: ["من حقك تطلب نسخة من بياناتك، أو تصحيحها، أو مسحها. ابعتلنا من صفحة التواصل وهنرد خلال 14 يوم."],
        },
        {
          heading: "حماية البيانات",
          body: ["الموقع كله شغال على اتصال مشفّر (HTTPS)، وكلمات السر متخزّنة بشكل مشفّر، والوصول للبيانات محدود على فريق الشغل بس."],
        },
      ],
    },
    terms: {
      title: "الشروط والأحكام",
      summary: "استخدامك للموقع أو طلبك منه معناه إنك موافق على الشروط دي.",
      sections: [
        {
          heading: "عن المتجر",
          body: ["أنظر UNZUR براند مصري لتصميم الأثاث والإضاءة. الموقع ده هو المتجر الرسمي للبراند."],
        },
        {
          heading: "الأسعار",
          list: [
            "كل الأسعار بالجنيه المصري.",
            "سعر الشحن بيتضاف في صفحة إتمام الشراء حسب المحافظة.",
            "ممكن نغيّر الأسعار في أي وقت، بس السعر اللي بيتحسب هو اللي كان ظاهر وقت ما أكّدت الطلب.",
          ],
          body: [],
        },
        {
          heading: "الصور والمنتجات",
          body: [
            "بنحاول الصور تكون أقرب حاجة للقطعة الحقيقية، بس الألوان ممكن تختلف شوية حسب الشاشة والإضاءة.",
            "القطع اللي بتتعمل يدوي ممكن يكون فيها فروق بسيطة بين قطعة والتانية، ودي جزء من طبيعتها مش عيب.",
          ],
        },
        {
          heading: "الطلب والتأكيد",
          list: [
            "الطلب بيتأكد لما يوصلك إيميل التأكيد.",
            "طلبات الدفع بالكارت اللي ما اتدفعتش خلال وقت محدد بتتلغي لوحدها، والقطعة بترجع للمخزون.",
            "من حقنا نلغي طلب لو المنتج خلص أو كان فيه غلط واضح في السعر، وساعتها بنرجّع أي مبلغ اتدفع كامل.",
          ],
          body: [],
        },
        {
          heading: "الكوبونات",
          body: ["كل كوبون ليه شروطه (المدة، وأقل مبلغ، وعدد مرات الاستخدام). ما ينفعش يتحوّل لفلوس، وما ينفعش يتجمع مع كوبون تاني."],
        },
        {
          heading: "حسابك",
          body: ["إنت مسؤول عن سرية كلمة السر بتاعتك وعن أي طلب بيتعمل من حسابك. لو حسيت إن حد دخل عليه، غيّر كلمة السر وكلّمنا."],
        },
        {
          heading: "حقوق الملكية",
          body: ["التصاميم والصور والاسم واللوجو كلها ملك أنظر UNZUR. ممنوع نسخها أو استخدامها تجاريًا من غير إذن مكتوب."],
        },
        {
          heading: "القانون",
          body: ["الشروط دي بتخضع لقوانين جمهورية مصر العربية، ومنها قانون حماية المستهلك رقم 181 لسنة 2018."],
        },
      ],
    },
  },
  en: {
    returns: {
      title: "Returns & exchanges",
      summary: "You have 14 days from delivery to return or exchange a piece, in line with Egypt's Consumer Protection Law.",
      sections: [
        {
          heading: "Return window",
          body: [
            "You can ask to return or exchange any piece within 14 days of receiving it.",
            "Send us your request from the contact page or by email, with your order number and the reason.",
          ],
        },
        {
          heading: "Condition of returned pieces",
          body: ["To accept a return, the piece must be:"],
          list: [
            "Unused and in the condition it arrived in.",
            "In its original packaging, with everything that came with it.",
            "Accompanied by the order receipt or number.",
          ],
        },
        {
          heading: "Pieces that can't be returned",
          body: ["Pieces made to your order (a custom size, colour or material) can't be returned unless they have a manufacturing defect."],
        },
        {
          heading: "If a piece arrives damaged",
          body: [
            "Check the piece when it arrives. If it is broken or faulty, tell us within 48 hours of delivery and include clear photos.",
            "We then cover all shipping costs and either replace the piece or refund you in full, whichever you prefer.",
          ],
        },
        {
          heading: "Shipping costs",
          body: ["For returns that aren't due to a defect (if you changed your mind, for example), the return shipping is on you and the original shipping fee isn't refunded."],
        },
        {
          heading: "Refunds",
          body: ["Once the piece reaches us and we've checked it, we refund you within 14 days:"],
          list: [
            "Card payments: back to the same card (your bank may take a few extra days to show it).",
            "Cash on delivery: by bank transfer or mobile wallet, whichever suits you.",
          ],
        },
        {
          heading: "Cancelling an order",
          body: [
            "You can cancel from your account page, or contact us, as long as the order hasn't shipped.",
            "If you paid by card, you get a full refund. Once an order has shipped, it is handled as a return.",
          ],
        },
      ],
    },
    shipping: {
      title: "Shipping & delivery",
      summary: "We deliver across Egypt. The shipping fee and delivery time are shown before you confirm your order.",
      sections: [
        {
          heading: "Where we deliver",
          body: ["We deliver to every governorate in Egypt (all 27)."],
        },
        {
          heading: "Shipping fee",
          body: [
            "The fee depends on your governorate and is worked out at checkout as soon as you choose it, before you pay anything.",
            "Free shipping above a certain amount is sometimes available; when it is, your cart shows it.",
          ],
        },
        {
          heading: "Delivery time",
          body: ["Counted from order confirmation, roughly:"],
          list: [
            "Cairo and Giza: 1–2 working days.",
            "Alexandria and Qalyubia: 2–3 days.",
            "Delta and Canal governorates: 2–4 days.",
            "Upper Egypt and border governorates: 3–7 days.",
          ],
        },
        {
          heading: "Made-to-order pieces",
          body: ["If a piece is made for you, the making time is stated on the product page or confirmed with you before the order, followed by the usual delivery time."],
        },
        {
          heading: "Tracking your order",
          body: [
            "You get an email at every step: confirmed, preparing, shipped and delivered.",
            "You can also follow your order on the order tracking page with your order number.",
          ],
        },
        {
          heading: "On delivery",
          body: [
            "Make sure your address and phone number are right; the courier calls before arriving.",
            "Check the piece in front of the courier if you can. If anything is broken, tell us within 48 hours (see the returns policy).",
          ],
        },
      ],
    },
    privacy: {
      title: "Privacy policy",
      summary: "We collect the least data we need to deliver your order, and we never sell it. This policy follows Egypt's Personal Data Protection Law No. 151 of 2020.",
      sections: [
        {
          heading: "What we collect",
          body: ["When you order or create an account, we keep:"],
          list: [
            "Your name, email and mobile number.",
            "Your delivery address.",
            "Your orders, cart and wishlist.",
            "Messages you send us from the contact page.",
          ],
        },
        {
          heading: "Payment details",
          body: ["Card payments are handled entirely by Paymob. We never see or store your card number or CVV."],
        },
        {
          heading: "How we use it",
          body: [],
          list: [
            "To fulfil and deliver your order and contact you about it.",
            "To send order status emails, and browser notifications if you allow them.",
            "To send the newsletter and offers, only if you subscribed; every email has an unsubscribe link.",
            "To improve the site and learn which pieces people like.",
            "To protect the site from fraud and misuse.",
          ],
        },
        {
          heading: "Who sees it",
          body: ["We don't sell or rent your data. We only share what's needed with:"],
          list: [
            "The courier: your name, address and number, to deliver your order.",
            "Paymob: to process card payments.",
            "The providers the site runs on (hosting, email and notifications), who are bound to protect it.",
            "Authorities, when the law requires it.",
          ],
        },
        {
          heading: "Cookies",
          body: ["We only use essential cookies: to keep you signed in and to keep your cart. We don't use advertising cookies."],
        },
        {
          heading: "Your rights",
          body: ["You can ask for a copy of your data, have it corrected, or have it deleted. Write to us from the contact page and we'll reply within 14 days."],
        },
        {
          heading: "Keeping it safe",
          body: ["The whole site runs over an encrypted connection (HTTPS), passwords are stored hashed, and access to data is limited to our team."],
        },
      ],
    },
    terms: {
      title: "Terms & conditions",
      summary: "By using this site or ordering from it, you agree to these terms.",
      sections: [
        {
          heading: "About the store",
          body: ["UNZUR (أنظر) is an Egyptian furniture and lighting design brand. This site is the brand's official store."],
        },
        {
          heading: "Prices",
          body: [],
          list: [
            "All prices are in Egyptian pounds.",
            "Shipping is added at checkout based on your governorate.",
            "Prices may change at any time; you pay the price shown when you confirmed your order.",
          ],
        },
        {
          heading: "Photos and products",
          body: [
            "We aim for photos as close to the real piece as possible, but colours can look slightly different depending on your screen and lighting.",
            "Handmade pieces can vary slightly from one to the next; that is part of their nature, not a defect.",
          ],
        },
        {
          heading: "Orders and confirmation",
          body: [],
          list: [
            "An order is confirmed once you receive the confirmation email.",
            "Card orders left unpaid for a set time are cancelled automatically and the piece goes back into stock.",
            "We may cancel an order if a piece sells out or a price was clearly wrong; any amount paid is then refunded in full.",
          ],
        },
        {
          heading: "Coupons",
          body: ["Each coupon has its own conditions (dates, minimum order, number of uses). Coupons can't be exchanged for cash or combined with another coupon."],
        },
        {
          heading: "Your account",
          body: ["You're responsible for keeping your password private and for orders placed from your account. If you think someone else got in, change your password and contact us."],
        },
        {
          heading: "Intellectual property",
          body: ["The designs, photos, name and logo all belong to UNZUR. Copying them or using them commercially without written permission isn't allowed."],
        },
        {
          heading: "Governing law",
          body: ["These terms are governed by the laws of the Arab Republic of Egypt, including Consumer Protection Law No. 181 of 2018."],
        },
      ],
    },
  },
};
