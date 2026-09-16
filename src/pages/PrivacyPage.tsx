import LegalPage from '@/components/legal/LegalPage';
import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="How VeloDealer collects, uses, shares and protects personal data, including data shared with Intuit QuickBooks."
      lastUpdated="16 September 2026"
    >
      <p>
        This policy explains how <strong>Vdms Ltd</strong> ("<strong>VeloDealer</strong>", "<strong>we</strong>", "<strong>us</strong>"),
        a company registered in England and Wales (company number <strong>16785495</strong>) with its registered office at{' '}
        <strong>30 Wake Green Road, Birmingham, England, B13 9PB</strong>, collects and uses personal data in connection with
        velodealer.com and our software-as-a-service platform for bicycle dealers (the "<strong>Service</strong>").
      </p>
      <p>
        <strong>Contact:</strong> info@velodealer.com
      </p>

      <section>
        <h2>1. Two kinds of data — an important distinction</h2>
        <p>
          <strong>(a) Data about you and your team (we are the controller).</strong> When you visit our website, register an
          account, subscribe, or contact us, we collect data about you and your business. This policy covers that data.
        </p>
        <p>
          <strong>(b) Your customers' data (we are the processor).</strong> If you use the Service to store records about{' '}
          <em>your own</em> customers (names, addresses, orders), we process that data only on your behalf and on your
          instructions, under the Data Processing Addendum in our Terms of Service. <strong>This policy does not apply to that
          data</strong> — your own privacy policy governs how your customers' data is used, and requests from your customers
          about their data should be directed to you. If a data subject contacts us directly about data we hold as a processor,
          we will refer them to the relevant dealer.
        </p>
      </section>

      <section>
        <h2>2. Data we collect</h2>
        <ul>
          <li>
            <strong>Account and profile data</strong> — your name, business name, email address, phone number, and
            business/delivery address, collected when you register or update your Account.
          </li>
          <li>
            <strong>Billing data</strong> — Subscription plan, billing address and payment history. Card payments are handled
            by our payment provider, <strong>[PAYMENT PROVIDER — TBC]</strong>; we do not store full card numbers.
          </li>
          <li>
            <strong>Communications</strong> — messages you send us, including support requests and enquiries.
          </li>
          <li>
            <strong>Usage and technical data</strong> — information about how you use the Service and website, such as pages
            visited, features used, log data, IP address, browser type and device information, collected via cookies and
            similar technologies (see section 8).
          </li>
          <li>
            <strong>Marketing preferences</strong> — whether you have opted in to or out of marketing emails.
          </li>
        </ul>
        <p>
          We do not intentionally collect special category data about you, and ask that you do not submit it.
        </p>
      </section>

      <section>
        <h2>3. How and why we use your data</h2>
        <table>
          <thead>
            <tr>
              <th>Purpose</th>
              <th>Data used</th>
              <th>Lawful basis (UK GDPR)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Providing the Service, managing your Account and Subscription</td>
              <td>Account, billing, usage data</td>
              <td>Performance of a contract</td>
            </tr>
            <tr>
              <td>Taking payment and maintaining financial records</td>
              <td>Billing data</td>
              <td>Contract; legal obligation</td>
            </tr>
            <tr>
              <td>Responding to enquiries and providing support</td>
              <td>Account data, communications</td>
              <td>Contract; legitimate interests</td>
            </tr>
            <tr>
              <td>Securing, maintaining and improving the Service</td>
              <td>Usage and technical data</td>
              <td>Legitimate interests (running and protecting our business)</td>
            </tr>
            <tr>
              <td>Sending service emails (billing, renewals, security, changes to terms)</td>
              <td>Account data</td>
              <td>Contract; legal obligation</td>
            </tr>
            <tr>
              <td>Sending marketing emails about VeloDealer products and features</td>
              <td>Account data, marketing preferences</td>
              <td>Legitimate interests / consent (see section 4)</td>
            </tr>
            <tr>
              <td>Complying with law and enforcing our terms</td>
              <td>Any of the above</td>
              <td>Legal obligation; legitimate interests</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>4. Marketing</h2>
        <p>
          We may send marketing emails about the Service to business contacts and existing customers, in line with UK direct
          marketing rules. <strong>You can opt out at any time</strong> using the unsubscribe link in any marketing email, via
          your Account settings, or by contacting us at info@velodealer.com. Opting out does not affect service emails we need
          to send you (such as invoices and renewal notices).
        </p>
        <p>We do not sell your personal data.</p>
      </section>

      <section>
        <h2>5. Who we share data with</h2>
        <p>We share personal data only with:</p>
        <ul>
          <li>
            <strong>Service providers</strong> who help us run the Service under contracts that protect your data — including
            Supabase (hosting, storage and authentication), Resend (transactional email), Typeform (submission forms),
            InspectABike (bike inspections), our payment processor (<strong>[PAYMENT PROVIDER — TBC]</strong>) and analytics
            providers;
          </li>
          <li>
            <strong>Third-party services you connect</strong> — if you link your own Shopify, eBay or QuickBooks Online
            account, we transmit data to that provider on your instruction, and their own terms and privacy policies apply to
            it;
          </li>
          <li>
            <strong>Cycle Courier Co. (Cycorco Ltd)</strong> — if you book a bike collection or delivery through the Service,
            we share the necessary contact and bike details with Cycle Courier Co., which handles them as an independent
            controller. Cycle Courier Co. is a business connected to our ownership;
          </li>
          <li>
            <strong>Professional advisers</strong> (accountants, lawyers, insurers) where necessary;
          </li>
          <li>
            <strong>Authorities</strong> where required by law; and
          </li>
          <li>
            <strong>A buyer or successor</strong> if we sell or reorganise the business, in which case your data would remain
            subject to protections equivalent to this policy.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. International transfers</h2>
        <p>
          We store data in the UK/EEA where possible. If any provider processes data outside the UK, we ensure the transfer is
          covered by UK adequacy regulations or appropriate safeguards such as the ICO's International Data Transfer Agreement
          or the UK Addendum to the EU Standard Contractual Clauses.
        </p>
      </section>

      <section>
        <h2>7. How long we keep data</h2>
        <ul>
          <li>
            <strong>Account data</strong> — for the life of your Account, then deleted or anonymised within 12 months of
            closure, except where longer retention is required.
          </li>
          <li>
            <strong>Billing and tax records</strong> — 6 years, to meet legal obligations.
          </li>
          <li>
            <strong>Support communications</strong> — up to 24 months after resolution.
          </li>
          <li>
            <strong>Usage/analytics data</strong> — retained in identifiable form no longer than 14 months, then aggregated or
            deleted.
          </li>
          <li>
            <strong>Marketing suppression list</strong> — we keep a minimal record of opt-outs indefinitely so we can honour
            them.
          </li>
        </ul>
      </section>

      <section>
        <h2>8. Cookies and analytics</h2>
        <p>
          Our website and Service use cookies and similar technologies:
        </p>
        <ul>
          <li>
            <strong>Essential cookies</strong> — required for login, security and core functionality. These cannot be switched
            off.
          </li>
          <li>
            <strong>Analytics cookies</strong> — help us understand how the site and Service are used so we can improve them.
            These are set only with your consent, which you can give or withdraw via the cookie banner or your browser
            settings.
          </li>
        </ul>
        <p>
          For details of specific cookies and durations, see our <Link to="/cookies">Cookie Policy</Link>.
        </p>
      </section>

      <section>
        <h2>9. Security</h2>
        <p>
          We use appropriate technical and organisational measures to protect personal data, including encryption in transit,
          access controls, and hosting with reputable providers. No system is completely secure, so please keep your Account
          credentials confidential and contact us immediately if you suspect unauthorised access.
        </p>
      </section>

      <section>
        <h2>10. Your rights</h2>
        <p>
          Under UK data protection law you have the right to:
        </p>
        <ul>
          <li>
            <strong>access</strong> the personal data we hold about you;
          </li>
          <li>
            <strong>rectify</strong> inaccurate or incomplete data;
          </li>
          <li>
            <strong>erase</strong> your data in certain circumstances;
          </li>
          <li>
            <strong>restrict</strong> or <strong>object to</strong> processing, including objecting to direct marketing at any
            time;
          </li>
          <li>
            <strong>data portability</strong> — receive certain data in a machine-readable format;
          </li>
          <li>
            <strong>withdraw consent</strong> where processing is based on consent, without affecting prior processing.
          </li>
        </ul>
        <p>
          To exercise any right, contact us at info@velodealer.com. We will respond within one month. We may need to verify
          your identity first.
        </p>
        <p>
          If you are unhappy with how we handle your data, you can complain to the Information Commissioner's Office (ICO) at
          ico.org.uk or on 0303 123 1113, though we would appreciate the chance to resolve your concern first.
        </p>
      </section>

      <section>
        <h2>11. Children</h2>
        <p>
          The Service is for businesses and is not directed at children. We do not knowingly collect data from anyone under
          18.
        </p>
      </section>

      <section>
        <h2>12. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Material changes will be notified by email or in-Service notice, and
          the "last updated" date above will change. Continued use of the Service after the effective date constitutes
          acceptance of the updated policy.
        </p>
      </section>
    </LegalPage>
  );
}
