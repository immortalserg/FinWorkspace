import type { ComponentProps, ReactNode } from 'react'
import { Page, Text, View } from '@react-pdf/renderer'
import { PRINT, RADIUS, TYPE } from './pdfTheme'
import { s, upper } from './pdfPrimitivesData'

/** The hairline that separates the running header from the content. */
export function RunningHeader({ left, right }: { left: string; right: string }) {
  return (
    <View style={s.runningHeader} fixed>
      <Text>{left}</Text>
      <Text>{right}</Text>
    </View>
  )
}

export function RunningFooter({
  note,
  pageLabel,
}: {
  note: string
  pageLabel: (n: number, total: number) => string
}) {
  return (
    <View style={s.runningFooter} fixed>
      <Text style={{ maxWidth: 400 }}>{note}</Text>
      <Text render={({ pageNumber, totalPages }) => pageLabel(pageNumber, totalPages)} />
    </View>
  )
}

/** An A4 page already wearing the report's header, footer and margins. */
export function ReportPage({
  headerLeft,
  headerRight,
  footerNote,
  pageLabel,
  children,
}: {
  headerLeft: string
  headerRight: string
  footerNote: string
  pageLabel: (n: number, total: number) => string
  children: ReactNode
}) {
  return (
    <Page size="A4" style={s.page}>
      <RunningHeader left={headerLeft} right={headerRight} />
      {children}
      <RunningFooter note={footerNote} pageLabel={pageLabel} />
    </Page>
  )
}

export function Cover({
  eyebrow,
  title,
  subtitle,
  meta,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  meta?: string[]
}) {
  return (
    <View>
      <View style={s.coverBar} />
      <Text style={s.eyebrow}>{upper(eyebrow)}</Text>
      <Text style={s.coverTitle}>{title}</Text>
      {subtitle ? <Text style={s.coverSubtitle}>{subtitle}</Text> : null}
      {meta && meta.length > 0 ? (
        <View style={[s.row, { marginTop: 9, flexWrap: 'wrap' }]}>
          {meta.map((entry) => (
            <Text key={entry} style={s.chip}>
              {entry}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}

export function Section({
  title,
  caption,
  children,
  first = false,
  wrap = true,
}: {
  title: string
  caption?: string
  children: ReactNode
  /** Drops the top margin — for the first section under the cover. */
  first?: boolean
  /** `false` keeps the whole section on one page. */
  wrap?: boolean
}) {
  return (
    <View style={first ? undefined : s.section} wrap={wrap}>
      <View style={s.sectionHeadRow}>
        <Text style={s.sectionTitle}>{upper(title)}</Text>
        <View style={s.sectionRule} />
      </View>
      {caption ? <Text style={s.sectionCaption}>{caption}</Text> : null}
      {children}
    </View>
  )
}

/** A coloured dot that ties a name to its series colour, as on screen. */
export function Swatch({ color }: { color: string }) {
  return <View style={[s.swatch, { backgroundColor: color }]} />
}

/** The colour key under a multi-series chart. */
export function ChartLegend({
  entries,
}: {
  entries: Array<{ label: string; color: string; dashed?: boolean }>
}) {
  return (
    <View style={[s.row, { flexWrap: 'wrap', marginTop: 4 }]}>
      {entries.map((entry) => (
        <View key={entry.label} style={[s.row, { marginRight: 10 }]}>
          <View
            style={{
              width: 8,
              height: entry.dashed ? 0 : 2,
              borderRadius: 1,
              marginRight: 3,
              backgroundColor: entry.dashed ? 'transparent' : entry.color,
              borderTopWidth: entry.dashed ? 1 : 0,
              borderTopColor: entry.color,
              borderStyle: entry.dashed ? 'dashed' : 'solid',
            }}
          />
          <Text style={{ fontSize: TYPE.micro, color: PRINT.inkMuted }}>{entry.label}</Text>
        </View>
      ))}
    </View>
  )
}

export interface TableColumn<T> {
  key: string
  header: string
  /** Flex weight of the column. */
  width: number
  align?: 'left' | 'right' | 'center'
  render: (row: T, index: number) => ReactNode
}

/**
 * The one table treatment in the report: tinted header, zebra body, a hairline
 * frame. Right-align numeric columns via each column's `align`.
 */
export function DataTable<T>({
  columns,
  rows,
  keyOf,
}: {
  columns: TableColumn<T>[]
  rows: T[]
  keyOf: (row: T, index: number) => string
}) {
  return (
    <View style={{ borderWidth: 1, borderColor: PRINT.rule, borderRadius: RADIUS }}>
      <View style={s.tableHeadRow}>
        {columns.map((column) => (
          <Text
            key={column.key}
            style={[s.th, { flex: column.width, textAlign: column.align ?? 'left' }]}
          >
            {column.header}
          </Text>
        ))}
      </View>
      {rows.map((row, index) => (
        <View
          key={keyOf(row, index)}
          style={index % 2 === 1 ? [s.tableRow, s.tableRowStriped] : s.tableRow}
          wrap={false}
        >
          {columns.map((column) => (
            <View key={column.key} style={{ flex: column.width }}>
              <View style={{ alignItems: alignItemsFor(column.align) }}>
                {column.render(row, index)}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

function alignItemsFor(align: 'left' | 'right' | 'center' | undefined) {
  if (align === 'right') return 'flex-end' as const
  if (align === 'center') return 'center' as const
  return 'flex-start' as const
}

/** A label/value pair on one line, as the research page's fact rows read. */
export function FactRow({
  label,
  value,
  tone,
  striped = false,
}: {
  label: string
  value: string
  tone?: string
  striped?: boolean
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          paddingVertical: 2.5,
          paddingHorizontal: 5,
          borderRadius: 2,
        },
        striped ? { backgroundColor: PRINT.surface } : {},
      ]}
      wrap={false}
    >
      <Text style={[s.tdMuted, { flex: 1, paddingRight: 6 }]}>{label}</Text>
      <Text style={[s.td, { fontWeight: 500, color: tone ?? PRINT.ink }]}>{value}</Text>
    </View>
  )
}

/** A stack of `FactRow`s inside a titled card — the report's densest unit. */
export function FactCard({
  title,
  rows,
  style,
}: {
  /** Omit when the enclosing `Section` already carries this exact heading. */
  title?: string
  rows: Array<{ label: string; value: string; tone?: string }>
  style?: ComponentProps<typeof View>['style']
}) {
  return (
    <View style={[s.card, ...(style ? [style] : [])]} wrap={false}>
      {title ? <Text style={[s.sectionTitle, { marginBottom: 4 }]}>{upper(title)}</Text> : null}
      {rows.map((row, index) => (
        <FactRow key={row.label} {...row} striped={index % 2 === 1} />
      ))}
    </View>
  )
}

export function Footnotes({ lines, emphasis }: { lines: string[]; emphasis?: string }) {
  return (
    <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: PRINT.rule, paddingTop: 6 }}>
      {lines.map((line) => (
        <Text key={line} style={s.footnote}>
          {line}
        </Text>
      ))}
      {emphasis ? (
        <Text style={[s.footnote, { color: PRINT.inkMuted, fontWeight: 600, marginTop: 3 }]}>
          {emphasis}
        </Text>
      ) : null}
    </View>
  )
}
