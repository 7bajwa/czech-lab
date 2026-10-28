// Pronunciation lab data: minimal pairs (vowel length, soft consonants, ř…) and tongue twisters. Written by Claude.
export type MinPair = { a: string; aEn: string; b: string; bEn: string; point: string }

export const PAIRS: MinPair[] = [
  { a: 'byt', aEn: 'flat', b: 'být', bEn: 'to be', point: 'long í / ý: hold it twice as long' },
  { a: 'dal', aEn: 'he gave', b: 'dál', bEn: 'further', point: 'long á' },
  { a: 'pas', aEn: 'passport', b: 'pás', bEn: 'belt, strip', point: 'long á' },
  { a: 'rada', aEn: 'advice', b: 'ráda', bEn: 'glad (she)', point: 'long á, stress stays on the first syllable' },
  { a: 'vina', aEn: 'guilt', b: 'vína', bEn: 'wines', point: 'long á at the end' },
  { a: 'mile', aEn: 'nicely', b: 'míle', bEn: 'mile', point: 'long í' },
  { a: 'sud', aEn: 'barrel', b: 'sůl', bEn: 'salt', point: 'ů = long u' },
  { a: 'lec', aEn: '(dialect) some', b: 'léč', bEn: 'trap', point: 'long é and č' },
  { a: 'kos', aEn: 'blackbird', b: 'kóš', bEn: '(old) basket', point: 'long ó, s vs š' },
  { a: 'dej', aEn: 'give!', b: 'děj', bEn: 'plot, action', point: 'ď sound in dě' },
  { a: 'ten', aEn: 'that (m)', b: 'těm', bEn: 'to those', point: 'ť sound in tě' },
  { a: 'nos', aEn: 'nose', b: 'ňouma', bEn: 'clumsy person', point: 'ň sound' },
  { a: 'rada', aEn: 'advice', b: 'řada', bEn: 'row, line', point: 'ř: tongue tip vibrating while you buzz "ž"' },
  { a: 'reka', aEn: '(not a word)', b: 'řeka', bEn: 'river', point: 'ř at the start' },
  { a: 'trh', aEn: 'market', b: 'tři', bEn: 'three', point: 'tř cluster' },
  { a: 'sír', aEn: 'sulphur (gen.)', b: 'šír', bEn: 'width (poetic)', point: 's vs š' },
  { a: 'koza', aEn: 'goat', b: 'kůže', bEn: 'skin, leather', point: 'z vs ž, o vs ů' },
  { a: 'chudý', aEn: 'poor', b: 'hudba', bEn: 'music', point: 'ch (throat) vs h (voiced breath)' },
  { a: 'cena', aEn: 'price', b: 'čena', bEn: '(not a word)', point: 'c = ts, č = ch' },
  { a: 'mi', aEn: 'to me', b: 'my', bEn: 'we', point: 'i and y sound the same: spelling only' },
]

export const TWISTERS: { cz: string; en: string; point: string }[] = [
  { cz: 'Řeka, řepa, řeřicha.', en: 'River, beet, cress.', point: 'ř at the start of words' },
  { cz: 'Tři sta třicet tři stříbrných stříkaček.', en: '333 silver fire hoses.', point: 'tř and stř' },
  { cz: 'Strč prst skrz krk.', en: 'Stick a finger through the throat.', point: 'syllables with no vowel (r carries them)' },
  { cz: 'Dědeček dělá děti dětem.', en: 'Grandpa does things for the children.', point: 'dě = ďe' },
  { cz: 'Čtyři čtverce, čtyři kola.', en: 'Four squares, four wheels.', point: 'čtv, čty' },
  { cz: 'Chci chleba a chlebíček.', en: 'I want bread and an open sandwich.', point: 'ch' },
  { cz: 'Šest šedých šneků.', en: 'Six grey snails.', point: 'š' },
  { cz: 'Žena žehlí žluté šaty.', en: 'The woman irons a yellow dress.', point: 'ž vs š' },
  { cz: 'Nechtěl jsem ti nic říct.', en: "I didn't want to tell you anything.", point: 'ť, ř, ct' },
  { cz: 'Tuhle větu řeknu pomalu a zřetelně.', en: 'I will say this sentence slowly and clearly.', point: 'mixed, stress on first syllables' },
]
