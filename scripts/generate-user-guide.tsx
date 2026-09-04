import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font, Image, renderToFile } from '@react-pdf/renderer'
import path from 'path'

// Register Assistant font
Font.register({
  family: 'Assistant',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/assistant/v24/2sDPZGJYnIjSi6H75xkZZE1I0yCmYzzQtuZnEGE.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/assistant/v24/2sDPZGJYnIjSi6H75xkZZE1I0yCmYzzQtgFgEGE.ttf', fontWeight: 700 },
  ]
})

const TEAL = '#54ABA7'
const TEXT = '#515151'
const MUTED = '#626262'
const BG_LIGHT = '#F7FAFA'

const root = path.resolve(__dirname, '..')
const logo = path.join(root, 'public', 'pegasus_icon.png')
const shots = path.join(root, 'screenshots')

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Assistant',
    fontSize: 11,
    color: TEXT,
  },
  coverPage: {
    padding: 40,
    fontFamily: 'Assistant',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverLogo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: TEAL,
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 16,
    color: MUTED,
    marginBottom: 4,
  },
  coverDate: {
    fontSize: 11,
    color: MUTED,
    marginTop: 20,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TEAL,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 700,
    textAlign: 'center',
    lineHeight: 1,
    paddingTop: 7,
    marginRight: 12,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: TEAL,
  },
  paragraph: {
    fontSize: 11,
    lineHeight: 1.6,
    marginBottom: 10,
    color: TEXT,
  },
  screenshot: {
    width: '100%',
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 10,
  },
  bullet: {
    width: 12,
    fontSize: 11,
    color: TEAL,
  },
  bulletText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 1.5,
    color: TEXT,
  },
  tipBox: {
    backgroundColor: BG_LIGHT,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    padding: 10,
    marginTop: 6,
    marginBottom: 12,
    borderRadius: 2,
  },
  tipLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: TEAL,
    marginBottom: 3,
  },
  tipText: {
    fontSize: 10,
    color: MUTED,
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#B9DEE3',
    marginTop: 8,
    marginBottom: 16,
  },
})

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  )
}

function Tip({ text }: { text: string }) {
  return (
    <View style={styles.tipBox}>
      <Text style={styles.tipLabel}>TIP</Text>
      <Text style={styles.tipText}>{text}</Text>
    </View>
  )
}

function Footer({ page }: { page: number }) {
  return <Text style={styles.footer}>Pegasus Learning Academy — User Guide — Page {page}</Text>
}

