import LegalPage from '@/components/legal/LegalPage';

export default function TermsPage() {
  return (
    <LegalPage
      title="End-User Licence Agreement"
      description="The end-user licence agreement governing use of VeloDealer, the bicycle dealer management system."
      lastUpdated="31 August 2026"
    >
      <section>
        <h2>1. Agreement</h2>
        <p>
          This End-User Licence Agreement ("Agreement") is a legal agreement between you (the
          "Customer") and VDMS Ltd, a company registered in England and Wales with registered
          office at 30 Wake Green Road, Birmingham, B13 9PB ("we", "us"), governing your use of the VeloDealer bicycle
          dealer management system, including its web application, integrations and related services
          (the "Service"). By creating an account or using the Service you accept this Agreement.
        </p>
      </section>

      <section>
        <h2>2. Licence grant</h2>
        <p>
          We grant you a non-exclusive, non-transferable, revocable licence to access and use the
          Service for your internal business purposes for the duration of your subscription, subject
          to this Agreement.
        </p>
      </section>

      <section>
        <h2>3. Restrictions</h2>
        <p>You must not:</p>
        <ul>
          <li>copy, resell, sublicense, rent or otherwise commercially exploit the Service;</li>
          <li>reverse engineer, decompile or attempt to derive the source code of the Service;</li>
          <li>circumvent or interfere with security, access controls or usage limits;</li>
          <li>use the Service to store or transmit unlawful, infringing or malicious material;</li>
          <li>use automated means to extract data at a scale that degrades the Service.</li>
        </ul>
      </section>

      <section>
        <h2>4. Accounts and acceptable use</h2>
        <p>
          You are responsible for maintaining the confidentiality of account credentials, for all
          activity under your accounts, and for ensuring your users comply with this Agreement. You
          must notify us promptly of any suspected unauthorised access.
        </p>
      </section>

      <section>
        <h2>5. Your data</h2>
        <p>
          You retain ownership of all data you enter into or generate through the Service, including
          bicycle records, customer records, invoices, quotes and photographs ("Customer Data"). We
          process Customer Data only to provide and support the Service, as described in our Privacy
          Policy. You are responsible for ensuring you have the right to provide any personal data you
          upload.
        </p>
      </section>

      <section>
        <h2>6. Third-party services</h2>
        <p>
          The Service integrates with third-party providers, including Intuit QuickBooks Online
          (accounting postings such as invoices, VAT and stock journals), Cycle Courier Co (collection
          and delivery bookings) and Supabase (application database, authentication and file storage).
          When you connect a third-party account, you authorise us to exchange the data necessary to
          perform the requested operations. Your use of those services is governed by their own terms,
          and we are not responsible for their availability or acts.
        </p>
      </section>

      <section>
        <h2>7. Availability and support</h2>
        <p>
          We aim to keep the Service available at all times but do not guarantee uninterrupted access.
          The Service may be unavailable during maintenance or because of events outside our
          reasonable control. Support is provided at info@velodealer.com.
        </p>
      </section>

      <section>
        <h2>8. Fees</h2>
        <p>
          Where a subscription fee applies, it is set out in your order or subscription plan. Fees are
          exclusive of VAT unless stated otherwise and are payable in advance.
        </p>
      </section>

      <section>
        <h2>9. Warranties and disclaimers</h2>
        <p>
          The Service is provided "as is". We do not warrant that the Service will be error-free or
          that accounting figures it produces are suitable for filing without review. You remain
          responsible for verifying financial records, VAT treatment and statutory filings.
        </p>
      </section>

      <section>
        <h2>10. Limitation of liability</h2>
        <p>
          Nothing in this Agreement limits liability for death or personal injury caused by
          negligence, fraud, or any liability that cannot be limited by law. Subject to that, we are
          not liable for loss of profit, revenue, goodwill, or indirect or consequential loss, and our
          total aggregate liability is limited to the fees paid by you in the twelve months preceding
          the event giving rise to the claim.
        </p>
      </section>

      <section>
        <h2>11. Termination</h2>
        <p>
          Either party may terminate on written notice in accordance with the subscription terms. We
          may suspend or terminate access immediately for material breach. On termination your licence
          ends; you may request an export of Customer Data within 30 days, after which it may be
          deleted.
        </p>
      </section>

      <section>
        <h2>12. Changes</h2>
        <p>
          We may update this Agreement from time to time. Material changes will be notified through
          the Service or by email, and continued use after the effective date constitutes acceptance.
        </p>
      </section>

      <section>
        <h2>13. Governing law</h2>
        <p>
          This Agreement is governed by the laws of England and Wales, and the courts of England and
          Wales have exclusive jurisdiction.
        </p>
      </section>

      <section>
        <h2>14. Subprocessors</h2>
        <p>
          We use the following subprocessors to provide the Service. Each acts on our documented
          instructions under a written agreement, and processes only the data described below.
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> (database, authentication, file storage and server functions;
            EU/UK region) — all application data, including bikes, customers, invoices, staff accounts
            and uploaded photographs.
          </li>
          <li>
            <strong>Lovable</strong> (application hosting and content delivery; EU) — technical
            connection data such as IP address and request logs.
          </li>
          <li>
            <strong>Resend</strong> (transactional email delivery; EU/US) — recipient name and email
            address and the content of notification and password-reset messages.
          </li>
          <li>
            <strong>Intuit (QuickBooks Online)</strong> (accounting postings; US) — customer name and
            contact details, invoice lines, amounts, VAT codes and references.
          </li>
          <li>
            <strong>Cycle Courier Co</strong> (collection and delivery booking; UK) — sender and
            recipient names, addresses, phone numbers, email addresses and bicycle details.
          </li>
          <li>
            <strong>InspectABike</strong> (bicycle inspections and fault reporting; UK) — bicycle
            details, frame and serial numbers, and the customer name where supplied.
          </li>
          <li>
            <strong>Typeform</strong> (customer submission forms; EU) — the information and photographs
            customers enter when submitting a bicycle for sale or part exchange.
          </li>
          <li>
            <strong>Shopify</strong> (listing bicycles on your own store; US/EU) — listing content and
            the buyer contact details contained in orders returned to us.
          </li>
          <li>
            <strong>eBay</strong> (listing bicycles on your own seller account; US/EU) — listing
            content only.
          </li>
          <li>
            <strong>99Spokes</strong> (bicycle specification lookup; US) — make, model and year only;
            no personal data.
          </li>
        </ul>
        <p>
          Integrations with QuickBooks, Cycle Courier Co, InspectABike, Typeform, Shopify and eBay are
          used only where you choose to connect them. We will give notice before adding or replacing a
          subprocessor; you may object on reasonable data protection grounds by writing to us at the
          contact address below. Cookies and browser storage are described in our Cookie Policy.
        </p>
      </section>

      <section>
        <h2>15. Contact</h2>
        <p>
          VDMS Ltd, 30 Wake Green Road, Birmingham, B13 9PB. Email: info@velodealer.com.
        </p>
      </section>
    </LegalPage>
  );
}
