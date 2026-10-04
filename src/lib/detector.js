// Local AI-text detector. It scores the stylistic fingerprints that LLM output
// tends to share (and that commercial detectors also weigh), per document and
// per sentence. English and French have full pattern packs; other languages
// get the language-independent signals only. It's an estimate, not proof:
// short texts and heavily edited text are hard for every detector.

// ---------- language packs ----------
// Lexicon weights — strong (1): rarely used by people, overused by LLMs;
// medium (0.5): common in LLM prose; weak (0.25): adds up in bulk.
const EN = {
  name: "English",
  strong: [
    "delve", "delves", "delving", "delved", "tapestry", "testament to", "multifaceted", "intricate", "intricacies",
    "nuanced", "pivotal", "realm", "underscore", "underscores", "underscoring", "showcase", "showcases", "showcasing",
    "foster", "fosters", "fostering", "leverage", "leverages", "leveraging", "seamless", "seamlessly", "holistic",
    "synergy", "paramount", "plethora", "myriad", "meticulous", "meticulously", "commendable", "invaluable",
    "transformative", "ever-evolving", "ever-changing", "fast-paced", "cutting-edge", "game-changer", "game changer",
    "embark", "embarking", "unleash", "unlock the", "unlocking", "harness the", "harnessing", "elevate", "elevating",
    "empower", "empowers", "empowering", "navigate the", "navigating the", "landscape", "bustling", "vibrant",
    "nestled", "boasts", "resonate", "resonates", "profound", "profoundly", "streamline", "streamlining",
    "revolutionize", "revolutionizing", "groundbreaking", "noteworthy", "unwavering", "interplay", "beacon",
    "treasure trove", "paving the way", "pave the way", "shed light", "sheds light", "a deep dive", "deep dive",
    "dive into", "delve into", "let's dive", "let's explore", "key takeaways", "key takeaway", "rich tapestry",
    "it is important to note", "it's important to note", "it is worth noting", "it's worth noting",
    "plays a crucial role", "plays a vital role", "plays a pivotal role", "play a crucial role", "play a vital role",
    "in today's", "in conclusion", "in summary", "to sum up", "at its core", "in the realm of", "serves as a",
    "stands as a", "i hope this email finds you well", "i hope this message finds you well", "i wanted to reach out",
    "please don't hesitate", "please do not hesitate", "don't hesitate to reach out", "feel free to reach out",
    "rest assured", "look no further", "in an era", "in a world where", "embrace the", "embracing", "a pivotal",
    "crucial", "vital", "robust", "endeavor", "endeavors", "enhance", "enhances", "enhancing", "optimize",
    "optimizing", "utilize", "utilizing", "facilitate", "facilitates", "actionable", "impactful", "thrive in",
    "stakeholders", "elevated", "underpin", "underpins", "bolster", "bolsters", "spearhead", "realm of",
    "i look forward to hearing from you", "i look forward to your response", "thank you for your time and consideration",
    "please let me know if you have any questions", "let me know if you have any questions or concerns",
    "i trust this message", "as we approach", "key deliverables", "potential roadblocks", "stay on track",
    "in today's digital age", "a fundamental shift", "not just a passing trend", "work-life balance",
    "a sense of purpose", "a sense of progress", "the power of", "the art of", "the beauty of",
    "these experiences have", "this experience has", "has equipped me", "have equipped me", "well-rounded",
    // chatbot "assistant voice"
    "great question", "if you'd like", "if you would like", "i'd be happy to", "happy to help", "hope this helps",
    "i hope this helps", "i can help you", "let me know if you", "here are some", "here are a few", "there are a few",
    "there are several", "keep in mind", "it's also worth", "can also play a role", "play a role", "plays a role",
    "the most common cause", "another possibility", "another option is", "in this article", "in this guide",
  ],
  medium: [
    "furthermore", "moreover", "additionally", "consequently", "ultimately", "notably", "essentially", "significantly",
    "effectively", "ensure", "ensures", "ensuring", "comprehensive", "innovative", "dynamic", "a wide range of",
    "a variety of", "valuable", "insights", "essential", "align with", "aligns with", "tailored", "cater to",
    "thrive", "thriving", "journey", "when it comes to", "it is essential", "it's essential", "it is crucial",
    "by doing so", "this ensures", "allowing you to", "in order to", "not only", "but also", "overall,",
    "firstly", "lastly", "navigate", "navigating", "landscape of", "evolving", "transform", "transforming",
    "foundation", "approach", "strategies", "strategic", "streamlined", "boost", "enhanced",
    "empowered", "meaningful", "engaging", "commitment to", "dedicated to", "a testament", "a myriad",
  ],
  weak: [
    "various", "numerous", "key", "significant", "process", "potential", "ability to", "importance of",
    "can help", "helps to", "help you", "whether", "unique", "overall", "however,", "therefore",
    "thus", "hence", "efficiency", "productivity", "well-being", "growth", "success",
  ],
  banned: [
    "furthermore", "moreover", "additionally", "consequently", "ultimately", "notably", "essentially",
    "a wide range of", "it is essential", "it's essential", "by doing so", "this ensures", "overall,",
  ],
  transition: /^(?:["“'(]?)(However|Moreover|Furthermore|Additionally|In addition|Overall|Ultimately|Consequently|Therefore|Thus|Hence|Notably|Importantly|Interestingly|Firstly|Secondly|Thirdly|Finally|Lastly|In conclusion|In summary|Similarly|Likewise|Conversely|Nevertheless|Nonetheless|As a result|In essence|Essentially|That said|With this in mind|This means|This ensures|This allows|This highlights|This approach|Another|One of the most|The (?:most|first|second|third|final|key|main) [\p{L}-]+ (?:is|are|was)|First,|Second,|Third,|By (?:doing|leveraging|embracing|understanding|focusing|prioritizing|taking|following|combining|investing))(?![\p{L}])/iu,
  participial: /,\s+(?:thereby\s+|ultimately\s+)?(highlighting|underscoring|ensuring|making|allowing|enabling|providing|creating|fostering|reflecting|showcasing|emphasizing|demonstrating|leading|offering|helping|contributing|resulting|paving|giving|reinforcing|signaling|marking|positioning|driving|shaping|transforming|empowering|enhancing|turning|setting|keeping)\b/i,
  conj: "and|or",
  formulas: [
    /\bnot only\b[^.!?]{0,90}\bbut\b/i,
    /\b(?:it'?s|it is|this is|that'?s|that is)\s+not\s+(?:just\s+)?(?:about\s+)?[^.!?;]{1,50}?[,;—–:]\s*(?:it'?s|it is|but|this is|that'?s)\b/i,
    /\b(?:isn'?t|aren'?t|is not|are not|wasn'?t)\s+(?:just|merely|simply|only)\b/i,
    /\bmore than (?:just|a|an)\b/i,
    /\bwhether you'?re\b/i,
    /\bhere'?s (?:the thing|why|how|what|the kicker|the catch)\b/i,
    /\blet'?s (?:dive|explore|break|take a (?:closer )?look|unpack|face it)\b/i,
    /\bin (?:a|an|today'?s) (?:world|era|age|landscape)\b/i,
    /\bnot because\b[^.!?]{0,60}\bbut because\b/i,
    /\b(?:no fluff|level up|next level|stand out from the crowd)\b/i,
    /\bfrom [\p{L}\s'-]{2,30} to [\p{L}\s'-]{2,30}, /iu,
    /\bthe (?:[\p{L}'’-]+ ){0,2}(?:part|surprise|result|answer|truth|catch|kicker|secret|problem|difference|takeaway|reason|twist|upside|downside|bottom line)\?/iu,
    /\b(?:does|do|is|are|means|offers|did) (?:so )?more than\b/i,
    /\brather than\b/i,
    /\binstead of\b[^.!?]{0,80},\s*(?:you|we|they|it|i)\b/i,
    /\b(?:my|the|our) (?:advice|answer|solution|fix|secret|rule|goal|idea|point|lesson|takeaway) (?:is|was) (?:simple|clear|this|easy|straightforward)\b/i,
    /\b(?:you|we) don'?t need\b[^.!?]{0,90}(?:—|–|,|\.)\s*just\b/i,
    /\b(?:small|tiny|little) (?:changes|steps|habits|wins|things) (?:compound|add up|matter|make a big difference)\b/i,
    /\badds? up to (?:something|a lot)\b/i,
    /\b(?:and|but) (?:that'?s|this is) (?:the|what) (?:point|key|difference|magic)\b/i,
  ],
  // "It isn't X. It's Y." split across two sentences.
  splitContrast: /\b(?:isn'?t|is not|aren'?t|are not|wasn'?t|was not|doesn'?t|don'?t)\b[^.!?]{0,70}[.!?]\s+(?:It'?s|It is|They'?re|This is|That'?s|It was)\b/,
  colonReveal: true,
  closer: /^(?:In conclusion|In summary|Overall|Ultimately|To sum up|In short|All in all|In the end|By (?:embracing|leveraging|understanding|following|taking|prioritizing|investing)|As (?:we|you) (?:move|look|navigate)|The bottom line|Moving forward|Going forward)\b/i,
  // Informal markers people use and LLMs rarely do ("honestly" and "literally"
  // are left out on purpose: casual-mode AI uses them constantly).
  human: /(?<![\p{L}])(lol|lmao|tbh|imo|imho|idk|gonna|wanna|gotta|kinda|sorta|yeah|yep|nope|nah|btw|ugh|meh|haha|hah|dunno|y'all|ain'?t|cuz|ok so|okay so|anyway|guys|damn|crap|lmk|w\/|re:|tho|thx|pls|i(?=\s))(?![\p{L}])/gu,
  contractions: /\b\p{L}+['’](?:s|t|re|ve|ll|d|m)\b/giu,
  examples: {
    transitions: `"Moreover", "Additionally", "By leveraging"`,
    participial: `", highlighting…" / ", ensuring…"`,
    triads: `"X, Y, and Z"`,
    formulas: `"It isn't X. It's Y", "does more than…", "The best part?", colon reveals`,
    cliches: `"I hope this email finds you well", "plays a crucial role"`,
  },
};

const FR = {
  name: "French",
  strong: [
    "il est important de noter", "il convient de noter", "il est essentiel de", "il est crucial de",
    "il est primordial de", "joue un rôle crucial", "joue un rôle clé", "joue un rôle essentiel", "joue un rôle central",
    "jouent un rôle", "jouer un rôle clé", "en constante évolution", "en perpétuelle évolution", "à l'ère du numérique",
    "à l'ère de", "dans un monde où", "dans le paysage", "véritable levier", "un levier", "incontournable",
    "mettre en lumière", "met en lumière", "témoigne de", "témoignent de", "s'inscrit dans", "s'inscrivent dans",
    "au cœur de", "valeur ajoutée", "relever les défis", "relever ce défi", "un atout majeur", "un atout précieux",
    "riche expérience", "solide expérience", "solides compétences", "profil polyvalent", "m'ont permis de",
    "m'a permis de", "m'ont aidé à", "m'a aidé à", "ces différentes expériences", "ces expériences m'ont",
    "n'hésitez pas à", "je me tiens à votre disposition", "en adéquation avec", "mettre à profit", "pleinement",
    "fort de", "forte de", "passionné par", "passionnée par", "je suis convaincu", "je suis convaincue",
    "je serais ravi", "je serais ravie", "synergie", "holistique", "en somme", "en définitive", "en conclusion",
    "pour conclure", "en résumé", "il ne s'agit pas seulement", "bien plus qu'un", "bien plus que", "non seulement",
    "tout en garantissant", "tout en assurant", "dans cette optique", "à cet égard", "force de proposition",
    "sens du détail", "cultiver", "favorisant", "renforçant", "garantissant", "optimiser", "optimisation",
    "fluidifier", "pérenne", "pérennité", "écosystème", "booster", "propulser", "en profondeur", "plus que jamais",
    "véritable", "véritables", "un véritable", "une véritable", "approche holistique", "levier de croissance",
    "servent d'intermédiaire", "sert d'intermédiaire", "à la croisée", "dynamique de", "riche et varié",
  ],
  medium: [
    "par ailleurs", "en outre", "de plus", "ainsi", "notamment", "crucial", "cruciale", "cruciaux", "essentiel",
    "essentielle", "essentiels", "primordial", "primordiale", "fondamental", "fondamentale", "favoriser", "favorise",
    "renforcer", "renforce", "permettant de", "permettant", "permet de", "permettent de", "au sein de", "approche",
    "polyvalent", "polyvalente", "dynamique", "rigoureux", "rigoureuse", "axé sur", "axée sur", "axés sur",
    "très axé", "innovant", "innovante", "innovants", "innovantes", "contribuer à", "contribue à", "mais également",
    "diverses", "performant", "performante", "performants", "optimal", "optimale", "accompagner", "valoriser",
    "consolider", "approfondir", "défis", "expertise", "en tant que", "tout en", "qu'il s'agisse", "que ce soit",
    "enjeux", "efficacement", "durable", "durables", "significatif", "significative", "considérablement",
    "d'après mes recherches", "évolution du produit", "améliorations", "dans ce contexte",
  ],
  weak: [
    "important", "importante", "plusieurs", "en effet", "afin de", "dans le cadre de", "compétences", "solution",
    "solutions", "différentes", "différents", "processus", "efficace", "efficacité", "qualité", "également",
    "contraintes", "évolution", "permet", "améliorer",
  ],
  banned: ["par ailleurs", "en outre", "de plus", "notamment", "crucial", "cruciale", "essentiel", "primordial", "permettant de", "au sein de", "dynamique", "polyvalent", "innovant"],
  transition: /^(?:["«“'(]?\s*)(Par ailleurs|En outre|De plus|Ainsi|En effet|Enfin|En somme|En conclusion|En définitive|Pour conclure|En résumé|Cependant|Néanmoins|Toutefois|Dans ce contexte|Dans cette optique|C'est pourquoi|Fort(?:e)? de|Grâce à|En tant que|Qu'il s'agisse|Au-delà de|D'une part|D'autre part|Premièrement|Deuxièmement|Troisièmement|Finalement|Pour ce faire|À cet égard|Dans un premier temps|Dans un second temps|Également|Notamment|Ces (?:différentes |diverses )?expériences)(?![\p{L}])/iu,
  participial: /,\s+(?:tout en\s+)?(permettant|garantissant|assurant|favorisant|renforçant|offrant|contribuant|soulignant|témoignant|illustrant|démontrant|reflétant|créant|facilitant|alliant|apportant|ouvrant|rendant|optimisant|améliorant|consolidant)\b/i,
  conj: "et|ou",
  formulas: [
    /\bnon seulement\b[^.!?]{0,90}\bmais\b/i,
    /\b(?:ce n'est|il ne s'agit|ce ne sont) pas (?:seulement|simplement|uniquement|juste|qu'une?)\b/i,
    /\bbien plus qu(?:e|')/i,
    /\bplus qu'une? simple\b/i,
    /\bqu'il s'agisse\b/i,
    /\bque ce soit\b[^.!?]{0,60}\bou\b/i,
    /\b(?:le|la|les) (?:résultat|clé|secret|réponse|vérité|bonne nouvelle|différence|raison)\s?\?/i,
    /(?:^|[.!?]\s+)Et si\b[^.!?]{0,80}\?/,
    /\bà la croisée (?:des|de)\b/i,
    /\bplutôt que\b/i,
    /\bau lieu de\b[^.!?]{0,80},/i,
    /\bdans un monde (?:où|en)\b/i,
    /\b(?:ces|mes) (?:différentes |diverses |nombreuses )?expériences m'ont\b/i,
    /\bce qui (?:me |m')(?:permet|a permis|motive|pousse)\b/i,
    /\b(?:allier|alliant|conjuguer|conjuguant)\b[^.!?]{0,60}\bet\b/i,
  ],
  splitContrast: /\b(?:n'est pas|ne sont pas|n'était pas|ne s'agit pas)\b[^.!?]{0,70}[.!?]\s+(?:C'est|Il s'agit|Ce sont|C'était)\b/,
  colonReveal: false, // "mot : suite" is ordinary French typography
  closer: /^(?:En conclusion|En somme|En définitive|Pour conclure|En résumé|Pour toutes ces raisons|Au final|Ainsi,)/i,
  human: /(?<![\p{L}])(bref|du coup|genre|bah|ben|ouais|truc|trucs|machin|pas mal|franchement|perso|j'avoue|mdr|ptdr|lol|svp|stp|hein|voilà|grave|carrément|nickel|boulot|taf|bosser|bosse|galère|galérer|ouf|ect|etc\.\.\.)(?![\p{L}])/giu,
  // French words typed without their accents: a strong sign of a person typing fast.
  accentless: /(?<![\p{L}])(tres|deja|apres|etre|meme|ca|probleme|systeme|equipe|periode|deuxieme|reussi|developpe|developper|developpement|ete|interesse|francais|creer|cree|specialise|reseau|securite|donnees|premiere|derniere|annee|annees|etudes|etudiant|ecole|eleve|realise|realiser|integre|integrer|resultat|resultats|competences|experience|experiences|deplacement|demenager|etranger)(?![\p{L}])/giu,
  contractions: null,
  examples: {
    transitions: `"Par ailleurs", "En outre", "Fort de"`,
    participial: `", permettant…" / ", garantissant…"`,
    triads: `"X, Y et Z"`,
    formulas: `"non seulement… mais", "bien plus que", "plutôt que", "Ces expériences m'ont…"`,
    cliches: `"joue un rôle clé", "en constante évolution", "m'ont permis de"`,
  },
};

// Signals that work in any language.
const BASE = {
  name: "",
  strong: [], medium: [], weak: [], banned: [],
  transition: null, participial: null, conj: "and|or|et|ou|y|o|und|oder|e|en|of",
  formulas: [], splitContrast: null, colonReveal: false, closer: null, human: null, contractions: null,
  examples: { transitions: "", participial: "", triads: `"X, Y and Z"`, formulas: "", cliches: "" },
};

const PACKS = { en: EN, fr: FR };
for (const pack of Object.values(PACKS)) compile(pack);
compile(BASE);

function compile(pack) {
  pack.lexicon = new Map();
  for (const [list, w] of [[pack.weak, 0.25], [pack.medium, 0.5], [pack.strong, 1]]) for (const p of list) pack.lexicon.set(p, w);
  pack.lexiconRe = pack.lexicon.size
    ? new RegExp(`(?<![\\p{L}'’-])(${[...pack.lexicon.keys()].sort((a, b) => b.length - a.length).map(escapeRegex).join("|")})(?![\\p{L}'’-])`, "giu")
    : null;
  pack.triad = new RegExp(`[\\p{L}'’-]+(?:\\s[\\p{L}'’-]+){0,2},\\s[\\p{L}'’-]+(?:\\s[\\p{L}'’-]+){0,2},?\\s(?:${pack.conj})\\s[\\p{L}'’-]+`, "u");
}

const STRONG_TEST = new RegExp(
  `(?<![\\p{L}])(${[...EN.strong, ...FR.strong].map(escapeRegex).join("|")})(?![\\p{L}])`,
  "iu"
);

export const isAiPhrase = (s) => STRONG_TEST.test(s);

// Phrases the humanizer is told never to use, for the text's language.
export function bannedPhrases(lang) {
  const pack = PACKS[lang] || EN;
  return [...pack.strong, ...pack.banned];
}

const LANG_NAMES = { en: "English", fr: "French" };
export const languageName = (lang) => LANG_NAMES[lang] || "";

// Rough language guess from very common function words.
export function detectLanguage(text) {
  const count = (re) => (text.match(re) || []).length;
  const en = count(/(?<![\p{L}])(the|and|is|are|of|to|that|it|for|with|was|this|you|not|have|be|on|they|we)(?![\p{L}])/giu);
  const fr = count(/(?<![\p{L}])(le|la|les|des|une|est|et|que|qui|dans|pour|pas|sur|avec|je|vous|nous|du|au|aux|ce|cette|mais|été|être|j'ai|c'est|n'est|mes|vos)(?![\p{L}])/giu);
  if (en + fr < 4) return "other";
  if (fr > en * 1.3) return "fr";
  if (en > fr * 1.3) return "en";
  return "other";
}

const MARKDOWN = /^\s*(?:#{1,4}\s|\*\*[^*\n]+\*\*:?\s*$|[-*•]\s+\*\*[^*\n]+\*\*|\d+\.\s+\*\*[^*\n]+\*\*)/gm;
const COLON_REVEAL = /(?<![\p{L}])(?!re:)[\p{L}\d)'’]{3,}:\s+(?!\/\/)\p{L}/u;
const HUMAN_PUNCT = /(\.\.\.(?!\.)|…|!!|\?\?|\?!|!\?|:\)|:\(|;\)|:D|\bxD\b)/g;

// Typing quirks people make and LLMs don't, in any language.
function typingQuirks(text, sentences) {
  let n = 0;
  n += sentences.filter((s) => /^\p{Ll}/u.test(s.text)).length; // sentence starting in lowercase
  n += (text.match(/\p{L}\s+,/gu) || []).length;                // space before a comma
  n += (text.match(/,(?=\p{L})/gu) || []).length;                // no space after a comma
  n += (text.match(/\(\s|\s\)/g) || []).length;                  // spaces inside parentheses
  n += (text.match(/(?<![\p{L}])(\p{L}{2,})\s+\1(?![\p{L}])/giu) || []).length; // doubled word
  n += (text.match(/ {2,}(?=\S)/g) || []).length;                // double spaces mid-line
  return n;
}

// ---------- detector ----------
export function detect(text) {
  const lang = detectLanguage(text);
  const pack = PACKS[lang] || BASE;
  const words = countWords(text);
  const sentences = splitSentences(text);
  const lengths = sentences.map((s) => s.words);
  const mean = avg(lengths);
  const cv = mean ? Math.sqrt(avg(lengths.map((l) => (l - mean) ** 2))) / mean : 0;
  const per100 = (n) => (words ? (n / words) * 100 : 0);
  const matchAll = (re, s) => (re ? [...s.matchAll(re)] : []);
  const countRe = (re, s) => (re ? (s.match(re) || []).length : 0);

  // Phrase hits (with positions, for highlighting).
  const phrases = [];
  let lexWeight = 0;
  for (const m of matchAll(pack.lexiconRe, text)) {
    const w = pack.lexicon.get(m[0].toLowerCase()) ?? 0.25;
    lexWeight += w;
    if (w >= 0.5) phrases.push([m.index, m.index + m[0].length]);
  }

  // Per-sentence signals.
  let transitions = 0, triads = 0, participials = 0, formulas = 0, cliches = 0;
  sentences.forEach((s, i) => {
    const next = sentences[i + 1];
    s.reasons = [];
    let score = 0;
    const lex = matchAll(pack.lexiconRe, s.text).map((m) => [m[0], pack.lexicon.get(m[0].toLowerCase()) ?? 0.25]);
    const lexScore = lex.reduce((a, [, w]) => a + w * 0.3, 0);
    if (lexScore >= 0.15) { score += Math.min(lexScore, 0.6); s.reasons.push(`AI vocabulary: ${[...new Set(lex.filter(([, w]) => w >= 0.5).map(([p]) => p.toLowerCase()))].join(", ") || "generic wording"}`); }
    const cliche = lex.filter(([p, w]) => w === 1 && p.includes(" ")).length;
    if (cliche) { cliches += cliche; score += 0.25; s.reasons.push("stock phrase"); }
    if (pack.transition?.test(s.text)) { transitions++; score += 0.25; s.reasons.push("opens with a stock transition"); }
    if (pack.triad.test(s.text)) { triads++; score += 0.2; s.reasons.push("list of three"); }
    if (pack.participial?.test(s.text)) { participials++; score += 0.3; s.reasons.push("trailing participle clause"); }
    const formula =
      pack.formulas.some((r) => r.test(s.text)) ||
      (pack.splitContrast && next && pack.splitContrast.test(`${s.text} ${next.text}`) && !pack.splitContrast.test(next.text)) ||
      (pack.colonReveal && s.words >= 6 && COLON_REVEAL.test(s.text));
    if (formula) { formulas++; score += 0.35; s.reasons.push("formulaic construction (contrast, reveal, hook or self-summary)"); }
    if (/—|\s–\s/.test(s.text)) { score += 0.15; s.reasons.push("em dash"); }
    const human = countRe(pack.human, s.text) + countRe(HUMAN_PUNCT, s.text) + countRe(pack.accentless, s.text) +
      typingQuirks(s.text, [s]);
    if (human) score -= 0.3 * human;
    if (cv < 0.4 && mean && Math.abs(s.words - mean) < mean * 0.3 && s.words >= 12) score += 0.1;
    s.score = Math.max(0, Math.min(1, score));
  });
  const n = sentences.length || 1;

  // Document-level structure.
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  // Greetings, sign-offs and headings would make any text look uneven.
  const paraLens = paragraphs.map(countWords).filter((l) => l >= 12);
  const paraMean = avg(paraLens);
  const paraCv = paraMean ? Math.sqrt(avg(paraLens.map((l) => (l - paraMean) ** 2))) / paraMean : 0;
  const lastPara = paragraphs[paragraphs.length - 1] || "";
  const closes = paragraphs.length >= 3 && !!pack.closer?.test(lastPara);
  const markdown = (text.match(MARKDOWN) || []).length;
  const dashes = (text.match(/—|\s–\s/g) || []).length;
  const slang = countRe(pack.human, text) + countRe(HUMAN_PUNCT, text);
  const accentless = countRe(pack.accentless, text);
  const quirks = typingQuirks(text, sentences);
  const humanHits = slang + accentless + quirks;
  const contractions = countRe(pack.contractions, text);

  // Each signal: strength in [-1, 1] (negative = evidence of a human writer).
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const hasPack = pack !== BASE;
  // Rhythm needs enough sentences to mean anything.
  const rhythmWeight = sentences.length >= 8 ? 2.2 : sentences.length >= 5 ? 1.3 : 0.5;
  const ex = pack.examples;
  const signals = [
    {
      id: "rhythm", label: "Sentence rhythm", weight: rhythmWeight,
      strength: clamp((0.55 - cv) / 0.25, -1, 1),
      detail: `Length variety ${cv.toFixed(2)} (people usually write above 0.55; AI text is often 0.25–0.45)`,
    },
    hasPack && {
      id: "vocab", label: "AI vocabulary", weight: 2.6,
      strength: clamp((per100(lexWeight) - 0.6) / 1.8, -0.6, 1),
      detail: `${per100(lexWeight).toFixed(1)} weighted hits per 100 words`,
    },
    hasPack && {
      id: "cliches", label: "Stock phrases", weight: 1.6,
      strength: clamp(per100(cliches) / 1.2, 0, 1),
      detail: `${cliches} multi-word clichés (${ex.cliches}…)`,
    },
    hasPack && {
      id: "transitions", label: "Stock transitions", weight: 1.2,
      strength: clamp((transitions / n - 0.04) / 0.18, -0.3, 1),
      detail: `${transitions} of ${sentences.length} sentences open with ${ex.transitions}…`,
    },
    hasPack && {
      id: "participial", label: "Trailing participle clauses", weight: 1.3,
      strength: clamp((participials / n - 0.03) / 0.15, -0.2, 1),
      detail: `${participials} sentences end with ${ex.participial}-style clauses`,
    },
    {
      id: "triads", label: "Lists of three", weight: 1.0,
      strength: clamp((triads / n - 0.06) / 0.2, -0.3, 1),
      detail: `${triads} ${ex.triads} lists`,
    },
    hasPack && {
      id: "formulas", label: "Formulaic phrasing", weight: 1.8,
      strength: clamp(per100(formulas) / 1.2, 0, 1),
      detail: `${formulas} patterns like ${ex.formulas}`,
    },
    {
      id: "dashes", label: "Em dashes", weight: 0.9,
      strength: clamp(per100(dashes) / 0.8, 0, 1),
      detail: `${dashes} em dash${dashes === 1 ? "" : "es"}`,
    },
    {
      id: "structure", label: "Template structure", weight: 1.0,
      strength: clamp((markdown >= 2 ? 0.7 : 0) + (closes ? 0.6 : 0), 0, 1),
      detail: [markdown >= 2 && `${markdown} markdown headings/bold list items`, closes && "ends with a summary paragraph"].filter(Boolean).join("; ") || "No template structure",
    },
    {
      id: "paragraphs", label: "Even paragraphs", weight: paraLens.length >= 3 ? 0.8 : 0,
      strength: clamp((0.4 - paraCv) / 0.25, -1, 1),
      detail: `Paragraph length variety ${paraCv.toFixed(2)}`,
    },
    {
      id: "human", label: "Personal quirks", weight: 2.0,
      strength: -clamp(per100(humanHits) / 1.5, 0, 1),
      detail: humanHits
        ? [slang && `${slang} informal words or punctuation`, accentless && `${accentless} words typed without accents`, quirks && `${quirks} typing quirks (lowercase starts, spacing, repeats)`].filter(Boolean).join("; ")
        : "No slang, typing quirks or informal punctuation",
    },
    pack.contractions && {
      id: "contractions", label: "Contractions", weight: 0.5,
      strength: clamp((0.8 - per100(contractions)) / 1.5, -1, 0.6),
      detail: `${per100(contractions).toFixed(1)} per 100 words`,
    },
  ].filter((s) => s && s.weight > 0);

  const raw = signals.reduce((a, s) => a + s.weight * s.strength, 0);
  const score = Math.round(100 / (1 + Math.exp(-0.75 * (raw - 1.2))));
  const flagged = sentences.filter((s) => s.score >= 0.35);
  const reliable = words >= 60;

  return {
    score,
    lang,
    limited: !hasPack, // only language-independent signals were used
    verdict: !words ? "" : !reliable ? "Too short to judge" : score >= 70 ? "Likely AI" : score >= 45 ? "Mixed signals" : "Likely human",
    reliable,
    words,
    signals: signals.map((s) => ({ ...s, impact: s.weight * s.strength })).sort((a, b) => b.impact - a.impact),
    sentences,
    flagged,
    phrases,
  };
}

// Findings in a form the polish prompt can act on.
export function describeFindings(report, max = 8) {
  if (!report.reliable) return "";
  const doc = report.signals.filter((s) => s.impact > 0.4).map((s) => `- ${s.label}: ${s.detail}`);
  const sents = [...report.flagged]
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => `- "${s.text.trim()}" (${s.reasons.join("; ")})`);
  if (!doc.length && !sents.length) return "";
  return [
    `AI-likelihood score of the DRAFT: ${report.score}/100.`,
    doc.length && `Document-level problems:\n${doc.join("\n")}`,
    sents.length && `Sentences that read as machine-written (restructure these, don't just swap words):\n${sents.join("\n")}`,
  ].filter(Boolean).join("\n\n");
}

// What already makes a text read as human, so a rewrite can keep it.
export function describeHumanTraits(report) {
  return report.signals.filter((s) => s.impact < -0.3).map((s) => `- ${s.label}: ${s.detail}`).join("\n");
}

// ---------- helpers ----------
// Sentences with their positions in the text.
export function splitSentences(text) {
  const out = [];
  for (const m of text.matchAll(/[^.!?\n]+(?:[.!?…]+["'”’»)\]]*|(?=\n)|$)/g)) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    const w = countWords(body);
    if (w < 2) continue;
    out.push({ text: body, start: m.index + lead, end: m.index + lead + body.length, words: w });
  }
  return out;
}

function countWords(s) {
  return (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
}

function avg(a) {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