function UserGuide() {
  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.coverPage}>
        <Image src={logo} style={styles.coverLogo} />
        <Text style={styles.coverTitle}>PEGASUS LEARNING ACADEMY</Text>
        <Text style={styles.coverSubtitle}>Platform User Guide</Text>
        <Text style={styles.coverDate}>March 2026</Text>
      </Page>

      {/* Step 1: Settings & Setup */}
      <Page size="A4" style={styles.page}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepNumber}>1</Text>
          <Text style={styles.stepTitle}>Configure Your Academy</Text>
        </View>
        <Text style={styles.paragraph}>
          Start by setting up the foundation of your academy in the Settings page. This is where you define the core data that powers everything else — subjects, hourly rates, classrooms, and your academy information.
        </Text>
        <Bullet>Navigate to Settings from the sidebar menu</Bullet>
        <Bullet>Add your Subjects (e.g., English, Math, Science)</Bullet>
        <Bullet>Set Hourly Rates for each stream and level combination</Bullet>
        <Bullet>Define your Classrooms with capacity information</Bullet>
        <Bullet>Update your Academy Info (name, payment methods)</Bullet>
        <Tip text="Payment methods you add here will automatically appear on invoices, so set up your bank details and PayNow information early." />
        <Image src={path.join(shots, '09-settings-subjects.png')} style={styles.screenshot} />
        <Footer page={2} />
      </Page>

      {/* Step 2: Register Students & Tutors */}
      <Page size="A4" style={styles.page}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepNumber}>2</Text>
          <Text style={styles.stepTitle}>Register Students & Tutors</Text>
        </View>
        <Text style={styles.paragraph}>
          Add your tutors and students to the system. Each student is linked to a parent (for invoicing) and assigned a stream and level.
        </Text>
        <Bullet>Go to the Tutors page and click "Add Tutor" to register your teaching staff</Bullet>
        <Bullet>Go to the Students page and click "Add Student" to enroll students</Bullet>
        <Bullet>For each student, specify their parent's name, stream (e.g., International, Local), and level</Bullet>
        <Bullet>You can view all parent contacts from the Parents tab on the Students page</Bullet>
        <Tip text="Students and tutors can be set to Active or Inactive. Inactive records are hidden from scheduling but preserved for historical data." />
        <Image src={path.join(shots, '05-students.png')} style={styles.screenshot} />
        <View style={styles.divider} />
        <Image src={path.join(shots, '07-tutors.png')} style={styles.screenshot} />
        <Footer page={3} />
      </Page>

      {/* Step 3: Schedule Classes */}
      <Page size="A4" style={styles.page}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepNumber}>3</Text>
          <Text style={styles.stepTitle}>Schedule Classes</Text>
        </View>
        <Text style={styles.paragraph}>
          Create recurring class series or one-off sessions. The Schedule page offers three views: a Calendar for visual planning, an All Classes table for searching and filtering, and a Class Series list for managing recurring schedules.
        </Text>
        <Bullet>Use the Class Series tab to create recurring weekly classes</Bullet>
        <Bullet>Each series generates individual sessions that appear on the calendar</Bullet>
        <Bullet>Click any session on the calendar to view details, mark attendance, or edit</Bullet>
        <Bullet>Use the All Classes tab to search across all sessions by tutor, student, subject, or date</Bullet>
        <Tip text="You can add extra (ad-hoc) classes directly from the calendar. These appear in the All Classes tab alongside regular sessions, and show up as individual line items on the parent's invoice." />
        <Image src={path.join(shots, '03-schedule.png')} style={styles.screenshot} />
        <View style={styles.divider} />
        <Image src={path.join(shots, '23-all-classes-tab.png')} style={styles.screenshot} />
        <Footer page={4} />
      </Page>

      {/* Step 4: Generate Invoices */}
      <Page size="A4" style={styles.page}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepNumber}>4</Text>
          <Text style={styles.stepTitle}>Generate & Download Invoices</Text>
        </View>
        <Text style={styles.paragraph}>
          At the end of each month, generate invoices for parents based on their children's scheduled classes. The system automatically calculates totals from attendance records and hourly rates.
        </Text>
        <Bullet>Navigate to the Invoices page</Bullet>
        <Bullet>Select the month and year, then click "Generate Invoices"</Bullet>
        <Bullet>Review each invoice — line items show subjects, hours, and rates</Bullet>
        <Bullet>Use the Edit button to modify descriptions, adjust totals, or remove line items</Bullet>
        <Bullet>Use "Add Line Item" to append extra charges (e.g. materials, books) to an existing invoice</Bullet>
        <Bullet>Click the download button to export a professional PDF invoice with your academy logo</Bullet>
        <Tip text="Invoices can be edited anytime before they are marked as Paid. Once paid, the invoice is locked." />
        <Image src={path.join(shots, '08-invoices.png')} style={styles.screenshot} />
        <Footer page={5} />
      </Page>

      {/* Step 5: Monitor with Dashboard */}
      <Page size="A4" style={styles.page}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepNumber}>5</Text>
          <Text style={styles.stepTitle}>Monitor Your Academy</Text>
        </View>
        <Text style={styles.paragraph}>
          The Dashboard gives you an at-a-glance overview of your academy — active students, tutors, upcoming classes, and recent activity. Use it as your daily starting point.
        </Text>
        <Bullet>View total active students, tutors, and classes at a glance</Bullet>
        <Bullet>See today's schedule and upcoming classes</Bullet>
        <Bullet>Track monthly revenue and invoice status</Bullet>
        <Image src={path.join(shots, '02-dashboard.png')} style={styles.screenshot} />
        <View style={styles.tipBox}>
          <Text style={styles.tipLabel}>MOBILE ACCESS</Text>
          <Text style={styles.tipText}>
            The platform is fully responsive. Access all features from your phone or tablet — perfect for checking schedules on the go or taking attendance in the classroom.
          </Text>
        </View>
        <Footer page={6} />
      </Page>
    </Document>
  )
}

async function main() {
  const outPath = path.join(root, 'Pegasus Learning Academy - User Guide.pdf')
  console.log('Generating user guide PDF...')
  await renderToFile(<UserGuide />, outPath)
  console.log(`Done! Saved to: ${outPath}`)
}

main().catch(err => {
  console.error('Error generating PDF:', err)
  process.exit(1)
})
