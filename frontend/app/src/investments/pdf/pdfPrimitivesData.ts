/**
 * The shared furniture every investment report PDF is built from.
 *
 * Anything that decides how the paper *looks* — the running header and footer,
 * the section rhythm, the card surface, the table treatment — lives here, so
 * the two report documents (`ComparisonReportDocument`, `CompanyReportDocument`)
 * only decide what to say, never how to set it.
 *
 * This module imports `@react-pdf/renderer` at the top level on purpose: it is
 * only ever reached through the dynamic `import()` in `usePdfExport`, which is
 * what keeps ~400 kB of PDF machinery out of the app's initial bundle.
 */
import { Font, StyleSheet } from '@react-pdf/renderer'
import { PAGE, PDF_FONT_FAMILY, PDF_FONT_SOURCES, PRINT, RADIUS, TYPE } from './pdfTheme'

let fontsRegistered = false

/**
 * Idempotent — `Font.register` is global to the renderer, and an export can be
 * run many times in one session.
 */
export function registerPdfFonts() {
  if (fontsRegistered) return
  Font.register({ family: PDF_FONT_FAMILY, fonts: PDF_FONT_SOURCES })
  // react-pdf hyphenates by default, which shreds tickers ("BTC-", "USD") and
  // long metric labels mid-word. Returning the word whole disables it.
  Font.registerHyphenationCallback((word) => [word])
  fontsRegistered = true
}

/**
 * Greek drops its diacritics when uppercased, so `textTransform: 'uppercase'`
 * — which is a plain `toUpperCase()` inside react-pdf — renders "ΈΡΕΥΝΑ
 * ΕΤΑΙΡΕΊΑΣ" where the orthography wants "ΕΡΕΥΝΑ ΕΤΑΙΡΕΙΑΣ". The `el`
 * tailoring gets it right and leaves Latin text exactly as `toUpperCase()`
 * would, so it is safe for both of the app's languages.
 */
export function upper(text: string): string {
  return text.toLocaleUpperCase('el')
}

/**
 * react-pdf resolves `lineHeight` to absolute points against the *same style
 * object's* `fontSize` (see `transformLineHeight` in @react-pdf/stylesheet),
 * and the result is then inherited as that fixed number. So a `lineHeight` on
 * the page would hand every heading the body text's line box and make large
 * type collide with whatever follows it. Every style below therefore declares
 * its leading next to its own size, and the page declares none — anything
 * without an explicit one falls back to the font's own metrics, which never
 * overlaps.
 */
export const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: TYPE.body,
    color: PRINT.ink,
    backgroundColor: PRINT.paper,
    paddingTop: PAGE.marginTop,
    paddingBottom: PAGE.marginBottom,
    paddingHorizontal: PAGE.marginX,
  },

  // --- running header / footer ---------------------------------------------
  runningHeader: {
    position: 'absolute',
    top: 16,
    left: PAGE.marginX,
    right: PAGE.marginX,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: PRINT.inkFaint,
    fontSize: TYPE.micro,
  },
  runningFooter: {
    position: 'absolute',
    bottom: 18,
    left: PAGE.marginX,
    right: PAGE.marginX,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    color: PRINT.inkFaint,
    fontSize: TYPE.micro,
  },

  // --- cover ----------------------------------------------------------------
  coverBar: { height: 3, width: 46, backgroundColor: PRINT.accent, marginBottom: 10 },
  eyebrow: {
    fontSize: TYPE.micro,
    lineHeight: 1.3,
    letterSpacing: 1.4,
    color: PRINT.inkFaint,
    fontWeight: 600,
  },
  coverTitle: {
    fontSize: TYPE.display,
    lineHeight: 1.2,
    fontWeight: 700,
    letterSpacing: -0.6,
    color: PRINT.ink,
    marginTop: 6,
  },
  coverSubtitle: {
    fontSize: TYPE.body,
    lineHeight: 1.45,
    color: PRINT.inkMuted,
    marginTop: 6,
    maxWidth: 380,
  },

  // --- sections -------------------------------------------------------------
  section: { marginTop: 16 },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  sectionTitle: {
    fontSize: TYPE.heading,
    lineHeight: 1.3,
    fontWeight: 600,
    letterSpacing: 1.1,
    color: PRINT.inkMuted,
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: PRINT.rule, marginLeft: 8 },
  sectionCaption: {
    fontSize: TYPE.small,
    lineHeight: 1.4,
    color: PRINT.inkFaint,
    marginBottom: 7,
    marginTop: -1,
  },

  // --- surfaces -------------------------------------------------------------
  card: {
    borderWidth: 1,
    borderColor: PRINT.rule,
    borderRadius: RADIUS,
    padding: 8,
    backgroundColor: PRINT.paper,
  },
  cardTinted: { backgroundColor: PRINT.surface },

  // --- text -----------------------------------------------------------------
  label: { fontSize: TYPE.micro, lineHeight: 1.35, color: PRINT.inkFaint, letterSpacing: 0.3 },
  body: { fontSize: TYPE.body, lineHeight: 1.45, color: PRINT.ink },
  bodyMuted: { fontSize: TYPE.small, lineHeight: 1.4, color: PRINT.inkMuted },
  figure: { fontSize: TYPE.figure, lineHeight: 1.25, fontWeight: 600, letterSpacing: -0.3 },
  figureSm: { fontSize: TYPE.figureSm, lineHeight: 1.25, fontWeight: 600, letterSpacing: -0.2 },
  /** The identity block's price, the largest figure outside the cover. */
  figureLg: { fontSize: TYPE.figureLg, lineHeight: 1.2, fontWeight: 700, letterSpacing: -0.5 },
  /** A card's own heading, e.g. the company name over the price. */
  cardTitle: { fontSize: TYPE.title, lineHeight: 1.3, fontWeight: 700, letterSpacing: -0.2 },

  // --- tables ---------------------------------------------------------------
  tableHeadRow: {
    flexDirection: 'row',
    backgroundColor: PRINT.surfaceAlt,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableRow: { flexDirection: 'row', paddingVertical: 3.5, paddingHorizontal: 6 },
  tableRowStriped: { backgroundColor: PRINT.surface },
  th: {
    fontSize: TYPE.micro,
    lineHeight: 1.35,
    fontWeight: 600,
    color: PRINT.inkMuted,
    letterSpacing: 0.3,
  },
  td: { fontSize: TYPE.small, lineHeight: 1.4, color: PRINT.ink },
  tdMuted: { fontSize: TYPE.small, lineHeight: 1.4, color: PRINT.inkMuted },

  // --- misc -----------------------------------------------------------------
  row: { flexDirection: 'row', alignItems: 'center' },
  swatch: { width: 5, height: 5, borderRadius: 2.5, marginRight: 4 },
  chip: {
    borderWidth: 1,
    borderColor: PRINT.rule,
    borderRadius: 3,
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    fontSize: TYPE.micro,
    lineHeight: 1.4,
    color: PRINT.inkMuted,
    marginRight: 4,
    marginBottom: 3,
  },
  footnote: { fontSize: TYPE.micro, lineHeight: 1.4, color: PRINT.inkFaint, marginTop: 2 },
})

