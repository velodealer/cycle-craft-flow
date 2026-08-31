import LegalPage from '@/components/legal/LegalPage';

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="How VeloDealer collects, uses, shares and protects personal data, including data shared with Intuit QuickBooks."
      lastUpdated="31 August 2026"
    >
      <section>
        <h2>1. Who we are</h2>
        <p>
          VeloDealer is operated by [Company Name], a company registered in England and Wales with
          registered office at [Registered Address]. We are the data controller for personal data
          about our account holders, and a data processor for personal data our customers enter about
          their own customers and suppliers. Contact: [Contact Email].
        </p>
      </section>

      <section>
        <h2>2. What we collect</h2>
        <ul>
          <li>
            <strong>Account data</strong> — name, email address, role and authentication data for users
            of the Service.
          </li>
          <li>
            <strong>Business records</strong> — bicycle, component and parts records, storage locations,
            job and inspection notes, photographs, quotes, invoices, sale and part-exchange details.
          </li>
          <li>
            <strong>Contact records</strong> — names, email addresses, phone numbers and addresses of
            customers, owners, investors and recipients entered by our users.
          </li>
          <li>
            <strong>Integration data</strong> — access tokens and account identifiers for connected
            services such as QuickBooks Online and Cycle Courier Co.
          </li>
          <li>
            <strong>Technical data</strong> — log records, IP address, device and browser information,
            and error diagnostics.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Why we use it and our legal basis</h2>
        <ul>
          <li>To provide, operate and support the Service — performance of a contract.</li>
          <li>To post accounting entries to a connected QuickBooks company at your instruction — performance of a contract.</li>
          <li>To arrange collections and deliveries with a courier at your instruction — performance of a contract.</li>
          <li>To secure the Service, prevent abuse and diagnose faults — legitimate interests.</li>
          <li>To meet accounting, tax and other legal obligations — legal obligation.</li>
        </ul>
      </section>

      <section>
        <h2>4. Sharing with third parties</h2>
        <p>We share data only with processors and services needed to run the Service:</p>
        <ul>
          <li>
            <strong>Intuit QuickBooks Online</strong> — when you connect a QuickBooks company, we send
            invoice, customer, item, VAT and journal data (customer name and contact details, invoice
            lines, amounts, tax codes and references) so entries can be created in your accounts. We
            read your chart of accounts, VAT codes and existing customer records to map postings
            correctly. We never sell this data and use it solely to produce the postings you request.
          </li>
          <li>
            <strong>Cycle Courier Co</strong> — sender and recipient names, addresses, phone numbers,
            email addresses and bicycle details for booked collections and deliveries.
          </li>
          <li>
            <strong>Supabase</strong> — hosting of our database, authentication and file storage.
          </li>
          <li>
            Professional advisers, or authorities where required by law.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. International transfers</h2>
        <p>
          Some providers may process data outside the UK or EEA. Where they do, we rely on adequacy
          decisions or standard contractual clauses with appropriate safeguards.
        </p>
      </section>

      <section>
        <h2>6. Retention</h2>
        <p>
          We keep account and business records for as long as the account is active and for up to six
          years afterwards where required for accounting and tax purposes. Technical logs are kept for
          a shorter period. Integration tokens are deleted when you disconnect the integration.
        </p>
      </section>

      <section>
        <h2>7. Your rights</h2>
        <p>
          Under UK GDPR you may request access to your personal data, correction, erasure,
          restriction, portability, or object to processing based on legitimate interests. Contact
          [Contact Email] to exercise these rights. You may also complain to the Information
          Commissioner's Office (ico.org.uk).
        </p>
      </section>

      <section>
        <h2>8. Cookies and local storage</h2>
        <p>
          We use strictly necessary cookies and browser local storage to keep you signed in and to
          remember interface preferences. We do not use advertising or third-party tracking cookies.
        </p>
      </section>

      <section>
        <h2>9. Security</h2>
        <p>
          Data is transmitted over TLS, access is restricted by authenticated accounts with
          role-based permissions and row-level database security, and integration credentials are held
          in an encrypted secret store rather than in application data.
        </p>
      </section>

      <section>
        <h2>10. Changes</h2>
        <p>
          We may update this policy. The latest version is always published on this page with the date
          it was last updated.
        </p>
      </section>

      <section>
        <h2>11. Contact</h2>
        <p>[Company Name], [Registered Address]. Email: [Contact Email].</p>
      </section>
    </LegalPage>
  );
}
