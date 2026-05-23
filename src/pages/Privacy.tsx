import { Link } from "react-router-dom";

const Privacy = () => (
  <div className="min-h-screen bg-background px-4 py-16">
    <div className="max-w-3xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-3 mb-12">
        <div className="w-7 h-7 bg-gradient-prism rounded-lg rotate-45 flex items-center justify-center">
          <div className="w-2.5 h-2.5 bg-white/30 rounded-sm" />
        </div>
        <span className="text-gradient-brand font-medium text-lg tracking-tight">Prism</span>
      </Link>

      <h1 className="text-4xl font-light tracking-tight mb-2">Default Privacy Notice</h1>
      <p className="text-muted-foreground mb-12">Last updated: May 23, 2026</p>

      <div className="prose prose-invert max-w-none space-y-8 text-foreground/90 leading-relaxed">
        <section>
          <h2 className="text-xl font-medium mb-3">Overview</h2>
          <p>
            Prism Salon OS is open-source salon management software. This default notice is a
            starting point for self-hosted operators and should be customized before production use.
            The operator of a deployment controls the data, provider accounts, and legal policies
            for that deployment.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">Information We Collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Salon owners and staff:</strong> name, email, phone, role, business details, payment-processing information needed to operate the salon.</li>
            <li><strong>Clients:</strong> name, contact info, appointment history, service preferences, and (when provided) hair-care notes such as allergies and hair type — used solely to deliver service.</li>
            <li><strong>Usage data:</strong> standard logs (IP address, device, pages viewed) used to operate and secure the deployment.</li>
            <li><strong>Payments:</strong> handled by Stripe. We do not store full card numbers; Stripe stores tokenized payment methods.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">How We Use Information</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To operate the deployment, including appointments, messaging, payments, and analytics for the salon.</li>
            <li>To send service-related communications (booking confirmations, reminders, receipts).</li>
            <li>To improve the product and detect abuse.</li>
            <li>We do <strong>not</strong> sell personal information.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">The Salon&apos;s Role</h2>
          <p>
            When a salon uses a self-hosted Prism deployment to manage clients, the salon or
            deployment operator is responsible for its clients&apos; data. Requests to access,
            correct, or delete client information should be directed to the salon or operator.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">Data Retention</h2>
          <p>
            Operators should set their own retention policy. A typical deployment retains account,
            salon, client, appointment, payment, and message records while the salon is active or as
            required for legal, tax, accounting, consent, or dispute purposes.
          </p>
        </section>

        <section id="sms-messaging">
          <h2 className="text-xl font-medium mb-3">SMS Messaging &amp; Opt-In</h2>
          <p>
            A Prism deployment can send transactional SMS messages on behalf of salons. Operators
            should send SMS only to clients who have <strong>affirmatively opted in</strong> by either
            (a) checking the SMS consent box on the public pre-visit check-in form
            (<code>/onboard/&lt;appointment-id&gt;</code>), or (b) giving consent in person or by
            phone, which is then recorded by salon staff at the time of booking.
          </p>
          <p className="mt-3"><strong>Message types.</strong> Transactional only:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Appointment confirmations</li>
            <li>Appointment reminders</li>
            <li>Pre-visit check-in links (profile, payment card, cancellation policy)</li>
            <li>Booking changes, reschedules, and cancellations</li>
          </ul>
          <p className="mt-3">
            We do <strong>not</strong> send marketing or promotional SMS through this number.
            Marketing messages, if any, are sent through the salon&apos;s separate marketing
            workflow, which should be opt-in independently.
          </p>
          <p className="mt-3">
            <strong>Frequency.</strong> Message frequency varies by appointment activity — typically
            1–4 messages per appointment. <strong>Message and data rates may apply.</strong>
          </p>
          <p className="mt-3">
            <strong>Opt-out.</strong> Reply <strong>STOP</strong> to any message to unsubscribe. We
            should send a single confirmation that you have been unsubscribed and should not message
            again unless you re-subscribe. Reply <strong>HELP</strong> for help, or contact the
            salon or deployment operator.
          </p>
          <p className="mt-3">
            <strong>Carrier disclaimer.</strong> Carriers are not liable for delayed or undelivered
            messages.
          </p>
          <p className="mt-3">
            <strong>Mobile information sharing.</strong> No mobile information (phone numbers,
            opt-in status) is shared with third parties or affiliates for marketing or promotional
            purposes. Phone numbers are shared only with our SMS provider (Twilio) for the sole
            purpose of delivering the transactional messages above.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">Sub-processors</h2>
          <p>A deployment may use service providers selected by the operator, including:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Supabase (database, authentication, file storage)</li>
            <li>Stripe (payments)</li>
            <li>Resend (transactional email)</li>
            <li>Twilio (SMS, optional)</li>
            <li>Vercel, Netlify, Cloudflare Pages, or another host selected by the operator</li>
            <li>Google Gemini (AI features)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">Your Rights</h2>
          <p>
            Depending on where you live, you may have rights to access, correct, delete, or export
            your personal information, and to object to certain processing. Contact the salon or
            deployment operator to exercise those rights.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">Security</h2>
          <p>
            Operators should use industry-standard safeguards, including encryption in transit,
            role-based access, restricted service-role keys, secure webhook secrets, and audit logs.
            No system is perfectly secure.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">Contact</h2>
          <p>
            Questions or requests should be sent to the salon or deployment operator. Replace this
            section with your production contact before launch.
          </p>
        </section>
      </div>

      <div className="mt-16 pt-8 border-t border-border/40 flex gap-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <Link to="/terms" className="hover:text-foreground">Terms</Link>
      </div>
    </div>
  </div>
);

export default Privacy;
